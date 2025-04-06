import express from 'express';
import { updateUserProfile } from '../../controllers/user-profile-controller.js';
import { handleImageUpload } from "../../middlewares/imageProcessing.js";
import authenticate from "../../middlewares/authenticate.js";

const profileRouter = express.Router();

profileRouter.put('/users/updateprofile',
    authenticate,
    handleImageUpload('avatar'),
    updateUserProfile
);

export default profileRouter;

