import express from 'express';
import {  updateUserProfile } from '../../controllers/user-profile-controller.js'; 

import authenticate from "../../middlewares/authenticate.js";


const profileRouter = express.Router();


profileRouter.put('/users/updateprofile', authenticate, updateUserProfile);

export default profileRouter;
