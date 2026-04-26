import mongoose from "mongoose";
import { UAParser } from "ua-parser-js";

const { Schema } = mongoose;

/**
 * Initializes MongoDB connection using Mongoose
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise<mongoose.Connection>}
 */
async function initializeMongo(
  uri = process.env.mongodb_URL || process.env.MONGO_URI || "mongodb://localhost:27017",
) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  return mongoose.connection;
}

const DeviceSchema = new Schema(
  {
    type: { type: String, required: true },
    vendor: { type: String, required: true },
    model: { type: String, required: true },
  },
  { _id: false },
);

const AccessLogSchema = new Schema(
  {
    ip: { type: String, required: true },
    userId: { type: String, required: false },
    device: { type: DeviceSchema, required: false },
    action: { type: String, required: true, enum: ["login", "logout"] },
    successful: { type: Boolean, required: false },
  },
  { timestamps: true },
);

const AccessLog = mongoose.models.AccessLog || mongoose.model("AccessLog", AccessLogSchema);

/**
 * Parses User-Agent header into device info object.
 * Returns undefined if header is missing or device fields are not strings.
 * @param {import('express').Request} req
 * @returns {{ type: string, vendor: string, model: string } | undefined}
 */
function getDeviceInfo(req) {
  const ua = req.headers["user-agent"];
  if (!ua) return undefined;

  if (typeof UAParser !== "function") {
    return undefined;
  }

  let result;
  try {
    const parser = new UAParser(ua);
    result = parser.getResult();
  } catch {
    return undefined;
  }

  const device = {
    type: result?.device?.type || "desktop",
    vendor: result?.device?.vendor,
    model: result?.device?.model,
  };

  if (
    typeof device.type !== "string" ||
    typeof device.vendor !== "string" ||
    typeof device.model !== "string"
  ) {
    return undefined;
  }

  return device;
}

/**
 * Creates a new access log entry in MongoDB.
 * Silently skips if required fields are missing/invalid — never throws.
 * @param {{ ip: string, userId: string, device?: object, action: string, successful?: boolean }} params
 */
async function createAccessLog({ ip, userId, device, action, successful }) {
  const hasValidUserId = typeof userId === "string" && userId.trim().length > 0;
  const hasValidAction = action === "login" || action === "logout";
  const hasValidDevice =
    device === undefined ||
    (device &&
      typeof device.type === "string" &&
      typeof device.vendor === "string" &&
      typeof device.model === "string");
  const hasValidSuccessful = successful === undefined || typeof successful === "boolean";

  if (!ip || !hasValidUserId || !hasValidDevice || !hasValidAction || !hasValidSuccessful) {
    return; // skip invalid payloads silently
  }

  const payload = { ip, userId, action };
  if (device !== undefined) payload.device = device;
  if (successful !== undefined) payload.successful = successful;

  try {
    await AccessLog.create(payload);
  } catch (err) {
    // Log errors but don't crash the caller
    console.error("accessLogs: failed to write log entry:", err.message);
  }
}

// ============================================================
// Messages
// ============================================================
const MessageSchema = new Schema(
  {
    fromUserId: { type: String, required: true },
    toUserId:   { type: String, required: true },
    content:    { type: String, required: true },
    read:       { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

async function createMessage({ fromUserId, toUserId, content }) {
  return Message.create({ fromUserId, toUserId, content });
}

async function getInboxMessages(userId) {
  return Message.find({ toUserId: userId }).sort({ createdAt: -1 }).lean();
}

async function getConversationMessages(userId, otherUserId) {
  return Message.find({
    $or: [
      { fromUserId: userId, toUserId: otherUserId },
      { fromUserId: otherUserId, toUserId: userId },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();
}

export {
  initializeMongo,
  AccessLogSchema, AccessLog, createAccessLog, getDeviceInfo,
  Message, createMessage, getInboxMessages, getConversationMessages,
};
