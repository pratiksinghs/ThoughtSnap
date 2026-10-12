
const multer = require("multer");

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter(req, file, callback) {
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG, WEBP and GIF images are allowed")
      );
    }

    callback(null, true);
  }
});

module.exports = upload;
