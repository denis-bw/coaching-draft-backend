import express from 'express';
import { register, signin, logout, getCurrent, sendResetPasswordEmail, resetPassword } from '../../controllers/auth-controller.js'; 

import authenticate from "../../middlewares/authenticate.js";

import { loginLimiter, emailLimiter } from '../../middlewares/authPassword.js';


const authRouter = express.Router();

authRouter.post('/users/register', register);
authRouter.post('/users/login', loginLimiter, emailLimiter, signin);
authRouter.get('/users/current', authenticate, getCurrent);
authRouter.post('/users/logout', authenticate, logout);
authRouter.post("/users/forgot-password", sendResetPasswordEmail);
authRouter.post("/users/reset-password", resetPassword)


export default authRouter;
