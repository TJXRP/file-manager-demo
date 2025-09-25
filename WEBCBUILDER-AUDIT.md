# EVERNODE FILE MANAGER - WEBCBUILDER AUDIT CHECKLIST

==================================================

## 📋 PRE-DEPLOYMENT CHECKLIST

### Files to Upload to WebCBuilder:

- [ ] `index.js` - Main server file with all fixes
- [ ] `package.json` - Dependencies configuration
- [ ] `public/index.html` - Frontend with 85% width, clean logo, centered buttons
- [ ] `public/app.js` - JavaScript with subdirectory upload fixes
- [ ] `public/images/evernode-logo.png` - Logo file (create images folder first)
- [ ] `README.md` - Documentation

## 🔧 DEPLOYMENT STEPS FOR WEBCBUILDER

1. **Upload Core Files:**

   ```
   Upload individually (NOT as ZIP):
   - index.js
   - package.json
   - public/index.html
   - public/app.js
   ```

2. **Create Images Directory:**

   ```
   Create folder: public/images/
   Upload: evernode-logo.png
   ```

3. **WebCBuilder Auto-Install:**
   - WebCBuilder automatically runs: `npm install`
   - WebCBuilder automatically runs: `npm start`

## ✅ TESTING CHECKLIST

### Authentication:

- [ ] Login page appears on first visit
- [ ] Password "password" works correctly
- [ ] Authentication persists between page refreshes
- [ ] Logout works properly

### Core File Operations:

- [ ] File listing loads correctly
- [ ] Download single files works
- [ ] Download multiple files as ZIP works
- [ ] Delete files works
- [ ] Rename files works
- [ ] File permissions (chmod) works

### Directory Operations:

- [ ] Create new folders works
- [ ] Navigate into subdirectories works
- [ ] Breadcrumb navigation works
- [ ] Refresh button works
- [ ] WebCBuilder admin link works

### Upload Operations:

- [ ] Upload single files to root directory
- [ ] Upload multiple files to root directory
- [ ] **CRITICAL:** Upload files to subdirectories (recent fix)
- [ ] Upload folder structure preservation
- [ ] ZIP file upload with extraction option
- [ ] ZIP file upload without extraction (keep as ZIP)

### UI/UX Elements:

- [ ] Page maintains 85% width consistently
- [ ] Logo displays without dark background
- [ ] Title shows "File Manager" (not "Evernode File Manager")
- [ ] Action buttons are centered below breadcrumb
- [ ] Action buttons are properly sized (btn-sm)
- [ ] Medium gray background displays correctly
- [ ] Responsive design works on mobile

### Advanced Features:

- [ ] File search functionality
- [ ] File sorting (name, size, date)
- [ ] Bulk operations (select multiple files)
- [ ] ZIP extraction in subdirectories
- [ ] Large file uploads (up to 100MB)

## 🐛 KNOWN ISSUES TO VERIFY FIXES

### Recently Fixed:

- [x] Subdirectory uploads now work (multer destination fix)
- [x] ZIP extraction prompt clarified
- [x] Page width consistency maintained
- [x] Logo styling cleaned up
- [x] Title simplified
- [x] Buttons repositioned and resized

### Test These Specifically:

1. **Subdirectory Upload Test:**

   - Navigate to: `/subfolder/`
   - Upload a file
   - Verify it appears in `/subfolder/` not root

2. **ZIP Upload Test:**

   - Upload a ZIP file
   - Verify clear prompt: "Click OK to extract / Click Cancel to keep as ZIP"
   - Test both options work correctly

3. **Width Consistency Test:**
   - Resize browser window
   - Verify page stays 85% width on desktop
   - Verify 90% width on mobile

## 🌐 INSTANCE TESTING URLS

Once deployed on WebCBuilder instance:

- Main app: `https://your-instance.evernode.com/file-manager`
- API test: `https://your-instance.evernode.com/file-manager/api/files`

## 📊 AUDIT RESULTS

### Date: ****\_\_\_****

### Instance URL: ****\_\_\_****

### Tester: ****\_\_\_****

### Overall Status:

- [ ] PASS - Ready for production
- [ ] PARTIAL - Minor issues found
- [ ] FAIL - Major issues require fixes

### Notes:

```
[Add any issues found during testing]
```

---

**Ready to deploy!** 🚀
Package: `evernode-file-manager-audit.zip`
