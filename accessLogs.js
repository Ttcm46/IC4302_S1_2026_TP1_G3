import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Initializes MongoDB connection using Mongoose
 * @async
 * @param {string} [uri=process.env.MONGO_URI || "mongodb://root:admin@mongo:27017/?authSource=admin"] - MongoDB connection URI
 * @returns {Promise<mongoose.Connection>} The established MongoDB connection
 * @throws {Error} If connection fails within serverSelectionTimeoutMS
 */
async function initializeMongo(
    uri = process.env.MONGO_URI || "mongodb://root:admin@mongo:27017/?authSource=admin",
) {
    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
    });

    return mongoose.connection;
}

/**
 * Mongoose schema for device information
 * @type {mongoose.Schema}
 * @property {string} type - Device type (required)
 * @property {string} vendor - Device vendor/manufacturer (required)
 * @property {string} model - Device model name (required)
 */
const DeviceSchema = new Schema(
    {
        type: {
            type: String,
            required: true,
        },
        vendor: {
            type: String,
            required: true,
        },
        model: {
            type: String,
            required: true,
        },
    },
    { _id: false },
);

/**
 * Mongoose schema for access logs
 * @type {mongoose.Schema}
 * @property {string} ip - IP address of the access attempt (required)
 * @property {string} userId - User identifier associated with the access attempt (required)
 * @property {DeviceSchema} device - Device information (required)
 * @property {string} action - Access action type: login or logout (required)
 * @property {boolean} successful - Whether the access was successful (required)
 * @property {Date} createdAt - Timestamp of log creation (auto-generated)
 * @property {Date} updatedAt - Timestamp of last update (auto-generated)
 */
const AccessLogSchema = new Schema(
    {
        ip: {
            type: String,
            required: true,
        },
        userId: {
            type: String,
            required: true,
        },
        device: {
            type: DeviceSchema,
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: ["login", "logout"],
        },
        successful: {
            type: Boolean,
            required: true,
        },
    },
    { timestamps: true },
);

/**
 * AccessLog model for MongoDB
 * @type {mongoose.Model}
 */
const AccessLog = mongoose.models.AccessLog || mongoose.model("AccessLog", AccessLogSchema);

/**
 * Creates a new access log entry in the database
 * @async
 * @param {Object} params - Parameters object
 * @param {string} params.ip - IP address of the access attempt
 * @param {string} params.userId - User identifier associated with the access attempt
 * @param {Object} params.device - Device information object
 * @param {string} params.device.type - Device type
 * @param {string} params.device.vendor - Device vendor
 * @param {string} params.device.model - Device model
 * @param {string} params.action - Access action type: login or logout
 * @param {boolean} params.successful - Whether the access was successful
 * @returns {Promise<mongoose.Document>} The created access log document
 * @throws {Error} If any required field is missing or invalid
 */
async function createAccessLog({ ip, userId, device, action, successful }) {
    const hasValidDevice =
        device &&
        typeof device === "object" &&
        typeof device.type === "string" &&
        typeof device.vendor === "string" &&
        typeof device.model === "string";

    const hasValidUserId = typeof userId === "string" && userId.trim().length > 0;
    const hasValidAction = action === "login" || action === "logout";

    if (!ip || !hasValidUserId || !hasValidDevice || !hasValidAction || typeof successful !== "boolean") {
        throw new Error(
            "Invalid access log payload. Required: ip, userId, device{type,vendor,model}, action(login|logout), successful(boolean)",
        );
    }

    const log = await AccessLog.create({ ip, userId, device, action, successful });
    return log;
}

export { initializeMongo, AccessLogSchema, AccessLog, createAccessLog };