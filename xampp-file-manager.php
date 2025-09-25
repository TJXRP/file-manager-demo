<?php
// XAMPP File Manager - PHP Version
// Place this in your XAMPP htdocs folder

session_start();

// Configuration
$PASSWORD = 'password'; // Change this password
$BASE_DIR = __DIR__ . '/files'; // Files will be stored in a 'files' folder
$MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB

// Create files directory if it doesn't exist
if (!is_dir($BASE_DIR)) {
    mkdir($BASE_DIR, 0755, true);
}

// Authentication check
function isAuthenticated() {
    return isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
}

// Handle authentication
if (isset($_POST['password'])) {
    if ($_POST['password'] === $GLOBALS['PASSWORD']) {
        $_SESSION['authenticated'] = true;
    } else {
        $error = 'Invalid password';
    }
}

if (isset($_POST['logout'])) {
    session_destroy();
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

// Sanitize path
function sanitizePath($path) {
    $path = str_replace(['../', '.\\', '..\\'], '', $path);
    return trim($path, '/\\');
}

// Get secure file path
function getSecurePath($relativePath = '') {
    global $BASE_DIR;
    $clean = sanitizePath($relativePath);
    return $BASE_DIR . '/' . $clean;
}

// Handle file operations
if (isAuthenticated()) {
    // File upload
    if (isset($_FILES['files'])) {
        $uploadPath = getSecurePath($_POST['path'] ?? '');
        if (!is_dir($uploadPath)) {
            mkdir($uploadPath, 0755, true);
        }
        
        $uploadedFiles = [];
        foreach ($_FILES['files']['tmp_name'] as $key => $tmp_name) {
            if ($_FILES['files']['error'][$key] === UPLOAD_ERR_OK) {
                $filename = basename($_FILES['files']['name'][$key]);
                $destination = $uploadPath . '/' . $filename;
                
                if (move_uploaded_file($tmp_name, $destination)) {
                    $uploadedFiles[] = $filename;
                }
            }
        }
        
        if (count($uploadedFiles) > 0) {
            $success = 'Uploaded: ' . implode(', ', $uploadedFiles);
        }
    }
    
    // File deletion
    if (isset($_POST['delete_file'])) {
        $filePath = getSecurePath($_POST['delete_file']);
        if (file_exists($filePath)) {
            if (is_dir($filePath)) {
                rmdir($filePath);
            } else {
                unlink($filePath);
            }
            $success = 'File deleted successfully';
        }
    }
    
    // Create folder
    if (isset($_POST['create_folder'])) {
        $folderPath = getSecurePath($_POST['current_path'] . '/' . $_POST['folder_name']);
        if (mkdir($folderPath, 0755)) {
            $success = 'Folder created successfully';
        }
    }
    
    // File download
    if (isset($_GET['download'])) {
        $filePath = getSecurePath($_GET['download']);
        if (file_exists($filePath) && is_file($filePath)) {
            $filename = basename($filePath);
            header('Content-Description: File Transfer');
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($filePath));
            readfile($filePath);
            exit;
        }
    }
}

// Get current path
$currentPath = sanitizePath($_GET['path'] ?? '');
$fullCurrentPath = getSecurePath($currentPath);

// Get file list
$files = [];
if (isAuthenticated() && is_dir($fullCurrentPath)) {
    $items = scandir($fullCurrentPath);
    foreach ($items as $item) {
        if ($item !== '.' && $item !== '..') {
            $itemPath = $fullCurrentPath . '/' . $item;
            $relativePath = $currentPath ? $currentPath . '/' . $item : $item;
            
            $files[] = [
                'name' => $item,
                'path' => $relativePath,
                'is_dir' => is_dir($itemPath),
                'size' => is_file($itemPath) ? filesize($itemPath) : 0,
                'modified' => filemtime($itemPath)
            ];
        }
    }
}

// Format file size
function formatSize($size) {
    $units = ['B', 'KB', 'MB', 'GB'];
    for ($i = 0; $size >= 1024 && $i < 3; $i++) {
        $size /= 1024;
    }
    return round($size, 1) . ' ' . $units[$i];
}

// Generate breadcrumb
function getBreadcrumb($path) {
    $parts = array_filter(explode('/', $path));
    $breadcrumb = '<a href="?path=">Home</a>';
    
    $currentPath = '';
    foreach ($parts as $part) {
        $currentPath .= ($currentPath ? '/' : '') . $part;
        $breadcrumb .= ' / <a href="?path=' . urlencode($currentPath) . '">' . htmlspecialchars($part) . '</a>';
    }
    
    return $breadcrumb;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XAMPP File Manager</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            line-height: 1.6;
        }
        
        .header {
            background: #2c3e50;
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .breadcrumb {
            background: white;
            padding: 1rem 2rem;
            border-bottom: 1px solid #ddd;
        }
        
        .breadcrumb a {
            color: #3498db;
            text-decoration: none;
        }
        
        .main {
            padding: 2rem;
        }
        
        .auth-form {
            max-width: 400px;
            margin: 50px auto;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .upload-area {
            background: white;
            border: 2px dashed #bdc3c7;
            border-radius: 8px;
            padding: 2rem;
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .file-list {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .file-item {
            display: flex;
            align-items: center;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #f1f3f4;
            gap: 1rem;
        }
        
        .file-item:hover {
            background: #f8f9fa;
        }
        
        .file-info {
            flex: 1;
        }
        
        .file-name {
            font-weight: 500;
            color: #2c3e50;
        }
        
        .file-meta {
            font-size: 0.85rem;
            color: #7f8c8d;
            margin-top: 0.25rem;
        }
        
        .file-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 0.85rem;
            display: inline-block;
        }
        
        .btn-primary { background: #3498db; color: white; }
        .btn-success { background: #27ae60; color: white; }
        .btn-danger { background: #e74c3c; color: white; }
        .btn-small { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        .form-input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1rem;
        }
        
        .alert-success {
            background: #d5f4e6;
            color: #27ae60;
            border: 1px solid #a3d9a3;
        }
        
        .alert-error {
            background: #f8d7da;
            color: #e74c3c;
            border: 1px solid #f5c6cb;
        }
        
        .controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }
        
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📁 XAMPP File Manager</h1>
        <?php if (isAuthenticated()): ?>
            <form method="post" style="margin: 0;">
                <button type="submit" name="logout" class="btn btn-danger">Logout</button>
            </form>
        <?php endif; ?>
    </div>

    <?php if (!isAuthenticated()): ?>
        <div class="auth-form">
            <h2>File Manager Access</h2>
            <?php if (isset($error)): ?>
                <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
            <?php endif; ?>
            <form method="post">
                <div class="form-group">
                    <label>Password:</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
                <button type="submit" class="btn btn-primary">Login</button>
            </form>
        </div>
    <?php else: ?>
        <div class="breadcrumb">
            <?php echo getBreadcrumb($currentPath); ?>
        </div>

        <div class="main">
            <?php if (isset($success)): ?>
                <div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div>
            <?php endif; ?>

            <div class="controls">
                <!-- Upload Form -->
                <form method="post" enctype="multipart/form-data" class="upload-area">
                    <input type="hidden" name="path" value="<?php echo htmlspecialchars($currentPath); ?>">
                    <p><strong>📤 Upload Files</strong></p>
                    <input type="file" name="files[]" multiple class="form-input">
                    <button type="submit" class="btn btn-primary">Upload</button>
                </form>

                <!-- Create Folder Form -->
                <form method="post" style="background: white; padding: 1rem; border-radius: 8px;">
                    <input type="hidden" name="current_path" value="<?php echo htmlspecialchars($currentPath); ?>">
                    <div class="form-group">
                        <label>Create Folder:</label>
                        <input type="text" name="folder_name" class="form-input" placeholder="Folder name" required>
                    </div>
                    <button type="submit" name="create_folder" class="btn btn-success">Create</button>
                </form>
            </div>

            <div class="file-list">
                <?php if (count($files) === 0): ?>
                    <div class="file-item">
                        <div class="file-info">
                            <div class="file-name">No files found</div>
                            <div class="file-meta">Upload some files to get started</div>
                        </div>
                    </div>
                <?php else: ?>
                    <?php foreach ($files as $file): ?>
                        <div class="file-item">
                            <div style="font-size: 1.2rem;">
                                <?php echo $file['is_dir'] ? '📁' : '📄'; ?>
                            </div>
                            <div class="file-info">
                                <div class="file-name">
                                    <?php if ($file['is_dir']): ?>
                                        <a href="?path=<?php echo urlencode($file['path']); ?>" style="text-decoration: none; color: inherit;">
                                            <?php echo htmlspecialchars($file['name']); ?>
                                        </a>
                                    <?php else: ?>
                                        <?php echo htmlspecialchars($file['name']); ?>
                                    <?php endif; ?>
                                </div>
                                <div class="file-meta">
                                    <?php echo $file['is_dir'] ? 'Folder' : formatSize($file['size']); ?> • 
                                    <?php echo date('M j, Y H:i', $file['modified']); ?>
                                </div>
                            </div>
                            <div class="file-actions">
                                <?php if (!$file['is_dir']): ?>
                                    <a href="?download=<?php echo urlencode($file['path']); ?>" class="btn btn-success btn-small">
                                        📥 Download
                                    </a>
                                <?php endif; ?>
                                <form method="post" style="display: inline;" onsubmit="return confirm('Delete this item?')">
                                    <input type="hidden" name="delete_file" value="<?php echo htmlspecialchars($file['path']); ?>">
                                    <button type="submit" class="btn btn-danger btn-small">🗑️ Delete</button>
                                </form>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    <?php endif; ?>
</body>
</html>