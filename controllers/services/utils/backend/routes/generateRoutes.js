import express from "express";
import { startGeneration, getGenerationStatus } from "../controllers/generateController.js";

const router = express.Router();

router.post("/", startGeneration);
router.get("/status/:id", getGenerationStatus);

export default router;
