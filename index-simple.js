const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const multer = require("multer");
const archiver = require("archiver");
const yauzl = require("yauzl");
const { createReadStream, createWriteStream } = require("fs");

// Load environment variables
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
let PASSWORD = process.env.PASSWORD || "password";
const DATA_DIR = path.join(__dirname, "data");

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware
function authenticate(req, res, next) {
  const auth = req.headers["x-auth"] || req.query.key;
  console.log("Auth attempt:", {
    header: req.headers["x-auth"] ? "[PRESENT]" : "[MISSING]",
    query: req.query.key ? "[PRESENT]" : "[MISSING]",
    expected: PASSWORD,
  });

  if (auth !== PASSWORD) {
    console.log("Authentication failed");
    return res.status(401).json({ error: "Unauthorized" });
  }
  console.log("Authentication successful");
  next();
}

// Path security helpers
function sanitizePath(filePath) {
  const normalized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
  return normalized
    .split(path.sep)
    .filter((p) => p && p !== "." && p !== "..")
    .join(path.sep);
}

function getSecurePath(relativePath = "") {
  const sanitized = sanitizePath(relativePath);
  return path.join(DATA_DIR, sanitized);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = req.body.path ? getSecurePath(req.body.path) : DATA_DIR;
    fs.mkdir(uploadPath, { recursive: true })
      .then(() => cb(null, uploadPath))
      .catch((err) => cb(err));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Serve static files
app.use(express.static("public"));

// API Routes
console.log("🔧 Setting up API routes...");

// Test endpoint
app.get("/api/test", (req, res) => {
  console.log("✅ Test endpoint called");
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date(),
  });
});

// List files endpoint
app.get("/api/files", authenticate, async (req, res) => {
  console.log("📂 Files endpoint called, path:", req.query.path);
  try {
    const requestPath = req.query.path || "";
    const fullPath = getSecurePath(requestPath);

    const items = await fs.readdir(fullPath);
    const fileInfo = [];

    for (const item of items) {
      try {
        const itemPath = path.join(fullPath, item);
        const stats = await fs.stat(itemPath);

        fileInfo.push({
          name: item,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.size,
          modified: stats.mtime.toISOString(),
          permissions: "755", // Simplified for demo
        });
      } catch (error) {
        console.error(`Error reading ${item}:`, error.message);
      }
    }

    console.log(`✅ Returning ${fileInfo.length} items`);
    res.json({ files: fileInfo, path: requestPath });
  } catch (error) {
    console.error("Files endpoint error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Upload endpoint
app.post(
  "/api/upload",
  authenticate,
  upload.array("files"),
  async (req, res) => {
    console.log("📤 Upload endpoint called");
    try {
      const uploadedFiles = req.files.map((file) => ({
        name: file.filename,
        size: file.size,
        path: file.path,
      }));

      console.log(`✅ Uploaded ${uploadedFiles.length} files`);
      res.json({
        message: "Files uploaded successfully",
        files: uploadedFiles,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Create file endpoint
app.post("/api/create-file", authenticate, async (req, res) => {
  console.log("📄 Create file endpoint called");
  try {
    const { fileName, path: filePath } = req.body;
    const fullPath = getSecurePath(
      filePath ? `${filePath}/${fileName}` : fileName
    );

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "", "utf8");

    console.log(`✅ Created file: ${fileName}`);
    res.json({ message: "File created successfully" });
  } catch (error) {
    console.error("Create file error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create directory endpoint
app.post("/api/mkdir", authenticate, async (req, res) => {
  console.log("📁 Create directory endpoint called");
  try {
    const { folderName, path: currentPath } = req.body;
    const fullPath = getSecurePath(
      currentPath ? `${currentPath}/${folderName}` : folderName
    );

    await fs.mkdir(fullPath, { recursive: true });

    console.log(`✅ Created directory: ${folderName}`);
    res.json({ message: "Directory created successfully" });
  } catch (error) {
    console.error("Create directory error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete endpoint
app.delete("/api/delete", authenticate, async (req, res) => {
  console.log("🗑️ Delete endpoint called");
  try {
    const { paths } = req.body;

    for (const filePath of paths) {
      const fullPath = getSecurePath(filePath);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }

    console.log(`✅ Deleted ${paths.length} items`);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Root route
app.get("/", (req, res) => {
  console.log("🏠 Root endpoint called");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Catch all other routes
app.use("*", (req, res) => {
  console.log(`❓ Unknown route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
});

// Start server
app.listen(PORT, () => {
  console.log("🚀 =====================================");
  console.log(`🌐 DASH COMMANDER Server Started`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`🔐 Password: ${PASSWORD}`);
  console.log(`📁 Data Directory: ${DATA_DIR}`);
  console.log(`🔧 API Endpoints:`);
  console.log(`   GET  /api/test`);
  console.log(`   GET  /api/files`);
  console.log(`   POST /api/upload`);
  console.log(`   POST /api/create-file`);
  console.log(`   POST /api/mkdir`);
  console.log(`   DELETE /api/delete`);
  console.log("🚀 =====================================");
});

module.exports = app;
