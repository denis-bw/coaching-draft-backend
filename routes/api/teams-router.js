import express from "express";
import authenticate from "../../middlewares/authenticate.js";
import { handleImageUpload } from "../../middlewares/imageProcessing.js";
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addAthletesToTeam,
  removeAthletesFromTeam
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

teamsRouter.patch("/:teamId/athletes/add", authenticate, addAthletesToTeam);

teamsRouter.patch("/:teamId/athletes/remove", authenticate, removeAthletesFromTeam);

export default teamsRouter;