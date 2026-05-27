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
