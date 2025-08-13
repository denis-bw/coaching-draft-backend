import express from "express";
import authenticate from "../../middlewares/authenticate.js";
import { handleImageUpload } from "../../middlewares/imageProcessing.js";
import { 
  createTeam, 
  getTeams, 
  getTeamById, 
  updateTeam, 
  deleteTeam 
} from "../../controllers/teams-controller.js";

const teamsRouter = express.Router();

teamsRouter.post(
  "/create",
  authenticate,
  handleImageUpload("team-logo"),
  createTeam
);

teamsRouter.get("/all", authenticate, getTeams);
teamsRouter.get("/:teamId", authenticate, getTeamById);

teamsRouter.put(
  "/:teamId",
  authenticate,
  handleImageUpload("team-logo"),
  updateTeam
);

teamsRouter.delete("/:teamId", authenticate, deleteTeam);

export default teamsRouter;