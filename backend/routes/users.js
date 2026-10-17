
const express = require("express");
const mongoose = require("mongoose");
const { Readable } = require("stream");

const User = require("../models/User");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

const MIN_AVATAR_SIZE = 50 * 1024;
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const GRIDFS_BUCKET_NAME = "thoughtsnapAvatars";

function getAvatarBucket() {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB is not connected");
  }

  return new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: GRIDFS_BUCKET_NAME }
  );
}

function getId(value) {
  return String(value?._id || value?.id || value || "");
}

function publicUser(user, currentUserId = "") {
  const followers = Array.isArray(user.followers)
    ? user.followers
    : [];

  const following = Array.isArray(user.following)
    ? user.following
    : [];

  return {
    id: getId(user),
    name: user.name || "",
    username: user.username || "",
    bio: user.bio || "",
    avatar: user.avatar || "",
    followersCount: followers.length,
    followingCount: following.length,
    isFollowing: currentUserId
      ? followers.some((id) => getId(id) === currentUserId)
      : false
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uploadAvatarToGridFS(buffer, contentType, userId) {
  return new Promise((resolve, reject) => {
    let uploadStream;

    try {
      uploadStream = getAvatarBucket().openUploadStream(
        `avatar-${userId}-${Date.now()}`,
        {
          metadata: {
            contentType,
            userId: String(userId)
          }
        }
      );
    } catch (error) {
      reject(error);
      return;
    }

    uploadStream.once("error", reject);
    uploadStream.once("finish", () => {
      resolve(uploadStream.id);
    });

    Readable.from(buffer).pipe(uploadStream);
  });
}

async function deleteGridFSAvatar(avatarUrl) {
  if (typeof avatarUrl !== "string" || !avatarUrl) {
    return;
  }

  try {
    const parsedUrl = new URL(avatarUrl);
    const match = parsedUrl.pathname.match(
      /\/api\/users\/avatar\/([a-f\d]{24})$/i
    );

    if (!match) {
      return;
    }

    const fileId = new mongoose.Types.ObjectId(match[1]);
    await getAvatarBucket().delete(fileId);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Old GridFS avatar cleanup error:", error.message);
    }
  }
}

// GET /api/users/search?q=pratik
router.get("/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string"
      ? req.query.q.trim()
      : "";

    if (!q) {
      return res.json({ success: true, users: [] });
    }

    const escaped = escapeRegex(q);

    const users = await User.find({
      $or: [
        { username: { $regex: escaped, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } }
      ]
    })
      .select("name username bio avatar followers following")
      .limit(20)
      .lean();

    return res.json({
      success: true,
      users: users.map((user) => publicUser(user))
    });
  } catch (error) {
    console.error("User search error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search users"
    });
  }
});

// GET /api/users/avatar/:id
// Serves images stored in MongoDB GridFS.
router.get("/avatar/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid avatar ID"
      });
    }

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getAvatarBucket();
    const files = await bucket.find({ _id: fileId }).toArray();
    const file = files[0];

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Profile photo not found"
      });
    }

    const contentType = file.metadata?.contentType;

    if (!ALLOWED_AVATAR_TYPES.has(contentType)) {
      return res.status(415).json({
        success: false,
        message: "Unsupported profile photo type"
      });
    }

    res.set("Content-Type", contentType);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", "public, max-age=86400");

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.once("error", (error) => {
      console.error("GridFS avatar download error:", error.message);

      if (!res.headersSent) {
        res.status(404).end();
      } else {
        res.destroy(error);
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error("GridFS avatar retrieval error:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Unable to load profile photo"
      });
    }
  }
});

// POST /api/users/me/avatar
router.post(
  "/me/avatar",
  auth,
  (req, res, next) => {
    upload.single("avatar")(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "Profile photo must be 10 MB or smaller."
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || "Unable to process the selected image"
      });
    });
  },
  async (req, res) => {
    let uploadedFileId = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a profile photo first."
        });
      }

      if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Only JPEG, PNG, WEBP and GIF images are allowed."
        });
      }

      if (req.file.size < MIN_AVATAR_SIZE) {
        return res.status(400).json({
          success: false,
          message: "Profile photo must be at least 50 KB."
        });
      }

      if (req.file.size > MAX_AVATAR_SIZE) {
        return res.status(413).json({
          success: false,
          message: "Profile photo must be 10 MB or smaller."
        });
      }

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Logged-in user not found"
        });
      }

      uploadedFileId = await uploadAvatarToGridFS(
        req.file.buffer,
        req.file.mimetype,
        user._id
      );

      const previousAvatar = user.avatar || "";
      const avatarUrl =
        `${req.protocol}://${req.get("host")}` +
        `/api/users/avatar/${uploadedFileId.toString()}`;

      user.avatar = avatarUrl;
      await user.save();

      // Delete the previous photo only if it belongs to our GridFS bucket.
      // Existing Cloudinary URLs are left untouched.
      if (previousAvatar && previousAvatar !== avatarUrl) {
        await deleteGridFSAvatar(previousAvatar);
      }

      return res.json({
        success: true,
        message: "Profile photo updated successfully",
        user: {
          id: getId(user),
          name: user.name,
          username: user.username,
          bio: user.bio || "",
          avatar: user.avatar || ""
        }
      });
    } catch (error) {
      console.error("GridFS avatar upload error:", error.message);

      // Remove the newly uploaded file if saving the user's profile failed.
      if (uploadedFileId) {
        try {
          await getAvatarBucket().delete(uploadedFileId);
        } catch (cleanupError) {
          console.error(
            "New GridFS avatar cleanup error:",
            cleanupError.message
          );
        }
      }

      return res.status(500).json({
        success: false,
        message: "Unable to upload profile photo. Please try again."
      });
    }
  }
);

// GET /api/users/:username
router.get("/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required"
      });
    }

    const user = await User.findOne({
      username: {
        $regex: "^" + escapeRegex(username) + "$",
        $options: "i"
      }
    })
      .select("-email -password")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found: " + username
      });
    }

    const posts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("caption imageUrl likes comments createdAt")
      .lean();

    return res.json({
      success: true,
      user: publicUser(user),
      posts: posts.map((post) => ({
        id: getId(post),
        caption: post.caption || "",
        imageUrl: post.imageUrl || "",
        likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
        commentsCount: Array.isArray(post.comments)
          ? post.comments.length
          : 0,
        createdAt: post.createdAt
      }))
    });
  } catch (error) {
    console.error("Profile loading error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load profile"
    });
  }
});

// PUT /api/users/me
router.put("/me", auth, async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 50
      ) {
        return res.status(400).json({
          success: false,
          message: "Name must contain 2-50 characters"
        });
      }

      updates.name = name.trim();
    }

    if (bio !== undefined) {
      if (typeof bio !== "string" || bio.trim().length > 250) {
        return res.status(400).json({
          success: false,
          message: "Bio must be 250 characters or fewer"
        });
      }

      updates.bio = bio.trim();
    }

    if (avatar !== undefined) {
      if (typeof avatar !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid avatar URL"
        });
      }

      if (avatar !== "") {
        let validAvatar = false;

        try {
          const parsedUrl = new URL(avatar);

          const isCloudinary =
            parsedUrl.protocol === "https:" &&
            parsedUrl.hostname === "res.cloudinary.com";

          const isGridFSAvatar =
            /^\/api\/users\/avatar\/[a-f\d]{24}$/i.test(
              parsedUrl.pathname
            ) &&
            (parsedUrl.protocol === "https:" ||
              parsedUrl.protocol === "http:");

          validAvatar = isCloudinary || isGridFSAvatar;
        } catch {
          validAvatar = false;
        }

        if (!validAvatar) {
          return res.status(400).json({
            success: false,
            message: "Avatar must be a valid Cloudinary or GridFS URL"
          });
        }
      }

      updates.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Logged-in user not found"
      });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: getId(user),
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio || "",
        avatar: user.avatar || "",
        followersCount: Array.isArray(user.followers)
          ? user.followers.length
          : 0,
        followingCount: Array.isArray(user.following)
          ? user.following.length
          : 0
      }
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile"
    });
  }
});

// POST /api/users/:id/follow
router.post("/:id/follow", auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentId = getId(req.user);

    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    if (targetId === currentId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself"
      });
    }

    const target = await User.findById(targetId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const alreadyFollowing = (target.followers || []).some(
      (id) => getId(id) === currentId
    );

    if (alreadyFollowing) {
      await User.updateOne(
        { _id: targetId },
        { $pull: { followers: req.user._id } }
      );

      await User.updateOne(
        { _id: currentId },
        { $pull: { following: target._id } }
      );
    } else {
      await User.updateOne(
        { _id: targetId },
        { $addToSet: { followers: req.user._id } }
      );

      await User.updateOne(
        { _id: currentId },
        { $addToSet: { following: target._id } }
      );

      await Notification.create({
        recipient: target._id,
        sender: req.user._id,
        type: "follow",
        message: "started following you"
      });
    }

    const updatedTarget = await User.findById(targetId);

    return res.json({
      success: true,
      following: !alreadyFollowing,
      followersCount: updatedTarget.followers.length
    });
  } catch (error) {
    console.error("Follow error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update follow status"
    });
  }
});

module.exports = router;
