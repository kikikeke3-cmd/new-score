import express from "express";
import path from "path";
import dotenv from "dotenv";
import { handleApiRequest } from "./server/apiRouter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API route middleware
app.use("/api", (req, res, next) => {
  handleApiRequest(req, res, next);
});

// Serve static frontend build
app.use(express.static(path.join(process.cwd(), "dist")));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
