import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const sentEmails = new Set(); 

const sendEmailAlert = async (email) => {
  const { EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: email,
    subject: "Попередження про велику кількість невдалих спроб входу",
    text: `Coach's Sketch. Хтось намагається увійти у ваш акаунт (${email}). Якщо це не ви, рекомендуємо змінити пароль.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email відправлено на ${email}`);
  } catch (error) {
    console.error("Помилка при надсиланні email:", error);
  }
};

const emailLimiter = rateLimit({
  keyGenerator: (req) => req.body.email, 
  windowMs: 15 * 60 * 1000, 
  max: 5,
  message: { message: "Забагато спроб входу для цього акаунту, спробуйте пізніше." },
  handler: async (req, res, next) => {
    const email = req.body.email;
    if (email && !sentEmails.has(email)) {
      await sendEmailAlert(email);
      sentEmails.add(email); 
      setTimeout(() => sentEmails.delete(email), 15 * 60 * 1000); 
    }
    res.status(429).json({ message: "Забагато спроб входу для цього акаунту, спробуйте пізніше." });
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: { message: "Забагато спроб входу з вашого IP, спробуйте пізніше." },
});

export { loginLimiter, emailLimiter };

