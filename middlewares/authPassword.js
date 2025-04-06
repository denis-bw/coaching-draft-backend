
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
    subject: "🔒 Попередження безпеки: виявлено підозрілу активність",
    html: `
      <!DOCTYPE html>
      <html lang="uk">
      <head>
        <meta charset="UTF-8">
        <title>Попередження безпеки</title>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .warning { color: red; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="warning">⚠️ Попередження безпеки</h2>
          <p>Зафіксовано велику кількість невдалих спроб входу до вашого облікового запису ${email}.</p>
          <p>Якщо це були не ви, рекомендуємо негайно змінити пароль.</p>
          <a href="https://denis-bw.github.io/coaching-draft/forgot-password">Змінити пароль</a>
        </div>
      </body>
      </html>
    `,
    text: `Попередження безпеки: Виявлено підозрілу активність на вашому акаунті ${email}.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email відправлено на ${email}`);
  } catch (error) {
    console.error("Помилка при надсиланні email:", error);
  }
};

const createEmailLimiter = () => {
  return rateLimit({
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
};

const createLoginLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: { message: "Забагато спроб входу з вашого IP, спробуйте пізніше." },
  });
};

let emailLimiterInstance = createEmailLimiter();
let loginLimiterInstance = createLoginLimiter();

const emailLimiter = (req, res, next) => emailLimiterInstance(req, res, next);
const loginLimiter = (req, res, next) => loginLimiterInstance(req, res, next);

const resetUserLimiter = (email) => {
  console.log(`Скидання лімітерів для користувача ${email}`);
  
  emailLimiterInstance = createEmailLimiter();
  loginLimiterInstance = createLoginLimiter();
 
  if (email) {
    sentEmails.delete(email);
  }
};

export { loginLimiter, emailLimiter, resetUserLimiter };