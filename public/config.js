// NameCheap Deployment Configuration
// Modify these settings for your hosting environment

window.FILE_MANAGER_CONFIG = {
  // For shared hosting, usually use empty string
  BASE_PATH: "",

  // For subdirectory deployments, use something like:
  // BASE_PATH: "/file-manager",

  // API endpoint - usually same as BASE_PATH
  API_BASE: "",

  // Debug mode - set to false in production
  DEBUG: true,
};

console.log("File Manager Config loaded:", window.FILE_MANAGER_CONFIG);
