const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Post = require("../models/Post");
const auth = require("../middleware/auth");

const router = express.Router();

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

// GET /api/users/search?q=pratik
router.get("/search", async (req, res) => {
  try {
    const q =
      typeof req.query.q === "string"
        ? req.query.q.trim()
        : "";

    if (!q) {
      return res.json({
        success: true,
        users: []
      });
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

// GET /api/users/:username
// Load the profile belonging to the requested username.
router.get("/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required"
      });
    }

    // Match the requested username exactly, ignoring letter case.
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

    const posts = await Post.find({
      author: user._id
    })
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
// Edit the logged-in user's own profile.
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
          message: "Name must contain 2–50 characters"
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
      {
        new: true,
        runValidators: true
      }
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
// Toggle follow/unfollow.
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

    const alreadyFollowing = target.followers.some(
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