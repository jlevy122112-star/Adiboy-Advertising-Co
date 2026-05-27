import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory job store
const jobs = {};

// Simulate AI generation (replace with OpenAI/Gemini later)
async function fakeGenerateArtifacts(payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: "copy",
          title: "Primary Copy",
          type: "copy",
          content: `Generated copy for ${payload.brand} targeting ${payload.audience}`,
        },
        {
          id: "image",
          title: "Image Variation",
          type: "image",
          url: "https://placehold.co/600x400",
        },
        {
          id: "hashtags",
          title: "Hashtags",
          type: "hashtags",
          tags: ["#marketing", "#ai", "#cinematic"],
        },
      ]);
    }, 2500);
  });
}

// POST /generate
app.post("/generate", async (req, res) => {
  const payload = req.body;

  const requestId = uuid();

  // Store job as pending
  jobs[requestId] = {
    status: "pending",
    artifacts: null,
    error: null,
  };

  // Start async generation
  fakeGenerateArtifacts(payload)
    .then((artifacts) => {
      jobs[requestId].status = "complete";
      jobs[requestId].artifacts = artifacts;
    })
    .catch((err) => {
      jobs[requestId].status = "error";
      jobs[requestId].error = err.message;
    });

  res.json({ requestId, status: "pending" });
});

// GET /generate/status/:id
app.get("/generate/status/:id", (req, res) => {
  const id = req.params.id;

  if (!jobs[id]) {
    return res.status(404).json({
      requestId: id,
      status: "error",
      error: "Invalid request ID",
    });
  }

  res.json({
    requestId: id,
    status: jobs[id].status,
    artifacts: jobs[id].artifacts,
    error: jobs[id].error,
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[BACKEND] Running on http://localhost:${PORT}`);
});
