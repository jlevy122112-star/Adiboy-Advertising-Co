import { v4 as uuid } from "uuid";

const jobs = {};
const MAX_JOBS = 5000;
const JOB_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function queueJob(payload) {
  const currentJobs = Object.keys(jobs).length;
  if (currentJobs >= MAX_JOBS) {
    throw new Error("Job queue is full");
  }

  const id = uuid();
  const now = Date.now();

  jobs[id] = {
    status: "pending",
    artifacts: null,
    error: null,
    payload,
    createdAt: now,
  };

  return id;
}

export function completeJob(id, artifacts) {
  if (!jobs[id]) return;
  jobs[id].status = "complete";
  jobs[id].artifacts = artifacts;
}

export function failJob(id, error) {
  if (!jobs[id]) return;
  jobs[id].status = "error";
  jobs[id].error = error;
}

export function getJob(id) {
  const job = jobs[id];
  if (!job) return null;

  const expired = Date.now() - job.createdAt > JOB_TTL_MS;
  if (expired) {
    delete jobs[id];
    return null;
  }

  return job;
}
