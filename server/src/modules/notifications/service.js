import Notification from "../../database/models/Notification.js";
import AppError from "../../utils/AppError.js";
import { getIO } from "../../utils/socketIO.js";
import User from "../../database/models/User.js";
import redisClient from "../../config/redis.js";

const TYPE_TO_PREF = {
  interview: "interviewReminders",
  "job-update": "jobUpdates",
  application: "jobUpdates",
  new_application: "jobUpdates",
  skill_gap_alert: "resumeAnalysis",
  info: "systemAlerts",
  warning: "systemAlerts",
  success: "systemAlerts",
  error: "systemAlerts",
  system: "systemAlerts",
  message: "systemAlerts",
  application_status: "jobUpdates",
};

const PREFS_CACHE_TTL = 300; // 5 minutes

const getCachedUserPreferences = async (userId) => {
  const cacheKey = `notif_prefs:${userId}`;

  if (redisClient?.isReady) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis unavailable — fall through to DB query
    }
  }

  const user = await User.findById(userId)
    .select("preferences.notifications preferences.emailFrequency")
    .lean()
    .exec();

  if (!user) return null;

  const prefs = user.preferences?.notifications || {};
  prefs.emailFrequency = user.preferences?.emailFrequency || "weekly";

  if (redisClient?.isReady) {
    try {
      await redisClient.setEx(cacheKey, PREFS_CACHE_TTL, JSON.stringify(prefs));
    } catch {
      // Best-effort caching
    }
  }

  return prefs;
};

/**
 * Create a new notification
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.userId - User ID
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {string} notificationData.type - Notification type
 * @param {Object} [notificationData.metadata] - Optional metadata
 * @param {boolean} [notificationData.force=false] - Bypass user preference filtering
 * @returns {Promise<Object|null>} - Created notification or null if filtered
 */
export const createNotification = async (notificationData) => {
  const { userId, title, message, type, metadata, force = false } = notificationData;

  if (!force) {
    const prefs = await getCachedUserPreferences(userId);

    if (prefs) {
      if (!prefs.inAppNotifications) return null;

      const prefKey = TYPE_TO_PREF[type];
      if (prefKey && !prefs[prefKey]) return null;
    }
  }

  const notification = await Notification.create({
    userId,
    title,
    message,
    type,
    metadata: metadata || {},
  });

  const populatedNotification = await notification.populate("userId", "name email");

  // Emit real-time notification event via Socket.IO
  const io = getIO();
  if (io) {
    const targetUserId = populatedNotification.userId._id || populatedNotification.userId;
    io.to(`user_${targetUserId.toString()}`).emit("new-notification", populatedNotification);
  }

  return populatedNotification;
};

/**
 * Get all notifications for a user
 * @param {string} userId - User ID
 * @param {Object} queryParams - Query parameters
 * @param {number} [queryParams.page=1] - Page number
 * @param {number} [queryParams.limit=20] - Items per page
 * @param {boolean} [queryParams.isRead] - Filter by read status
 * @returns {Promise<Object>} - Notifications and metadata
 */
export const getUserNotifications = async (userId, queryParams = {}) => {
  const { page = 1, limit = 20, isRead, type } = queryParams;

  const filters = { userId };

  if (isRead !== undefined) {
    filters.isRead = isRead === "true" || isRead === true;
  }

  if (type) {
    if (type === "jobs") {
      filters.type = { $in: ["job-update", "application", "new_application"] };
    } else if (type === "interviews") {
      filters.type = { $in: ["interview"] };
    } else if (type === "system") {
      filters.type = { $in: ["info", "warning", "success", "error", "skill_gap_alert", "system", "message"] };
    } else {
      filters.type = type;
    }
  }

  const skip = (page - 1) * limit;

  const [notifications, totalCount] = await Promise.all([
    Notification.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("userId", "name email"),
    Notification.countDocuments(filters),
  ]);

  return {
    notifications,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / limit),
    },
  };
};

/**
 * Get a single notification by ID
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} - Notification document
 */
export const getNotificationById = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId).populate(
    "userId",
    "name email",
  );

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  const notificationUserId = notification.userId?._id || notification.userId;
  if (!notificationUserId) {
    throw new AppError("Notification owner not found", 404);
  }

  // Verify ownership
  if (notificationUserId.toString() !== userId) {
    throw new AppError("Not authorized to access this notification", 403);
  }

  return notification;
};

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} - Updated notification
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  // Verify ownership
  if (notification.userId.toString() !== userId) {
    throw new AppError("Not authorized to update this notification", 403);
  }

  notification.isRead = true;
  await notification.save();

  return notification.populate("userId", "name email");
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Update result
 */
export const markAllNotificationsAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true },
    { new: true },
  );

  return result;
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<void>}
 */
export const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  // Verify ownership
  if (notification.userId.toString() !== userId) {
    throw new AppError("Not authorized to delete this notification", 403);
  }

  await Notification.findByIdAndDelete(notificationId);
};

/**
 * Delete all notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Delete result
 */
export const deleteAllNotifications = async (userId) => {
  const result = await Notification.deleteMany({ userId });
  return result;
};

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Count of unread notifications
 */
export const getUnreadNotificationCount = async (userId) => {
  const count = await Notification.countDocuments({ userId, isRead: false });
  return count;
};

/**
 * Delete multiple notifications for a user in bulk
 * @param {string[]} notificationIds - Array of Notification IDs
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} - Delete result containing deletedCount
 */
export const deleteNotificationsBulk = async (notificationIds, userId) => {
  const result = await Notification.deleteMany({
    _id: { $in: notificationIds },
    userId: userId,
  });
  return result;
};
