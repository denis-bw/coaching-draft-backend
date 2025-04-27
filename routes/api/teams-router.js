import express from "express";
import authenticate from "../../middlewares/authenticate.js";
import { handleImageUpload } from "../../middlewares/imageProcessing.js";
import { createTeam,  getTeams } from "../../controllers/teams-controller.js";

const teamsRouter = express.Router();

teamsRouter.post(
  "/create",
  authenticate,
  handleImageUpload("team-logo"),
  createTeam
);

teamsRouter.get("/all", authenticate, getTeams);

export default teamsRouter;
