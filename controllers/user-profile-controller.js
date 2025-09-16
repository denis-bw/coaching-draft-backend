import { db } from '../firebaseAdminConfig.js';
import { updateUserProfileSchema } from '../models/user.js';
import { v2 as cloudinary } from 'cloudinary';
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

    const shouldDeleteAvatar = userData.deleteAvatar === 'true';

    if (Object.keys(userData).length === 0 && !req.file && !shouldDeleteAvatar) {
      return res.status(400).json({ 
        message: "Немає даних для оновлення" 
      });
    }

    delete userData.deleteAvatar;

    const { error, value } = updateUserProfileSchema.validate(userData, { 
      abortEarly: false 
    });
    
    if (error && !shouldDeleteAvatar) {
      if (req.file) {
        await deleteTempFile(req.file.path);
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
        await deleteTempFile(req.file.path);
      }
      return res.status(404).json({ 
        message: "Користувача не знайдено" 
      });
    }

    const userDoc = snapshot.docs[0].ref;
    const userDataFromDB = snapshot.docs[0].data();

    const deleteAvatarFromCloudinary = async (avatarUrl) => {
      if (!avatarUrl) return;
      
      try {
        const urlParts = avatarUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const publicId = `avatars/${fileName.split('.')[0]}`;
        
        const result = await cloudinary.uploader.destroy(publicId);
        console.log("Результат видалення з Cloudinary:", result);
      } catch (err) {
        console.error("Помилка при видаленні аватара з Cloudinary:", err);
      }
    };

    if (shouldDeleteAvatar) {
      if (userDataFromDB.avatar) {
        await deleteAvatarFromCloudinary(userDataFromDB.avatar);
      }
      
      const updateData = { avatar: null };
      await userDoc.update(updateData);
      
      return res.status(200).json({
        message: "Аватар видалено",
        updatedFields: updateData
      });
    }

    if (req.file) {
      if (userDataFromDB.avatar) {
        await deleteAvatarFromCloudinary(userDataFromDB.avatar);
      }

      try {
        const uniqueId = `user_${snapshot.docs[0].id}_${Date.now()}`;
        
        const cloudinaryResponse = await cloudinary.uploader.upload_stream(
          {
            folder: "avatars",
            transformation: [{
              width: 150,
              height: 150,
              crop: "fill"
            }],
            public_id: uniqueId,
            resource_type: "image"
          },
          async (error, result) => {
            if (error) {
              return res.status(500).json({
                message: "Помилка при завантаженні зображення в Cloudinary",
                error
              });
            }

            userData.avatar = result.secure_url;
            await userDoc.update(userData);
            
            res.status(200).json({
              message: "Профіль оновлено з новим аватаром",
              updatedFields: userData
            });
          }
        );

        cloudinaryResponse.end(req.file.buffer);

      } catch (cloudinaryError) {
        console.error("Помилка при завантаженні зображення в Cloudinary:", cloudinaryError);
        return res.status(500).json({
          message: "Помилка при завантаженні зображення"
        });
      }
    } else {
      await userDoc.update(userData);
      res.status(200).json({
        message: "Профіль оновлено",
        updatedFields: userData
      });
    }

  } catch (error) {
    console.error("Помилка при оновленні профілю:", error);
    if (req.file) {
      await deleteTempFile(req.file.path);
    }
    res.status(500).json({ 
      message: "Помилка сервера" 
    });
  }
};

const deleteTempFile = async (filePath) => {
  try {
    const fs = await import('fs/promises');
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Помилка при видаленні тимчасового файлу:", error);
  }
};