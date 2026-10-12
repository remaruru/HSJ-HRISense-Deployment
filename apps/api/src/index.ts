import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { env } from './config/env';
import { globalApiLimiter } from "./middleware/rate-limit";
import { requestId } from "./middleware/request-id";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Proxy configuration ────────────────────────────────────────────────────
// Explicit and environment-driven. `trust proxy: true` is deliberately NOT used:
// blindly trusting X-Forwarded-For lets a client spoof its IP and defeat the
// rate limiters. Set TRUST_PROXY to the number of proxy hops (e.g. 1) or to a
// specific address/subnet when deploying behind a reverse proxy.
const trustProxy = env.TRUST_PROXY;
if (trustProxy) {
  const numericHops = Number(trustProxy);
  app.set("trust proxy", Number.isInteger(numericHops) ? numericHops : trustProxy);
}

// Every request gets a short reference first, so even a request refused by a
// later middleware can be traced in the log.
app.use(requestId);

// ─── Security Middleware ────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";

app.use(
  helmet({
    // The API serves JSON and file streams, never HTML, so a restrictive CSP is
    // safe here and does not affect the Vite dev server.
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    // The web app runs on another origin, so it can only read these if listed:
    // the wait before retrying a rate-limited request, the error reference, and
    // a download's file name.
    exposedHeaders: ["Retry-After", "X-Request-Id", "Content-Disposition"],
  })
);

// Global flood guard: every /api/v1 request, per IP (the live notification
// stream excepted). Per-user, per-category limits — reads, writes, search,
// uploads, imports, exports, sign-in — are applied after authentication; all
// values live in config/rate-limits.ts. Development gets higher ceilings rather
// than none, so the limiters always run on the path they run in production.
app.use(globalApiLimiter);

// ─── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Static Files ───────────────────────────────────────────────────────────
// NOTE: uploads/ directories are intentionally NOT served as static files.
// All protected documents (training, medical, psychological, announcements) are
// streamed exclusively through authenticated API routes. This prevents
// unauthenticated access to sensitive files via direct URL enumeration.


// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      service: "HRISense API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    },
  });
});

import apiRouter from "./routes";
import { endNotificationStreams } from "./routes/notification.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// ─── API Routes ─────────────────────────────────────────────────────────────
// Every /api/v1 route group is registered in ./routes/index.ts. Mounting them
// here as well previously registered /api/v1/departments twice.
app.use("/api/v1", apiRouter);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────────────────────
import { prisma } from "./config/prisma";

const server = app.listen(PORT, () => {
  console.log(`\n🏥 HRISense API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔒 CORS: ${process.env.CLIENT_URL || "http://localhost:3000"}\n`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ HRISense API could not start because port ${PORT} is already in use.`);
    console.error(`Please stop the existing HRISense API/dev process before starting another one.\n`);
    process.exit(1);
  } else {
    console.error('\n❌ Server failed to start:', err);
    process.exit(1);
  }
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Live notification streams never finish on their own; end them so the
  // server can close straight away instead of waiting out the timeout.
  endNotificationStreams();

  server.close(async (err) => {
    if (err) {
      console.error('Error during HTTP server close:', err);
    }
    console.log('HTTP server closed. Disconnecting Prisma...');
    
    try {
      await prisma.$disconnect();
      console.log('Prisma disconnected successfully.');
    } catch (dbErr) {
      console.error('Error disconnecting Prisma:', dbErr);
    }
    
    console.log('Graceful shutdown complete. Exiting.');
    process.exit(err ? 1 : 0);
  });
  
  // Fallback timeout in case server.close or prisma disconnect hangs
  setTimeout(() => {
    console.error('Forcing shutdown after 5 seconds due to timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('\n💥 FATAL: Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 FATAL: Unhandled Promise Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;
