import { db } from '../firebaseAdminConfig.js'; 
import { updateUserProfileSchema } from '../models/user.js';


export const updateUserProfile = async (req, res) => {
  try {
    const { email } = req.user; 
    const userData = req.body; 
    console.log(userData);

    const { error, value } = updateUserProfileSchema.validate(userData, { abortEarly: false });
    if (error) {
      return res.status(400).json({ 
        message: "Помилка, Некоректно введені дані", 
        errors: error.details.map(err => err.message) 
      });
    }

    const ref = db.collection("users");
    const snapshot = await ref.where("email", "==", email.toLowerCase()).get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    const userDoc = snapshot.docs[0].ref;

    if (Object.keys(value).length === 0) {
      return res.status(400).json({ message: "Немає даних для оновлення" });
    }

    await userDoc.update(value);

    res.status(200).json({ message: "Профіль оновлено", updatedFields: value });
  } catch (error) {
    console.error("Помилка при оновленні профілю:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
};
