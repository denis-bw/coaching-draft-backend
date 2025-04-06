import { v2 as cloudinary } from 'cloudinary';
import { db } from '../firebaseAdminConfig.js';
import athleteSchema from '../models/athlete.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const createAthlete = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Перевірка, чи є дані в тілі запиту
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        message: "Помилка отримання даних", 
        error: "Тіло запиту порожнє або не містить JSON" 
      });
    }
    
    // Отримати дані з тіла запиту
    const data = req.body;
    console.log("req.body:", data); // для дебагу
    
    // Валідація даних з використанням .unknown(true) для дозволу додаткових полів
    const { error, value } = athleteSchema.validate(data, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: 'Помилка валідації', details: error.details });
    }
    
    const athleteRef = db.collection('athletes').doc();
    const athleteId = athleteRef.id;
    
    // Підготовка основних даних спортсмена
    const athleteData = {
      ...value,
      userId,
      createdAt: new Date().toISOString(),
    };
    
    // Якщо є фото — завантажити
    if (req.file) {
      const uniqueId = `athlete_${userId}_${Date.now()}`;
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'athletes',
            public_id: uniqueId,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      
      athleteData.photo = uploadResult.secure_url;
    } else {
      athleteData.photo = null;
    }
    
    // Зберегти основні дані спортсмена
    await athleteRef.set(athleteData);
    
    // Запис попередніх тренерів, тільки якщо масив не пустий
    if (value.previousCoaches && Array.isArray(value.previousCoaches) && value.previousCoaches.length > 0) {
      const batch = db.batch();
      value.previousCoaches.forEach((coach) => {
        const coachRef = db.collection('previousCoaches').doc();
        batch.set(coachRef, { ...coach, athleteId });
      });
      await batch.commit();
    }
    
    // Запис медоглядів, тільки якщо масив не пустий
    if (value.medicalExaminations && Array.isArray(value.medicalExaminations) && value.medicalExaminations.length > 0) {
      const batch = db.batch();
      value.medicalExaminations.forEach((exam) => {
        const examRef = db.collection('medicalExaminations').doc();
        batch.set(examRef, { ...exam, athleteId });
      });
      await batch.commit();
    }
    
    // Запис родичів, тільки якщо масив не пустий
    if (value.relatives && Array.isArray(value.relatives) && value.relatives.length > 0) {
      const batch = db.batch();
      value.relatives.forEach((relative) => {
        const relRef = db.collection('relatives').doc();
        batch.set(relRef, { ...relative, athleteId });
      });
      await batch.commit();
    }
    
    return res.status(201).json({
      message: "Спортсмен створений успішно",
      athlete: {
        id: athleteId,
        ...athleteData,
      },
    });
    
  } catch (err) {
    console.error("Помилка при створенні спортсмена:", err);
    return res.status(500).json({ message: "Помилка сервера при створенні спортсмена", error: err.message });
  }
};