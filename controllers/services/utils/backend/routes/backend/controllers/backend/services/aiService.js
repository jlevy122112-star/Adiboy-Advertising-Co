import { completeJob, failJob } from "./jobService.js";

export async function generateArtifacts(requestId, payload) {
  try {
    // Simulated AI delay
    await new Promise((r) => setTimeout(r, 2500));

    const artifacts = [
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
    ];

    completeJob(requestId, artifacts);
  } catch (err) {
    failJob(requestId, err.message);
  }
}
