import { db } from '../firebaseAdminConfig.js'; 
import { updateUserProfileSchema } from '../models/user.js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const updateUserProfile = async (req, res) => {
  try {
    const { email } = req.user;
    const userData = req.body;
    let filePath = null;

    if (Object.keys(userData).length === 0 && !req.file) {
      return res.status(400).json({ message: "Немає даних для оновлення" });
    }

    const { error, value } = updateUserProfileSchema.validate(userData, { abortEarly: false });
    if (error) {
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error("Помилка при видаленні тимчасового файлу:", err);
        }
      }
      
      return res.status(400).json({
        message: "Помилка, Некоректно введені дані",
        errors: error.details.map((err) => err.message),
      });
    }

    const ref = db.collection("users");
    const snapshot = await ref.where("email", "==", email.toLowerCase()).get();

    if (snapshot.empty) {
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error("Помилка при видаленні тимчасового файлу:", err);
        }
      }
      
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    const userDoc = snapshot.docs[0].ref;
    const userDataFromDB = snapshot.docs[0].data();

    if (req.file) {
      filePath = req.file.path;

      if (userDataFromDB.avatar) {
        try {
          const oldAvatarUrl = userDataFromDB.avatar;

          const urlParts = oldAvatarUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const publicId = `avatars/${fileName.split('.')[0]}`;
          
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error("Помилка при видаленні старого аватара з Cloudinary:", err);
        }
      }

      try {
        const uniqueId = `user_${snapshot.docs[0].id}_${Date.now()}`;
        
        const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
          folder: "avatars",
          transformation: [{ width: 150, height: 150, crop: "fill" }],
          public_id: uniqueId,
 
          resource_type: "image"
        });

        userData.avatar = cloudinaryResponse.secure_url;
      } catch (cloudinaryError) {
        console.error("Помилка при завантаженні зображення в Cloudinary:", cloudinaryError);
        return res.status(500).json({ message: "Помилка при завантаженні зображення" });
      } finally {
 
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("Помилка при видаленні тимчасового файлу:", err);
        }
      }
    }

    await userDoc.update(userData);

    res.status(200).json({ message: "Профіль оновлено", updatedFields: userData });
  } catch (error) {
    console.error("Помилка при оновленні профілю:", error);

    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error("Помилка при видаленні тимчасового файлу:", err);
      }
    }
    
    res.status(500).json({ message: "Помилка сервера" });
  }
};