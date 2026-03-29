import multer from 'multer';
import path from 'path';
import os from 'os';

/**
 * FILE UPLOAD SYSTEM
 * -------------------
 * This system first saves files temporarily to the local disk, validates 
 * their types/sizes, and attaches a clean prep-object to the request 
 * so the next controller can reliably upload it to Cloudinary.
 * 
 * It does NOT call Cloudinary directly.
 */

// 1. Define allowed extensions by category
const ALLOWED_IMAGES = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_VIDEOS = ['.mp4', '.mov', '.avi', '.mkv'];
const ALLOWED_AUDIO = ['.mp3', '.wav', '.m4a', '.mpeg', '.ogg'];
const ALLOWED_RAW = ['.pdf', '.zip', '.docx', '.apk'];
const ALL_ALLOWED = [...ALLOWED_IMAGES, ...ALLOWED_VIDEOS, ...ALLOWED_AUDIO, ...ALLOWED_RAW];

// 2. Configure Local Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save to server's temporary OS directory
    cb(null, os.tmpdir());
  },
  filename: function (req, file, cb) {
    // Prevent name collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 3. Multer Uploader Instance & Validation
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Max file size: 100MB
  fileFilter: (req, file, cb) => {
    // Extract extension securely
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Reject natively if unsupported
    if (!ALL_ALLOWED.includes(ext)) {
      return cb(new Error(`Validation Failed: Unsupported file type '${ext}'.`), false);
    }
    
    cb(null, true); 
  }
});

// 4. Clean Pre-processor Middleware
const processFileUpload = (req, res, next) => {
  // If no file was uploaded, just proceed
  if (!req.file) {
    return next();
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  
  // Default values
  let resourceType = 'raw';
  let cloudinaryFolder = 'uploads/raw';

  // Automatically categorize based on known extension
  if (ALLOWED_IMAGES.includes(ext) || ext === '.pdf') {
    resourceType = 'image';
    cloudinaryFolder = 'uploads/images';
  } else if (ALLOWED_VIDEOS.includes(ext) || ALLOWED_AUDIO.includes(ext)) {
    // Cloudinary categorizes both Video and Audio under 'video' resource type
    resourceType = 'video';
    cloudinaryFolder = 'uploads/videos';
  }

  // Pre-calculate chat mediaType for convenience
  let chatMediaType = 'file';
  if (ALLOWED_IMAGES.includes(ext)) chatMediaType = 'image';
  else if (ALLOWED_VIDEOS.includes(ext)) chatMediaType = 'video';
  else if (ALLOWED_AUDIO.includes(ext)) chatMediaType = 'audio';

  // Prepare a clean configuration object for Cloudinary implementation
  req.cloudinaryPreppedFile = {
    originalName: req.file.originalname,
    localPath: req.file.path, // The temp path saved by multer
    resourceType: resourceType,
    cloudinaryFolder: cloudinaryFolder,
    chatMediaType: chatMediaType, // Extracted type specific for Chat router
    accessMode: 'public', // Default access mode as requested
  };

  next();
};

export { upload, processFileUpload };
