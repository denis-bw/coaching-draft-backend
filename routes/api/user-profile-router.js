import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { updateUserProfile } from '../../controllers/user-profile-controller.js';
import authenticate from "../../middlewares/authenticate.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'tmp');
  },
  filename: (req, file, cb) => {
    crypto.randomBytes(16, (err, raw) => {
      if (err) return cb(err);
      
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, raw.toString('hex') + ext);
    });
  }
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Дозволені лише зображення (jpeg, jpg, png, webp)"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

const profileRouter = express.Router();

profileRouter.put('/users/updateprofile', authenticate, upload.single('avatar'), updateUserProfile);

export default profileRouter;