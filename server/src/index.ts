import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router } from "./routes.js";
import { startScheduler } from "./scheduler.js";

const app = express();
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(","), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", router);
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API on :${port}`));
startScheduler();
