import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 5000;
const SHARP_TIMEOUT = 15000;
const MAX_FILENAME_LENGTH = 100;
const MAX_UPLOAD_RATE = 5;
const MEMORY_USAGE_THRESHOLD = 8.0; 

const storage = multer.memoryStorage();

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: MAX_UPLOAD_RATE, 
  message: { message: 'Забагато запитів на завантаження, спробуйте пізніше' },
  standardHeaders: true,
  legacyHeaders: false,
});

const hasEnoughMemory = () => {
  const memoryUsage = process.memoryUsage();
  const heapUsedPercentage = memoryUsage.heapUsed / memoryUsage.heapTotal;
  return heapUsedPercentage < MEMORY_USAGE_THRESHOLD;
};

const fileFilter = (req, file, cb) => {
  try {
 
    if (!hasEnoughMemory()) {
      return cb(new Error('Сервер зараз перевантажений, спробуйте пізніше'), false);
    }
    
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Недопустимий тип файлу'), false);
    }
    
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Недопустиме розширення файлу'), false);
    }
    
    const isValidJpeg = (file.mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(ext));
    const isValidPng = (file.mimetype === 'image/png' && ext === '.png');
    const isValidWebp = (file.mimetype === 'image/webp' && ext === '.webp');
    
    if (!(isValidJpeg || isValidPng || isValidWebp)) {
      return cb(new Error('Невідповідність типу файлу та розширення'), false);
    }
    
    const safeName = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_') 
      .substring(0, MAX_FILENAME_LENGTH);
    
    if (safeName.includes('..') || safeName.startsWith('.')) {
      return cb(new Error('Недозволене ім\'я файлу'), false);
    }
    
    file.originalname = safeName;
    
    cb(null, true);
  } catch (err) {
    cb(new Error('Помилка валідації файлу'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, 
    fieldSize: MAX_FILE_SIZE, 
  },
  fileFilter,
});

const fileHashes = new Map();
setInterval(() => fileHashes.clear(), 3600000);


export const validateAndProcessImage = async (req, res, next) => {
  if (req.file) {
    if (!req.file.buffer) {
      return res.status(400).json({ message: 'Зображення не завантажено' });
    }

    let timeoutId;
    
    try {
      if (!hasEnoughMemory()) {
        throw new Error('Сервер зараз перевантажений, спробуйте пізніше');
      }

      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      
      if (fileHashes.has(fileHash)) {
        const existingFile = fileHashes.get(fileHash);
        req.file.buffer = existingFile.buffer;
        req.file.filename = existingFile.filename;
        req.fileHash = fileHash; 
        return next();
      }
      
      const processImage = async () => {
        try {
          const imageInfo = await sharp(req.file.buffer, { 
            failOnError: true,
            limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION 
          }).metadata();
          
          if (imageInfo.width > MAX_IMAGE_DIMENSION || imageInfo.height > MAX_IMAGE_DIMENSION) {
            throw new Error(`Зображення занадто велике. Максимальні розміри: ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} пікселів`);
          }
          
          if (!['jpeg', 'png', 'webp'].includes(imageInfo.format)) {
            throw new Error('Непідтримуваний формат зображення');
          }
          
          const processedBuffer = await sharp(req.file.buffer, { 
            failOn: 'error',
            limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION
          })
            .rotate() 
            .withMetadata({ exif: {} }) 
            .toBuffer();
          
          if (!processedBuffer || processedBuffer.length === 0) {
            throw new Error('Помилка обробки зображення');
          }
          
          const filename = crypto.randomBytes(16).toString('hex') + 
            '.' + imageInfo.format; 
          
          req.file.buffer = processedBuffer;
          req.file.filename = filename;
          req.fileHash = fileHash; 
          
          fileHashes.set(fileHash, { 
            buffer: processedBuffer, 
            filename: filename 
          });
          
          return true;
        } catch (sharpError) {
          console.error('Sharp помилка:', sharpError);
          throw new Error(sharpError.message || 'Недійсний формат зображення або пошкоджений файл');
        }
      };

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Час обробки зображення вичерпано'));
        }, SHARP_TIMEOUT);
      });

      await Promise.race([processImage(), timeoutPromise]);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      next();
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (req.file && req.file.buffer) {
        req.file.buffer = null;
      }
      
      console.error('Помилка обробки зображення:', error);
      
      if (error.message === 'Час обробки зображення вичерпано') {
        return res.status(408).json({ message: 'Час обробки зображення вичерпано' });
      } else if (error.message.includes('занадто велике')) {
        return res.status(400).json({ message: error.message });
      } else if (error.message.includes('Недійсний формат')) {
        return res.status(415).json({ message: error.message });
      } else if (error.message.includes('перевантажений')) {
        return res.status(503).json({ message: error.message });
      } else {
        return res.status(400).json({ 
          message: error.message || 'Помилка валідації файлу' 
        });
      }
    }
  } else {
    next();
  }
};


const cleanupOnError = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400 && req.file && req.file.buffer) {
      req.file.buffer = null;
    }
  });
  next();
};

export const handleImageUpload = (fieldName = 'image') => {
  return [
    uploadLimiter, 
    cleanupOnError,
    upload.single(fieldName),
    validateAndProcessImage
  ];
};

export default upload;