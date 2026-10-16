
const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/notifications
// Fetch the logged-in user's notifications
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const notifications = await Notification.find({
      recipient: userId
    })
      .populate("sender", "name username profilePicture")
      .populate("post", "caption imageUrl")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });

    return res.json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load notifications."
    });
  }
});

// PATCH /api/notifications/read-all
// Mark all notifications as read
router.patch("/read-all", auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({
      success: true,
      message: "All notifications marked as read."
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update notifications."
    });
  }
});

// PATCH /api/notifications/:id/read
// Mark one notification as read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const notificationId = req.params.id;

    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID."
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: userId
      },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read.",
      notification
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update notification."
    });
  }
});

module.exports = router;
