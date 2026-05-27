import { queueJob, getJob } from "../services/jobService.js";
import { generateArtifacts } from "../services/aiService.js";
import { validatePayload } from "../utils/validatePayload.js";

export async function startGeneration(req, res, next) {
  try {
    const payload = req.body;
    const validation = validatePayload(payload);

    if (!validation.ok) {
      return res.status(400).json({ status: "error", error: validation.error });
    }

    const requestId = queueJob(payload);
    generateArtifacts(requestId, payload);

    res.json({ requestId, status: "pending" });
  } catch (err) {
    next(err);
  }
}

export function getGenerationStatus(req, res, next) {
  try {
    const id = req.params.id;
    const job = getJob(id);

    if (!job) {
      return res.status(404).json({
        requestId: id,
        status: "error",
        error: "Invalid request ID",
      });
    }

    res.json(job);
  } catch (err) {
    next(err);
  }
}

import { queueJob, getJob } from "../services/jobService.js";
import { generateArtifacts } from "../services/aiService.js";

export async function startGeneration(req, res) {
  const payload = req.body;

  const requestId = queueJob(payload);

  // Start async generation
  generateArtifacts(requestId, payload);

  res.json({ requestId, status: "pending" });
}

export function getGenerationStatus(req, res) {
  const id = req.params.id;
  const job = getJob(id);

  if (!job) {
    return res.status(404).json({
      requestId: id,
      status: "error",
      error: "Invalid request ID",
    });
  }

  res.json(job);
}
