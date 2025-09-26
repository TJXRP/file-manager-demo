// Simplified File Manager JavaScript for NameCheap Deployment
let currentPath = "";
let authToken = "";
let selectedFiles = new Set();

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 DASH COMMANDER Loading...");
  initAuth();
  initDarkMode();
  initButtons();

  // Test API connection immediately
  testAPI();
});

// Initialize all button event handlers
function initButtons() {
  console.log("🔘 Initializing buttons...");

  // Upload buttons
  const uploadBtn = document.getElementById("uploadBtn");
  const uploadFolderBtn = document.getElementById("uploadFolderBtn");
  const fileInput = document.getElementById("fileInput");
  const folderInput = document.getElementById("folderInput");

  if (uploadBtn) uploadBtn.addEventListener("click", () => fileInput.click());
  if (uploadFolderBtn)
    uploadFolderBtn.addEventListener("click", () => folderInput.click());
  if (fileInput) fileInput.addEventListener("change", handleFileUpload);
  if (folderInput) folderInput.addEventListener("change", handleFolderUpload);

  // Create file/folder buttons
  const createFileBtn = document.getElementById("createFileBtn");
  const createFolderBtn = document.getElementById("createFolderBtn");
  if (createFileBtn)
    createFileBtn.addEventListener("click", () => openModal("createFileModal"));
  if (createFolderBtn)
    createFolderBtn.addEventListener("click", () =>
      openModal("createFolderModal")
    );

  // Settings and purge buttons
  const settingsBtn = document.getElementById("settingsBtn");
  const purgeBtn = document.getElementById("purgeBtn");
  if (settingsBtn) settingsBtn.addEventListener("click", openSettingsModal);
  if (purgeBtn) purgeBtn.addEventListener("click", openPurgeModal);

  // Dark mode toggle
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) darkModeToggle.addEventListener("click", toggleDarkMode);

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Auth form
  const authForm = document.getElementById("authForm");
  if (authForm)
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      login();
    });

  // Setup drag and drop
  setupDragAndDrop();

  console.log("✅ Buttons initialized");
}

// Test API connection
async function testAPI() {
  try {
    console.log("🧪 Testing API connection...");
    const response = await fetch("/api/test");
    const data = await response.json();
    console.log("✅ API Test Result:", data);
    showStatus("✅ Connected to server successfully!", "success");
  } catch (error) {
    console.error("❌ API Test Failed:", error);
    showStatus("❌ Cannot connect to server: " + error.message, "error");
  }
}

// Authentication functions
function initAuth() {
  authToken = localStorage.getItem("fileManagerAuth");
  if (authToken) {
    hideAuth();
    loadFiles("");
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById("authModal").style.display = "block";
}

function hideAuth() {
  document.getElementById("authModal").style.display = "none";
}

async function login() {
  const password = document.getElementById("authPassword").value;

  if (!password) {
    showStatus("Please enter a password", "error");
    return;
  }

  // Test authentication with files endpoint
  try {
    const response = await fetch("/api/files?path=", {
      headers: { "x-auth": password },
    });

    if (response.ok) {
      authToken = password;
      localStorage.setItem("fileManagerAuth", password);
      hideAuth();
      showStatus("✅ Login successful!", "success");
      loadFiles("");
    } else {
      showStatus("❌ Invalid password", "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showStatus("❌ Login failed: " + error.message, "error");
  }
}

function logout() {
  authToken = "";
  localStorage.removeItem("fileManagerAuth");
  showAuth();
  showStatus("Logged out successfully", "success");
}

// API Helper with debugging
async function apiRequest(url, options = {}) {
  if (!authToken) {
    showAuth();
    return null;
  }

  const headers = options.headers || {};
  headers["x-auth"] = authToken;

  const config = { ...options, headers };

  console.log("🔗 API Request:", { url, method: config.method || "GET" });

  try {
    const response = await fetch(url, config);
    console.log("📡 Response status:", response.status, response.statusText);

    // Check content type
    const contentType = response.headers.get("content-type");
    console.log("📋 Content-Type:", contentType);

    if (contentType && contentType.includes("text/html")) {
      const htmlText = await response.text();
      console.error("❌ Received HTML instead of JSON from:", url);
      console.error("HTML snippet:", htmlText.substring(0, 200) + "...");
      throw new Error(
        `Server returned HTML instead of JSON. API endpoint ${url} may not exist.`
      );
    }

    const data = await response.json();
    console.log("✅ API Response:", data);

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("fileManagerAuth");
        showAuth();
        return null;
      }
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("❌ API Request failed:", error);
    showStatus(`API Error: ${error.message}`, "error");
    return null;
  }
}

// Load files
async function loadFiles(path) {
  console.log("📂 Loading files for path:", path);
  currentPath = path;

  const data = await apiRequest(`/api/files?path=${encodeURIComponent(path)}`);
  if (!data) return;

  displayFiles(data.files || []);
  updateBreadcrumb(path);
}

// Display files
function displayFiles(files) {
  const container = document.getElementById("fileList");
  container.innerHTML = "";

  if (files.length === 0) {
    container.innerHTML =
      '<div class="empty-state">📁 No files in this directory</div>';
    return;
  }

  files.forEach((file) => {
    const fileElement = document.createElement("div");
    fileElement.className = "file-item";

    const icon = file.type === "directory" ? "📁" : "📄";
    const size = file.type === "directory" ? "" : formatFileSize(file.size);

    fileElement.innerHTML = `
      <span class="file-icon">${icon}</span>
      <span class="file-name" onclick="handleFileClick('${file.name}', '${
      file.type
    }')">${file.name}</span>
      <span class="file-size">${size}</span>
      <span class="file-date">${formatDate(file.modified)}</span>
    `;

    container.appendChild(fileElement);
  });
}

// Handle file/folder clicks
function handleFileClick(name, type) {
  if (type === "directory") {
    const newPath = currentPath ? `${currentPath}/${name}` : name;
    loadFiles(newPath);
  }
}

// Update breadcrumb navigation
function updateBreadcrumb(path) {
  const breadcrumb = document.getElementById("breadcrumb");
  if (!breadcrumb) return;

  let html = '<a href="#" onclick="loadFiles(\'\')">🏠 Home</a>';

  if (path) {
    const parts = path.split("/").filter((p) => p);
    let currentBreadcrumbPath = "";

    parts.forEach((part) => {
      currentBreadcrumbPath += (currentBreadcrumbPath ? "/" : "") + part;
      html += ` → <a href="#" onclick="loadFiles('${currentBreadcrumbPath}')">${part}</a>`;
    });
  }

  breadcrumb.innerHTML = html;
}

// File upload
function uploadFiles() {
  const input = document.getElementById("fileInput");
  const files = input.files;

  if (files.length === 0) return;

  const formData = new FormData();
  for (let file of files) {
    formData.append("files", file);
  }

  if (currentPath) {
    formData.append("path", currentPath);
  }

  showStatus("Uploading files...", "success");

  apiRequest("/api/upload", {
    method: "POST",
    body: formData,
  }).then((data) => {
    if (data) {
      showStatus("✅ Files uploaded successfully!", "success");
      loadFiles(currentPath);
      input.value = "";
    }
  });
}

// Create new file
async function createFile() {
  const fileName = prompt("Enter file name:");
  if (!fileName) return;

  const data = await apiRequest("/api/create-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: fileName,
      path: currentPath,
    }),
  });

  if (data) {
    showStatus("✅ File created successfully!", "success");
    loadFiles(currentPath);
  }
}

// Create new folder
async function createFolder() {
  const folderName = prompt("Enter folder name:");
  if (!folderName) return;

  const data = await apiRequest("/api/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folderName: folderName,
      path: currentPath,
    }),
  });

  if (data) {
    showStatus("✅ Folder created successfully!", "success");
    loadFiles(currentPath);
  }
}

// Show status messages
function showStatus(message, type) {
  const status = document.getElementById("status");
  if (!status) {
    console.log(`Status (${type}):`, message);
    return;
  }

  status.textContent = message;
  status.className = `status ${type}`;

  // Auto-hide after 3 seconds for success messages
  if (type === "success") {
    setTimeout(() => {
      status.textContent = "";
      status.className = "status";
    }, 3000);
  }
}

// Dark mode functionality
function initDarkMode() {
  const darkMode = localStorage.getItem("darkMode") === "true";
  if (darkMode) {
    document.body.classList.add("dark-mode");
    const toggle = document.getElementById("darkModeToggle");
    if (toggle) toggle.textContent = "☀️ Light";
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", isDark);

  const toggle = document.getElementById("darkModeToggle");
  if (toggle) {
    toggle.textContent = isDark ? "☀️ Light" : "🌙 Dark";
  }
}

// Utility functions
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function openSettingsModal() {
  document.getElementById("settingsModal").style.display = "block";
}

function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
}

function openPurgeModal() {
  document.getElementById("purgeModal").style.display = "block";
}

function closePurgeModal() {
  document.getElementById("purgeModal").style.display = "none";
}

// File upload functions
async function handleFileUpload(event) {
  const files = event.target.files;
  if (!files.length) return;

  for (let file of files) {
    await uploadFile(file, currentPath);
  }

  loadFiles(currentPath);
  event.target.value = ""; // Reset input
}

async function handleFolderUpload(event) {
  const files = event.target.files;
  if (!files.length) return;

  for (let file of files) {
    await uploadFile(file, currentPath);
  }

  loadFiles(currentPath);
  event.target.value = ""; // Reset input
}

async function uploadFile(file, path) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Upload failed");
    }
  } catch (error) {
    console.error("Upload error:", error);
    alert(`Failed to upload ${file.name}: ${error.message}`);
  }
}

// Drag and drop functionality
function setupDragAndDrop() {
  const dropZone = document.getElementById("fileList");

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    for (let file of files) {
      await uploadFile(file, currentPath);
    }

    loadFiles(currentPath);
  });
}

// Create folder functionality
async function createFolder() {
  const folderName = document.getElementById("folderName").value.trim();
  if (!folderName) {
    alert("Please enter a folder name");
    return;
  }

  try {
    const response = await fetch("/api/create-folder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        path: currentPath,
        name: folderName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Failed to create folder");
    }

    closeModal("createFolderModal");
    document.getElementById("folderName").value = "";
    loadFiles(currentPath);
  } catch (error) {
    console.error("Create folder error:", error);
    alert(`Failed to create folder: ${error.message}`);
  }
}

// Create file functionality
async function createFile() {
  const fileName = document.getElementById("fileName").value.trim();
  if (!fileName) {
    alert("Please enter a file name");
    return;
  }

  try {
    const response = await fetch("/api/create-file", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        path: currentPath,
        name: fileName,
        content: "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Failed to create file");
    }

    closeModal("createFileModal");
    document.getElementById("fileName").value = "";
    loadFiles(currentPath);
  } catch (error) {
    console.error("Create file error:", error);
    alert(`Failed to create file: ${error.message}`);
  }
}

// Purge functionality
async function executePurge() {
  try {
    const response = await fetch("/api/purge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Purge failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Purge failed");
    }

    closePurgeModal();
    currentPath = "/";
    loadFiles(currentPath);
    alert("Purge completed successfully!");
  } catch (error) {
    console.error("Purge error:", error);
    alert(`Purge failed: ${error.message}`);
  }
}

// Settings functionality
async function updatePassword() {
  const newPassword = document.getElementById("newPassword").value;
  if (!newPassword) {
    alert("Please enter a new password");
    return;
  }

  try {
    const response = await fetch("/api/update-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify({ newPassword }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update password: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Failed to update password");
    }

    closeSettingsModal();
    document.getElementById("newPassword").value = "";
    alert("Password updated successfully!");
  } catch (error) {
    console.error("Update password error:", error);
    alert(`Failed to update password: ${error.message}`);
  }
}

console.log("✅ DASH COMMANDER JavaScript loaded successfully!");
