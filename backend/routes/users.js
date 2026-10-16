
const express = require("express");
const mongoose = require("mongoose");
const { Readable } = require("stream");

const User = require("../models/User");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const MIN_AVATAR_SIZE = 50 * 1024;
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

function getId(value) {
  return String(value?._id || value?.id || value || "");
}

function publicUser(user, currentUserId = "") {
  const followers = Array.isArray(user.followers) ? user.followers : [];
  const following = Array.isArray(user.following) ? user.following : [];

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

function uploadAvatarToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "thoughtsnap/avatars",
        resource_type: "image"
      },
      (error, result) => {
        if (error) return reject(error);

        if (!result?.secure_url) {
          return reject(new Error("Cloudinary returned no image URL"));
        }

        resolve(result);
      }
    );

    stream.on("error", reject);
    Readable.from(buffer).pipe(stream);
  });
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

// POST /api/users/me/avatar
router.post(
  "/me/avatar",
  auth,
  (req, res, next) => {
    upload.single("avatar")(req, res, (error) => {
      if (!error) return next();

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "Profile photo must be 10 MB or smaller."
        });
      }

      return res.status(400).json({
        success: false,
        message:
          error.message || "Unable to process the selected image"
      });
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a profile photo first."
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

      const result = await uploadAvatarToCloudinary(req.file.buffer);

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { avatar: result.secure_url } },
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
      console.error("Avatar upload error:", {
        message: error.message,
        http_code: error.http_code
      });

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
        likesCount: Array.isArray(post.likes)
          ? post.likes.length
          : 0,
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
      if (
        typeof bio !== "string" ||
        bio.trim().length > 250
      ) {
        return res.status(400).json({
          success: false,
          message: "Bio must be 250 characters or fewer"
        });
      }

      updates.bio = bio.trim();
    }

    if (avatar !== undefined) {
      if (
        typeof avatar !== "string" ||
        (
          avatar !== "" &&
          (
            !avatar.startsWith("https://") ||
            !avatar.includes("res.cloudinary.com/")
          )
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Avatar must be a valid Cloudinary HTTPS URL"
        });
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
