
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const userRoutes = require("./routes/users");

const app = express();

app.disable("x-powered-by");

// Render is the trusted reverse proxy in production.
// Do not trust arbitrary client-supplied forwarding headers.
const production = process.env.NODE_ENV === "production";

if (production) {
  app.set("trust proxy", 1);
}

const allowedOrigins = new Set(
  [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://thoughtsnapp.vercel.app",
    process.env.FRONTEND_URL
  ].filter(Boolean)
);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        (!production &&
          /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
      ) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "ThoughtSnap API",
    status: "running"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ThoughtSnap API is healthy"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  const isCorsError = err.message === "Origin not allowed by CORS";

  res.status(err.status || 500).json({
    success: false,
    message: isCorsError
      ? "This origin is not allowed"
      : "An unexpected server error occurred"
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }

    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`ThoughtSnap API listening on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
