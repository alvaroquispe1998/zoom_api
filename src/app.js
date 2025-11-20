import express from "express";
import cors from "cors";
import { cfg } from "./config/env.js";
import meetingsRouter from "./routes/meetings.route.js";
import workspacesRouter from "./routes/workspaces.route.js";
import { httpLogger } from "./logger.js";
import { errorHandler } from "./middlewares/error.js";


const app = express();
app.use(cors());
app.use(express.json());
app.use(httpLogger);


app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/meetings", meetingsRouter);
app.use("/api/workspaces", workspacesRouter);
app.use(errorHandler);


app.listen(cfg.port, () => {
console.log(`API escuchando en http://localhost:${cfg.port}`);
});


// npm run dev