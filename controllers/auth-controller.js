import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import 'dotenv/config';
import { db } from '../firebaseAdminConfig.js'; 
import { userSignupSchema, userSigninSchema, userEmailSchema } from '../models/user.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export const register = async (req, res) => {
  const { JWT_SECRET } = process.env;
  const { email, password, username } = req.body;
    
  const { error } = userSignupSchema.validate({ email, password, username });
  
  if (error) return res.status(400).json({ message: error.details[0].message });

  const collection = 'users';

  try {
    const ref = db.collection(collection);
    
    const snapshot = await ref.where('email', '==', email).get();
    if (!snapshot.empty) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const docRef = await ref.add({ 
      email, 
      password: hashedPassword, 
      username,
      resetToken,
      resetTokenExpiry,
    });

    const token = jwt.sign(
      { email, id: docRef.id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await docRef.update({ token });

    res.status(201).json({
      id: docRef.id,
      email,
      username,
      token 
    });
  } catch (error) {
    console.error("Error adding data:", error);
    res.status(500).json({ message: 'Error adding user data', error: error.message });
  }
};



export const signin = async (req, res) => {
  const { JWT_SECRET } = process.env;
  const { email, password } = req.body;

  const { error } = userSigninSchema.validate({ email, password });
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const ref = db.collection('users');
    const snapshot = await ref.where('email', '==', email.toLowerCase()).get();

    if (snapshot.empty) {
      return res.status(400).json({ message: 'Bad Request' });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();


    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.token) {
      try {
        const decoded = jwt.verify(user.token, JWT_SECRET);

        return res.status(200).json({
          id: userDoc.id,
          email: user.email,
          username: user.username,
          token: user.token,
        });
      } catch (err) {
        console.log('Token expired or invalid, generating a new one');
      }
    }

    const newToken = jwt.sign({ id: userDoc.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    await userDoc.ref.update({ token: newToken });

    res.status(200).json({
      id: userDoc.id,
      email: user.email,
      username: user.username,
      token: newToken,
    });

  } catch (error) {
    res.status(500).json({ message: 'Error signing in', error: error.message });
  }
};




export const logout = async (req, res) => {
  try {
    const userId = req.user.id; 
    const ref = db.collection('users');
    await ref.doc(userId).update({ token: '' });

    res.status(200).json({ message: 'User logged out successfully' });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ message: 'Error during logout', error: error.message });
  }
};


export const getCurrent = (req, res) => {
  const { email, username } = req.user;

  res.json({
    email,
    username
  });
};









export const sendResetPasswordEmail = async (req, res) => {
  const {EMAIL_USER, PASSWORD_RESET_URL, EMAIL_APP_PASSWORD  } = process.env;
  const { email } = req.body;
  const { error } = userEmailSchema.validate({email});
  
  if (error) return res.status(400).json({ message: error.details[0].message });

    try {
        if (!email) {
            return res.status(400).json({ 
                error: 'Email обов\'язковий' 
            });
        }

        const snapshot = await db.collection("users").where("email", "==", email).get();
        if (snapshot.empty) {
          return res.status(404).json({
            error: 'Користувача з таким email не знайдено'
          });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
       

        const resetToken = crypto.randomBytes(32).toString('hex');
          if (userData.resetToken && userData.resetTokenExpiry > Date.now()) {
            return res.status(400).json({
            error: 'Запит на відновлення пароля вже був надісланий. Спробуйте через деякий час.'
          });
      }
       
        const resetTokenExpiry = Date.now() + 3600000;


        
        await db.collection('users').doc(userDoc.id).update({
            resetToken,
            resetTokenExpiry
        });

      
        const resetLink = `${PASSWORD_RESET_URL}?email=${email}&token=${resetToken}`;

        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_APP_PASSWORD 
            }
        });

        
        const mailOptions = {
            from: EMAIL_USER,
            to: email,
            subject: 'Відновлення пароля',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Відновлення пароля</h2>
                    <p>Ви отримали цей лист, тому що запросили відновлення пароля для вашого облікового запису.</p>
                    <p>Для встановлення нового пароля, будь ласка, перейдіть за посиланням:</p>
                    <p>
                        <a 
                            href="${resetLink}" 
                            style="
                                background-color: #4CAF50; 
                                color: white; 
                                padding: 10px 20px; 
                                text-decoration: none; 
                                border-radius: 5px;
                                display: inline-block;
                            "
                        >
                            Встановити новий пароль
                        </a>
                    </p>
                    <p>Посилання дійсне протягом 1 години.</p>
                    <p>Якщо ви не запитували відновлення пароля, проігноруйте цей лист.</p>
                    <p style="color: #666; font-size: 12px;">
                        Це автоматичний лист, будь ласка, не відповідайте на нього.
                    </p>
                </div>
            `
        };

       
        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            success: true,
            message: 'Інструкції для відновлення пароля відправлені на вашу пошту'
        });

    } catch (error) {
        console.error('Помилка при відправці емейла для скидання пароля:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Виникла помилка при обробці запиту на відновлення пароля'
        });
    }
};









export const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;
  const password = newPassword
  const { error } = userSigninSchema.validate({ email, password });
  
  
  if (error) return res.status(400).json({ message: error.details[0].message });

  try { 
        if (!email || !token || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Відсутні необхідні дані для скидання пароля'
            });
        }

        
        const userSnapshot = await db.collection('users')
            .where('email', '==', email)
            .get();

        if (userSnapshot.empty) {
            return res.status(404).json({
                success: false,
                error: 'Користувача з такою електронною поштою не знайдено'
            });
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        
        if (
            userData.resetToken !== token || 
            !userData.resetTokenExpiry || 
            userData.resetTokenExpiry < Date.now()
        ) {
            return res.status(410).json({
                success: false,
                error: 'Час посилання відновлення пароля закінчився'
            });
        }

       
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        
        await db.collection('users').doc(userDoc.id).update({
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null
        });

        return res.status(200).json({
            success: true,
            message: 'Пароль успішно змінено'
        });

    } catch (error) {
        console.error('Критична помилка при скиданні пароля:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Внутрішня помилка сервера'
        });
    }
};