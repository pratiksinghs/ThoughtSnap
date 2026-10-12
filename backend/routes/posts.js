
const express = require("express");
const mongoose = require("mongoose");
const { Readable } = require("stream");

const Post = require("../models/Post");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const uploadImage = upload.single("image");

function handleUpload(req, res, next) {
  uploadImage(req, res, (error) => {
    if (!error) return next();

    return res.status(400).json({
      success: false,
      message: error.message || "Image upload failed"
    });
  });
}

function serializePost(post, currentUserId) {
  const liked = post.likes.some(
    (id) => id.toString() === currentUserId
  );

  return {
    id: post._id,
    caption: post.caption,
    imageUrl: post.imageUrl,
    author: post.author
      ? {
          id: post.author._id,
          name: post.author.name,
          username: post.author.username,
          avatar: post.author.avatar
        }
      : null,
    likesCount: post.likes.length,
    liked,
    comments: post.comments.map((comment) => ({
      id: comment._id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.author
        ? {
            id: comment.author._id,
            name: comment.author.name,
            username: comment.author.username
          }
        : null
    })),
    createdAt: post.createdAt
  };
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "thoughtsnap",
        resource_type: "image"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

// GET /api/posts — public feed
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("author", "name username avatar")
      .populate("comments.author", "name username")
      .lean();

    const currentUserId = req.user?._id?.toString() || "";

    return res.json({
      success: true,
      posts: posts.map((post) => ({
        ...serializePost(post, currentUserId),
        liked: currentUserId
          ? post.likes.some((id) => id.toString() === currentUserId)
          : false
      }))
    });
  } catch (error) {
    console.error("Feed error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load posts"
    });
  }
});

// POST /api/posts — create a public thought or photo post
router.post("/", auth, handleUpload, async (req, res) => {
  let uploadedPublicId;

  try {
    const caption =
      typeof req.body.caption === "string"
        ? req.body.caption.trim()
        : "";

    if (!caption && !req.file) {
      return res.status(400).json({
        success: false,
        message: "Write a thought or select a photo"
      });
    }

    if (caption.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Thought must be 2000 characters or fewer"
      });
    }

    let imageUrl = "";
    let imagePublicId = "";

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
      uploadedPublicId = result.public_id;
    }

    const post = await Post.create({
      author: req.user._id,
      caption,
      imageUrl,
      imagePublicId
    });

    const populated = await Post.findById(post._id)
      .populate("author", "name username avatar")
      .populate("comments.author", "name username")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Post published successfully",
      post: serializePost(populated, req.user._id.toString())
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (cleanupError) {
        console.error("Cloudinary cleanup failed");
      }
    }

    console.error("Create post error details:", {
  message: error.message,
  name: error.name,
  http_code: error.http_code,
  error: error.error
});

    return res.status(500).json({
      success: false,
      message: "Unable to publish post"
    });
  }
});

// POST /api/posts/:id/like — toggle like
router.post("/:id/like", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    const userId = req.user._id;
    const alreadyLiked = post.likes.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.addToSet(userId);
    }

    await post.save();

    return res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likes.length
    });
  } catch (error) {
    console.error("Like error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update like"
    });
  }
});

// POST /api/posts/:id/comments — add a comment
router.post("/:id/comments", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const text =
      typeof req.body.text === "string"
        ? req.body.text.trim()
        : "";

    if (!text || text.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment must contain 1–500 characters"
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    post.comments.push({
      author: req.user._id,
      text
    });

    await post.save();

    const populated = await Post.findById(post._id)
      .populate("comments.author", "name username")
      .lean();

    const comment = populated.comments[populated.comments.length - 1];

    return res.status(201).json({
      success: true,
      comment: {
        id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        author: {
          id: comment.author._id,
          name: comment.author.name,
          username: comment.author.username
        }
      }
    });
  } catch (error) {
    console.error("Comment error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to add comment"
    });
  }
});

module.exports = router;
