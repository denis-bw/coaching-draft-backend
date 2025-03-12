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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Попередження безпеки</title>
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
        h2 {
          color: #e74c3c;
          margin-top: 0;
          margin-bottom: 20px;
          font-weight: 600;
        }
        .content {
          padding: 20px 0;
        }
        .alert-icon {
          font-size: 40px;
          text-align: center;
          margin-bottom: 20px;
        }
        .warning-box {
          background-color: #ffebee;
          border-left: 4px solid #e74c3c;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
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
        .email-highlight {
          font-weight: bold;
          background-color: #f8f9fa;
          padding: 2px 5px;
          border-radius: 3px;
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
          <!-- <img src="your-logo-url.png" alt="Coach's Sketch" height="50"> -->
          <h2>⚠️ Попередження безпеки</h2>
        </div>
        <div class="content">
          <div class="warning-box">
            <p>Зафіксовано велику кількість невдалих спроб входу до вашого облікового запису <span class="email-highlight">${email}</span>.</p>
          </div>
          
          <p>Шановний користувачу,</p>
          
          <p>Ми помітили незвичну активність, пов'язану з вашим обліковим записом Coach's Sketch. Хтось здійснив кілька невдалих спроб увійти у ваш акаунт.</p>
          
          <p><strong>Якщо це були ви</strong>, переконайтеся, що ви використовуєте правильні дані для входу або скористайтеся функцією відновлення пароля.</p>
          
          <p><strong>Якщо це були не ви</strong>, вам рекомендовано негайно змінити пароль для захисту вашого облікового запису.</p>
          
          <div style="text-align: center;">
            <a href="https://denis-bw.github.io/coaching-draft/forgot-password" class="button">Змінити пароль</a>
          </div>
          
          <p>Для додаткової безпеки ми рекомендуємо:</p>
          <ul>
            <li>Використовувати складний пароль</li>
            <li>Не використовувати однаковий пароль на різних сайтах</li>
          </ul>
          
          <p>Якщо у вас виникли запитання або вам потрібна допомога, будь ласка, зв'яжіться з нашою службою підтримки.</p>
        </div>
        <div class="footer">
          <p>Це автоматичний лист, будь ласка, не відповідайте на нього.</p>
          <p>© ${new Date().getFullYear()} Coach's Sketch. Всі права захищені.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  text: `Coach's Sketch: ПОПЕРЕДЖЕННЯ БЕЗПЕКИ - Хтось намагається увійти у ваш акаунт (${email}). Якщо це не ви, рекомендуємо негайно змінити пароль на https://yourwebsite.com/reset-password. © ${new Date().getFullYear()} Coach's Sketch. Всі права захищені.`
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

