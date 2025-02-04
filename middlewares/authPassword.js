import rateLimit from 'express-rate-limit';


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, 
  message: { message: "Забагато спроб входу з вашого IP, спробуйте пізніше." },
});

const emailLimiter = rateLimit({
  keyGenerator: (req) => req.body.email, 
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { message: "Забагато спроб входу для цього акаунту, спробуйте пізніше." },
});
export { loginLimiter, emailLimiter };
