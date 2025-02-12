import { db } from '../firebaseAdminConfig.js'; 
import { updateUserProfileSchema } from '../models/user.js';
import { v2 as cloudinary }  from 'cloudinary';
import fs from 'fs/promises'; 
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

  
    if (Object.keys(userData).length === 0 && !req.file) {
      return res.status(400).json({ message: "Немає даних для оновлення" });
    }

    
    const { error, value } = updateUserProfileSchema.validate(userData, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: "Помилка, Некоректно введені дані",
        errors: error.details.map((err) => err.message),
      });
    }

   
    const ref = db.collection("users");
    const snapshot = await ref.where("email", "==", email.toLowerCase()).get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    const userDoc = snapshot.docs[0].ref;
    const userDataFromDB = snapshot.docs[0].data();

    
    if (req.file) {
      const filePath = req.file.path;

      
      if (userDataFromDB.avatar) {
        try {
          const oldAvatarUrl = userDataFromDB.avatar;
          const publicId = oldAvatarUrl.split("/").slice(-1)[0].split(".")[0]; 
          await cloudinary.uploader.destroy(`avatars/${publicId}`);
        } catch (err) {
          console.error("Помилка при видаленні старого аватара з Cloudinary:", err);
        }
      }

      const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
        folder: "avatars",
        transformation: [{ width: 150, height: 150, crop: "fill" }],
      });

      userData.avatar = cloudinaryResponse.secure_url;

      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error("Помилка при видаленні тимчасового файлу:", err);
      }
    }

    await userDoc.update(userData);

    res.status(200).json({ message: "Профіль оновлено", updatedFields: userData });
  } catch (error) {
    console.error("Помилка при оновленні профілю:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
};
