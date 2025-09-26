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
let PASSWORD = process.env.PASSWORD || "password"; // Make this mutable
const BASE_PATH = ""; // Changed from "/file-manager" to "" for shared hosting
const DATA_DIR = path.join(__dirname, "data");

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});

// Security middleware
function authenticate(req, res, next) {
  const auth = req.headers["x-auth"] || req.query.key;
  if (auth !== PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Path security helpers
function sanitizePath(filePath) {
  // Remove any path traversal attempts
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

function isValidFilename(filename) {
  // Check for dangerous characters
  const dangerous = /[<>:"|?*\x00-\x1f]/;
  return (
    filename &&
    !dangerous.test(filename) &&
    filename.length > 0 &&
    filename.length < 255
  );
}

// Multer configuration for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use DATA_DIR as temp destination, we'll move files later in the route handler
    cb(null, DATA_DIR);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizePath(file.originalname);
    if (!isValidFilename(sanitized)) {
      return cb(new Error("Invalid filename"));
    }
    // Use a temporary filename with timestamp to avoid conflicts
    const tempName = `temp_${Date.now()}_${sanitized}`;
    cb(null, tempName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10, // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Optional: Add file type restrictions here
    cb(null, true);
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(BASE_PATH, express.static("public"));

// Debug: Log all API routes being registered
console.log(`🔧 Registering API routes with BASE_PATH: "${BASE_PATH}"`);
console.log(`🔧 API endpoints will be: ${BASE_PATH}/api/*`);

// API Routes - all protected by authentication

// List files and directories
app.get(`${BASE_PATH}/api/files`, authenticate, async (req, res) => {
  try {
    const requestPath = req.query.path || "";
    const fullPath = getSecurePath(requestPath);

    const items = await fs.readdir(fullPath);
    const files = [];

    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const stats = await fs.stat(itemPath);

      files.push({
        name: item,
        path: requestPath
          ? path.join(requestPath, item).replace(/\\/g, "/")
          : item,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        permissions: "0" + (stats.mode & parseInt("777", 8)).toString(8),
      });
    }

    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ files, currentPath: requestPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload files
app.post(
  `${BASE_PATH}/api/upload`,
  authenticate,
  upload.array("files", 10),
  async (req, res) => {
    try {
      const uploadedFiles = [];
      const targetDir = getSecurePath(req.body.path || "");

      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Handle folder structure preservation
      if (req.body.preserveStructure === "true" && req.body.relativePaths) {
        const relativePaths = Array.isArray(req.body.relativePaths)
          ? req.body.relativePaths
          : [req.body.relativePaths];

        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const relativePath = relativePaths[i];

          if (relativePath) {
            const finalPath = path.join(targetDir, sanitizePath(relativePath));

            // Create directory structure if needed
            const finalDir = path.dirname(finalPath);
            await fs.mkdir(finalDir, { recursive: true });

            // Move file from temp location to final location
            await fs.rename(file.path, finalPath);

            uploadedFiles.push({
              name: path.basename(finalPath),
              size: file.size,
              path: relativePath,
            });
          }
        }
      } else {
        // Regular file upload - move files to target directory
        for (const file of req.files) {
          const originalName = file.filename.replace(/^temp_\d+_/, ""); // Remove temp prefix
          const finalPath = path.join(targetDir, originalName);

          // Move file from temp location to final location
          await fs.rename(file.path, finalPath);

          uploadedFiles.push({
            name: originalName,
            size: file.size,
          });
        }
      }

      // Handle zip extraction if requested
      if (req.body.extract === "true") {
        for (const uploadedFile of uploadedFiles) {
          const filePath = path.join(targetDir, uploadedFile.name);
          if (path.extname(uploadedFile.name).toLowerCase() === ".zip") {
            await extractZip(filePath, targetDir);
            await fs.unlink(filePath); // Remove the zip after extraction
          }
        }
      }

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

// Download file or create zip
app.get(`${BASE_PATH}/api/download`, authenticate, async (req, res) => {
  try {
    const filePaths = Array.isArray(req.query.files)
      ? req.query.files
      : [req.query.files];

    if (filePaths.length === 1) {
      const filePath = getSecurePath(filePaths[0]);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        return res.download(filePath);
      }
    }

    // Create zip for multiple files or folders
    const archive = archiver("zip", { zlib: { level: 9 } });

    res.attachment("download.zip");
    archive.pipe(res);

    for (const filePath of filePaths) {
      const fullPath = getSecurePath(filePath);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        archive.directory(fullPath, path.basename(fullPath));
      } else {
        archive.file(fullPath, { name: path.basename(fullPath) });
      }
    }

    await archive.finalize();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file/folder
app.post(`${BASE_PATH}/api/rename`, authenticate, async (req, res) => {
  try {
    const { oldPath, newName } = req.body;

    if (!isValidFilename(newName)) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const oldFullPath = getSecurePath(oldPath);
    const newFullPath = path.join(
      path.dirname(oldFullPath),
      sanitizePath(newName)
    );

    await fs.rename(oldFullPath, newFullPath);
    res.json({ message: "Renamed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file/folder
app.delete(`${BASE_PATH}/api/delete`, authenticate, async (req, res) => {
  try {
    const filePaths = Array.isArray(req.body.files)
      ? req.body.files
      : [req.body.files];

    for (const filePath of filePaths) {
      const fullPath = getSecurePath(filePath);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        await fs.rmdir(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purge all files (DANGEROUS OPERATION)
app.post(`${BASE_PATH}/api/purge-all`, authenticate, async (req, res) => {
  try {
    console.log(
      "⚠️  PURGE OPERATION INITIATED - This will delete ALL files in data directory"
    );

    // Get all items in the data directory
    const items = await fs.readdir(DATA_DIR);
    let deletedCount = 0;
    let errors = [];

    for (const item of items) {
      try {
        const fullPath = path.join(DATA_DIR, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // Recursively delete directory using fs.rm (newer method)
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          // Delete file
          await fs.unlink(fullPath);
        }
        deletedCount++;
      } catch (error) {
        errors.push(`Failed to delete ${item}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.log("Purge completed with some errors:", errors);
      res.json({
        success: true,
        message: `Purge completed. Deleted ${deletedCount} items with ${errors.length} errors.`,
        errors: errors,
      });
    } else {
      console.log(
        `✅ Purge completed successfully. Deleted ${deletedCount} items.`
      );
      res.json({
        success: true,
        message: `Purge completed successfully. Deleted ${deletedCount} items.`,
        deletedCount: deletedCount,
      });
    }
  } catch (error) {
    console.error("Purge operation failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Change permissions (CHMOD)
app.post(`${BASE_PATH}/api/chmod`, authenticate, async (req, res) => {
  try {
    const { filePath, mode } = req.body;

    // Validate octal mode (e.g., 644, 755)
    if (!/^[0-7]{3}$/.test(mode)) {
      return res.status(400).json({
        error: "Invalid permission mode. Use 3-digit octal like 644 or 755",
      });
    }

    const fullPath = getSecurePath(filePath);
    await fs.chmod(fullPath, parseInt(mode, 8));
    res.json({ message: "Permissions changed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create directory
app.post(`${BASE_PATH}/api/mkdir`, authenticate, async (req, res) => {
  try {
    const { path: dirPath, name } = req.body;

    if (!isValidFilename(name)) {
      return res.status(400).json({ error: "Invalid directory name" });
    }

    const fullPath = path.join(
      getSecurePath(dirPath || ""),
      sanitizePath(name)
    );
    await fs.mkdir(fullPath, { recursive: true });
    res.json({ message: "Directory created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create file
app.post(`${BASE_PATH}/api/create-file`, authenticate, async (req, res) => {
  try {
    const { path: dirPath, name, content = "" } = req.body;

    // Extra validation: name must not be empty, ".", or ".."
    if (!isValidFilename(name) || !name || name === "." || name === "..") {
      return res.status(400).json({ error: "Invalid file name" });
    }

    const fullPath = path.join(
      getSecurePath(dirPath || ""),
      sanitizePath(name)
    );

    // Prevent writing to the data directory itself
    if (fullPath === getSecurePath(dirPath || "")) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file already exists or is a directory
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        return res
          .status(400)
          .json({ error: "A directory with that name already exists" });
      }
      return res.status(400).json({ error: "File already exists" });
    } catch {
      // File doesn't exist, which is what we want
    }

    await fs.writeFile(fullPath, content, "utf8");
    res.json({ message: "File created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read file content
app.get(`${BASE_PATH}/api/read-file`, authenticate, async (req, res) => {
  try {
    const reqPath = req.query.path;
    if (
      !reqPath ||
      reqPath === "." ||
      reqPath === "/" ||
      reqPath === "\\" ||
      reqPath === "data" ||
      reqPath === "/data" ||
      reqPath === "\\data"
    ) {
      return res.status(400).json({ error: "Invalid or empty file path" });
    }
    const filePath = getSecurePath(reqPath);

    // Prevent reading the data directory itself
    if (filePath === DATA_DIR) {
      return res
        .status(400)
        .json({ error: "Cannot read the data directory as a file" });
    }

    // Check if file exists and is readable
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: "Cannot read directory as file" });
    }

    // Check file size (limit to 1MB for text editing)
    if (stats.size > 1024 * 1024) {
      return res
        .status(400)
        .json({ error: "File too large to edit (max 1MB)" });
    }

    const content = await fs.readFile(filePath, "utf8");
    res.json({ content });
  } catch (error) {
    if (error.code === "ENOENT") {
      res.status(404).json({ error: "File not found" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Save file content
app.post(`${BASE_PATH}/api/save-file`, authenticate, async (req, res) => {
  try {
    const { path: filePath, content } = req.body;

    if (typeof content !== "string") {
      return res.status(400).json({ error: "Content must be a string" });
    }

    const fullPath = getSecurePath(filePath);

    // Ensure the directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    await fs.writeFile(fullPath, content, "utf8");
    res.json({ message: "File saved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password endpoint
app.post(`${BASE_PATH}/api/change-password`, authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate current password
    if (currentPassword !== PASSWORD) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters long",
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        error: "New password must be different from current password",
      });
    }

    // Update .env file
    const envPath = path.join(__dirname, ".env");
    let envContent = "";

    try {
      // Read existing .env file if it exists
      envContent = await fs.readFile(envPath, "utf8");
    } catch (error) {
      // .env file doesn't exist, create new content
      envContent = "";
    }

    // Update or add PASSWORD line
    const lines = envContent.split("\n");
    let passwordLineFound = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("PASSWORD=")) {
        lines[i] = `PASSWORD=${newPassword}`;
        passwordLineFound = true;
        break;
      }
    }

    if (!passwordLineFound) {
      lines.push(`PASSWORD=${newPassword}`);
    }

    // Write updated .env file
    await fs.writeFile(envPath, lines.join("\n"));

    // Update the PASSWORD variable in memory (no restart needed!)
    PASSWORD = newPassword;

    console.log(
      `✅ Password changed successfully. New password active immediately.`
    );

    res.json({
      success: true,
      message: "Password changed successfully and is now active!",
    });

    // No server restart needed!
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password: " + error.message,
    });
  }
});

// Helper function to extract zip files
function extractZip(zipPath, extractPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();
      zipfile.on("entry", async (entry) => {
        const entryPath = path.join(extractPath, sanitizePath(entry.fileName));

        if (entry.fileName.endsWith("/")) {
          await fs.mkdir(entryPath, { recursive: true });
          zipfile.readEntry();
        } else {
          await fs.mkdir(path.dirname(entryPath), { recursive: true });
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);

            const writeStream = createWriteStream(entryPath);
            readStream.pipe(writeStream);
            writeStream.on("close", () => zipfile.readEntry());
          });
        }
      });

      zipfile.on("end", resolve);
      zipfile.on("error", reject);
    });
  });
}

// Error handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large" });
    }
  }
  res.status(500).json({ error: error.message });
});

// Redirect root to file manager (fix for empty BASE_PATH)
app.get("/", (req, res) => {
  if (BASE_PATH) {
    res.redirect(BASE_PATH);
  } else {
    // For empty BASE_PATH, serve the index.html directly
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

app.listen(PORT, () => {
  console.log(
    `🌐 Evernode File Manager running on http://localhost:${PORT}${BASE_PATH}`
  );
  console.log(`🔐 Password: ${PASSWORD}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
});
