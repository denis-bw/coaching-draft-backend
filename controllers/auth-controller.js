import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import 'dotenv/config';
import { db } from '../firebaseAdminConfig.js'; 
import { userSignupSchema, userSigninSchema, userEmailSchema } from '../models/user.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import qs from "query-string"
import axios from "axios";


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
      resetToken: null,
      resetTokenExpiry: null,
      location: null,
      dateOfBirth: null,
      avatar: null,
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
      location: null,
      dateOfBirth: null,
      avatar: null,
      token,
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
          location: user.location,
          dateOfBirth:  user.dateOfBirth,
          avatar:  user.avatar,
          token: user.token,
        });
      } catch (err) {
        console.log('Token expired or invalid, generating a new one');
      }
    }

    const newToken = jwt.sign({ id: userDoc.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    await userDoc.ref.update({ token: newToken });

    return res.status(200).json({
      id: userDoc.id,
      email: user.email,
      username: user.username,
      location: user.location,
      dateOfBirth:  user.dateOfBirth,
      avatar:  user.avatar,
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


export const getCurrent = async (req, res) => {
  const { email } = req.user;

  const ref = db.collection('users');
  const snapshot = await ref.where('email', '==', email.toLowerCase()).get();
  
  if (snapshot.empty) {
      return res.status(400).json({ message: 'Bad Request' });
    }

  const userDoc = snapshot.docs[0];
  const user = userDoc.data();
  
  res.json({
    email,
    username: user.username,
    location: user.location,
    dateOfBirth:  user.dateOfBirth,
    avatar:  user.avatar,
  });
};









export const sendResetPasswordEmail = async (req, res) => {
  const {EMAIL_USER, FRONTEND_URL, EMAIL_APP_PASSWORD  } = process.env;
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

      
        const resetLink = `${FRONTEND_URL}/reset-password?email=${email}&token=${resetToken}`;

        
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
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Відновлення пароля</title>
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    background-color: #f5f5f5;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #eeeeee;
                    margin-bottom: 20px;
                }
                .logo {
                    margin-bottom: 15px;
                }
                h2 {
                    color: #2c3e50;
                    margin-top: 0;
                    margin-bottom: 20px;
                    font-weight: 600;
                }
                .content {
                    padding: 20px 0;
                }
                .button {
                    background-color: #67BC8E;
                    color: white !important;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    display: inline-block;
                    margin: 20px 0;
                    text-align: center;
                    transition: background-color 0.3s ease;
                }
                .button:hover {
                    background-color: #5aa67c;
                }
                .footer {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #eeeeee;
                    color: #999999;
                    font-size: 12px;
                    text-align: center;
                }
                .time-notice {
                    font-weight: bold;
                    color: #e74c3c;
                }
                .ignore-notice {
                    margin-top: 20px;
                    color: #555555;
                }
                @media only screen and (max-width: 480px) {
                    .container {
                        padding: 10px;
                    }
                    .content {
                        padding: 10px 0;
                    }
                    .button {
                        display: block;
                        width: 100%;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <!-- Тут можна додати логотип -->
                    <!-- <img class="logo" src="your-logo-url.png" alt="Логотип компанії" height="50"> -->
                    <h2>Відновлення пароля</h2>
                </div>
                <div class="content">
                    <p>Шановний користувачу,</p>
                    <p>Ви отримали цей лист, тому що запросили відновлення пароля для вашого облікового запису.</p>
                    <p>Для встановлення нового пароля, будь ласка, натисніть на кнопку нижче:</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetLink}" class="button">Встановити новий пароль</a>
                    </div>
                    
                    <p class="time-notice">⚠️ Посилання дійсне протягом 1 години.</p>
                    
                    <p class="ignore-notice">Якщо ви не запитували відновлення пароля, проігноруйте цей лист або зверніться до служби підтримки.</p>
                </div>
                <div class="footer">
                    <p>Це автоматичний лист, будь ласка, не відповідайте на нього.</p>
                    <p>© ${new Date().getFullYear()} Coach's Sketch. Всі права захищені.</p>
                </div>
            </div>
        </body>
        </html>
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




export const googleAuth = async (req, res) => {
  const { BASE_URL, GOOGLE_CLIENT_ID } = process.env;

  const stringifiedParams = qs.stringify({
    
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE_URL}auth/users/google-redirect`,
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
  });
  
  return res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${stringifiedParams}`
  );
};

export const googleRedirect = async (req, res) => {
  const { BASE_URL,GOOGLE_CLIENT_SECRET, GOOGLE_CLIENT_ID, JWT_SECRET, FRONTEND_URL } = process.env;

  try {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const urlObj = new URL(fullUrl);
    const urlParams = qs.parse(urlObj.search);
    const code = urlParams.code;

   
    const tokenData = await axios({
      url: `https://oauth2.googleapis.com/token`,
      method: "post",
      data: {
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${BASE_URL}auth/users/google-redirect`,
        grant_type: "authorization_code",
        code,
      },
    });

    
    const userData = await axios({
      url: "https://www.googleapis.com/oauth2/v2/userinfo",
      method: "get",
      headers: {
        Authorization: `Bearer ${tokenData.data.access_token}`,
      },
    });

    
    const ref = db.collection('users');
    const snapshot = await ref
      .where('email', '==', userData.data.email.toLowerCase())
      .get();

    if (snapshot.empty) {
      return res.redirect(
      `${FRONTEND_URL}/auth/error`
    );
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    
    if (user.token) {
      try {
        const decoded = jwt.verify(user.token, JWT_SECRET);

      return res.redirect(
        `${FRONTEND_URL}/g?token=${user.token}`
      );
      } catch (err) {
        console.log('Token expired or invalid, generating a new one');
      }
    }

    const newToken = jwt.sign({ id: userDoc.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    await userDoc.ref.update({ token: newToken });
 
    return res.redirect(
      `${FRONTEND_URL}/g?token=${newToken}`
    );
  } catch (error) {
    console.error('Google Auth Error:', error);
    
    return res.redirect(
      `${FRONTEND_URL}/auth/error`
    );
  }
};