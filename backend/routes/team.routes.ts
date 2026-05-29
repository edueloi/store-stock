import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import { listTeam, createTeamMember, updateTeamMember, deleteTeamMember } from "../controllers/team.controller";

const router = Router();

router.use(authenticateToken);

router.get("/", listTeam);
router.post("/", createTeamMember);
router.patch("/:id", updateTeamMember);
router.delete("/:id", deleteTeamMember);

export default router;
