import express from "express";
import authenticate from "../../middlewares/authenticate.js";
import { handleImageUpload } from "../../middlewares/imageProcessing.js";
import { createAthlete, getAthleteById, searchAthletes, searchTeamAthletes } from "../../controllers/athletes-controller.js";

const athletesRouter = express.Router();

athletesRouter.post(
  "/create",
  authenticate,
  handleImageUpload("athlete-avatar"), 
  createAthlete
);

athletesRouter.get('/search', authenticate, searchAthletes);

athletesRouter.get('/team/:teamId/search', authenticate, searchTeamAthletes);

athletesRouter.get(
  "/:athleteId",
  authenticate,
  getAthleteById
);

export default athletesRouter;