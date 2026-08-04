import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  listTeam,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getTeamMemberPermissions,
  updateTeamMemberPermissions,
  getPermissionOptions,
} from "../controllers/team.controller";

const router = Router();

router.use(authenticateToken);

router.get("/", listTeam);
router.post("/", createTeamMember);
router.patch("/:id", updateTeamMember);
router.delete("/:id", deleteTeamMember);
router.get("/permission-options", getPermissionOptions);
router.get("/:id/permissions", getTeamMemberPermissions);
router.put("/:id/permissions", updateTeamMemberPermissions);

export default router;
