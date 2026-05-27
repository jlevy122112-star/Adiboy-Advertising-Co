import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import generateRoutes from "./routes/generateRoutes.js";

const app = express();

// security headers
app.use(helmet());

// logging
app.use(morgan("combined"));

// rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per IP per minute
});
app.use(limiter);

// body parsing
app.use(express.json({ limit: "1mb" }));

// CORS – lock this to your real frontend domain later
app.use(
  cors({
    origin: ["http://localhost:5173", "https://your-frontend-domain.com"],
    methods: ["GET", "POST"],
  })
);

// routes
app.use("/generate", generateRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// error handler
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[BACKEND] Hardened API running on http://localhost:${PORT}`);
});
