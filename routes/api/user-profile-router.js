import express from 'express';;
import multer from 'multer';


import {  updateUserProfile } from '../../controllers/user-profile-controller.js'; 

import authenticate from "../../middlewares/authenticate.js";

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true); 
  } else {
    cb(new Error("Дозволені лише зображення (jpeg, jpg, png, webp)"), false); 
  }
};

const upload = multer({
    dest: 'tmp',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
});

const profileRouter = express.Router();

profileRouter.put('/users/updateprofile', upload.single('avatar'), authenticate, updateUserProfile);

export default profileRouter;
