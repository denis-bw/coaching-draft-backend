import express from 'express';
import { register, signin, logout, getCurrent } from '../../controllers/auth-controller.js'; 

import authenticate from "../../middlewares/authenticate.js";


const authRouter = express.Router();

authRouter.post('/users/register', register);
authRouter.post('/users/login', signin);
authRouter.get('/users/current', authenticate, getCurrent);
authRouter.post('/users/logout', authenticate, logout);


export default authRouter;
