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
  removeAthletesFromTeam,
  getTeamGallery,
  uploadTeamPhoto,
  deleteTeamPhoto,
  getUserStorageInfo
} from "../../controllers/teams-controller.js";

const teamsRouter = express.Router();

teamsRouter.post(
  "/create",
  authenticate,
  handleImageUpload("team-logo"),
  createTeam
);

teamsRouter.get("/all", authenticate, getTeams);

teamsRouter.get("/storage-info", authenticate, getUserStorageInfo);

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

// Маршрути для галереї команди
teamsRouter.get("/:teamId/gallery", authenticate, getTeamGallery);

teamsRouter.post(
  "/:teamId/gallery/upload",
  authenticate,
  handleImageUpload("team-photo"),
  uploadTeamPhoto
);

teamsRouter.delete("/:teamId/gallery/:photoId", authenticate, deleteTeamPhoto);

export default teamsRouter;