import "./types/index.js";

import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookie from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { loadConfig } from "./config/index.js";
import { registerRoutes } from "./routes/index.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createLogger, logger, setRootLogger } from "./logger.js";
import SessionsService from "./services/sessions.js";
import SocketServer from "./services/socket.js";

export async function startServer() {
  const config = loadConfig();
  const rootLogger = createLogger(config);
  setRootLogger(rootLogger);

  const dev = config.nodeEnv !== "production";
  const port = config.port;

  const app = express();
  const httpServer = createServer(app);

  // Middleware
  app.use(requestLogger(rootLogger));
  app.use(express.json({ limit: "50mb" }));
  app.use(cookie(config.sessionSecret));
  app.use("/uploads/", express.static(path.join(__dirname, "../uploads")));

  if (dev) {
    app.use(
      cors({
        origin: config.corsOrigins,
        credentials: true,
        exposedHeaders: ["set-cookie"],
      }),
    );
  } else {
    const clientPath = path.join(__dirname, "../../client-dist");
    app.use(express.static(clientPath));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(clientPath, "index.html"));
    });
  }

  const sessions = SessionsService.prototype.getInstance();
  sessions.loadToServer(app);

  registerRoutes(app);
  httpServer.listen(port, () => {
    rootLogger.info(`[SERVER] Listening on port ${port}`);
  });

  const socketServer = SocketServer.getInstance();
  socketServer.loadToServer(httpServer);
}

startServer().catch((error) => {
  logger.error({ err: error }, "Failed to start server");
  process.exit(1);
});
