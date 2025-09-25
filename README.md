# Evernode File Manager

A modern, responsive, secure web-based file manager built specifically for Evernode instances.

## 🚀 Features

- **Full File Operations**: Upload, download, rename, delete, create folders, change permissions (CHMOD)
- **Modern Interface**: Responsive design with drag & drop upload support
- **Secure**: Password-protected with path traversal protection and file sanitization
- **Zero Build**: Pure HTML/CSS/JS frontend, no build step required
- **One-Click Deploy**: Ready for Evernode WebCBuilder deployment

## 🔧 Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Start the server**:

   ```bash
   npm start
   ```

3. **Access the file manager**:
   Open `http://localhost:3000/file-manager` in your browser

4. **Login**:
   Default password: `password`

## 🛠 Configuration

### Password

Change the password by setting the `PASSWORD` environment variable:

```bash
# Windows
set PASSWORD=your_secure_password && npm start

# Linux/Mac
PASSWORD=your_secure_password npm start
```

### Port

Change the port by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## 🏗 File Structure

```
file-manager/
├── index.js           # Backend server (Express + REST API)
├── package.json       # Dependencies and scripts
├── public/           # Frontend files
│   ├── index.html    # Main HTML interface
│   └── app.js        # Frontend JavaScript
├── data/             # File storage directory (auto-created)
└── README.md         # This file
```

## 🔐 Security Features

- **Authentication**: All API endpoints require password authentication via `x-auth` header or `?key=` parameter
- **Path Traversal Protection**: Prevents `../` attacks and directory escaping
- **File Sanitization**: Validates and sanitizes all filenames
- **Upload Limits**: 100MB file size limit, 10 files per upload
- **Safe CHMOD**: Only allows numeric octal permissions (e.g., 644, 755)
- **No Shell Execution**: Pure Node.js operations, no shell commands

## 📱 Interface Features

### File Operations

- **Upload**: Drag & drop or click to select files
- **Download**: Single files or multiple as ZIP
- **ZIP Extraction**: Automatic extraction option for uploaded ZIP files
- **Rename**: In-place file/folder renaming
- **Delete**: Single or bulk delete with confirmation
- **CHMOD**: Change file permissions with validation
- **Create Folders**: New folder creation

### Navigation

- **Breadcrumb**: Easy directory navigation
- **File Icons**: Visual file type indicators
- **File Info**: Size, date, and permissions display
- **Bulk Selection**: Select all/multiple files for operations

### Responsive Design

- **Mobile-Friendly**: Touch-optimized interface
- **Fixed Header/Footer**: Always-accessible controls
- **Flexible Layout**: Adapts to all screen sizes

## 🌐 API Endpoints

All endpoints require authentication (`x-auth` header or `?key=` query param):

- `GET /api/files?path=` - List files and folders
- `POST /api/upload` - Upload files (multipart form)
- `GET /api/download?files=` - Download files/folders as ZIP
- `POST /api/rename` - Rename file/folder
- `DELETE /api/delete` - Delete files/folders
- `POST /api/chmod` - Change file permissions
- `POST /api/mkdir` - Create directory

## 📦 Deployment

### Evernode WebCBuilder

1. Upload all files (index.js, package.json, public/\*)
2. Ensure flat structure (no nested folders in upload)
3. WebCBuilder will run `npm install` and `npm start`

### Manual Deployment

1. Copy all files to server
2. Run `npm install`
3. Run `npm start` or `node index.js`
4. Access via `http://your-server:3000/file-manager`

## ⌨️ Keyboard Shortcuts

- `Ctrl/Cmd + A`: Select all files
- `Ctrl/Cmd + U`: Upload files
- `Delete`: Delete selected files
- `Escape`: Close modals

## 🧪 Testing

The file manager has been tested for:

- ✅ File upload/download operations
- ✅ Directory creation and navigation
- ✅ File permissions and security
- ✅ Responsive design across devices
- ✅ Drag & drop functionality
- ✅ Bulk operations (select/delete/download)

## 💡 Troubleshooting

**Can't access file manager?**

- Ensure server is running on correct port
- Check password is correct
- Verify `/file-manager` path in URL

**Upload not working?**

- Check file size (100MB limit)
- Verify file name doesn't contain invalid characters
- Ensure proper authentication

**Permission errors?**

- Check data directory permissions
- Verify file system supports chmod operations

## 📄 License

MIT License - feel free to modify and distribute.
