import { Router } from "express";

import {
  createCustomer,
  listCustomers,
} from "../controllers/customers.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/", listCustomers);
router.post("/", createCustomer);

export default router;
