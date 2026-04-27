import mongoose from "mongoose";
import { UAParser } from 'ua-parser-js';

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
 * @property {string} userId - User identifier associated with the access attempt
 * @property {DeviceSchema} device - Device information
 * @property {string} action - Access action type: login or logout (required)
 * @property {boolean} successful - Whether the access was successful
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
            required: false,
        },
        device: {
            type: DeviceSchema,
            required: false,
        },
        action: {
            type: String,
            required: true,
            enum: ["login", "logout"],
        },
        successful: {
            type: Boolean,
            required: false,
        },
    },
    { timestamps: true },
);

/**
 * AccessLog model for MongoDB
 * @type {mongoose.Model}
 */
const AccessLog = mongoose.models.AccessLog || mongoose.model("AccessLog", AccessLogSchema);


async function getDeviceInfo(req) {
    const ua = req.headers['user-agent'];
    if (!ua) {
        return null;
    }

    try {
        const parser = new UAParser(ua);
        const result = parser.getResult();
        
        // Retornar el dispositivo aunque tenga campos undefined
        // Anterior: validaba que TODOS los campos fueran strings no-vacíos
        // Nuevo: permite valores undefined o vacíos
        const device = {
            type: result.device.type || 'Desktop',
            vendor: result.browser.vendor || result.device.vendor || 'Unknown',
            model: result.browser.name || result.device.model || '',
        };

        return device;
    } catch (error) {
        console.error("Error parsing user agent:", error.message);
        return null;
    }
}

/**
 * Creates a new access log entry in the database
 * @async
 * @param {Object} params - Parameters object
 * @param {string} params.ip - IP address of the access attempt
 * @param {string} params.userIdOrToken - User identifier or token associated with the access attempt
 * @param {Object} params.device - Device information object
 * @param {string} params.device.type - Device type
 * @param {string} params.device.vendor - Device vendor
 * @param {string} params.device.model - Device model
 * @param {string} params.action - Access action type: login or logout
 * @param {boolean} params.successful - Whether the access was successful
 * @returns {Promise<mongoose.Document>} The created access log document
 * @throws {Error} If any required field is missing or invalid
 */
async function createAccessLog({ ip, userIdOrToken, userId, device, action, successful }) {
    // Normalizar userId si viene como objeto o undefined
    const effectiveUserId = userId || userIdOrToken || 'unknown';
    const finalUserId = String(effectiveUserId).trim() || 'unknown';
    
    const hasValidUserId = typeof finalUserId === "string" && finalUserId.length > 0;
    const hasValidAction = action === "login" || action === "logout";
    
    // Validar device pero ser tolerante - si no es válido, ignorarlo
    let validDevice = null;
    if (device && typeof device === "object") {
        if (typeof device.type === "string" && 
            typeof device.vendor === "string" && 
            typeof device.model === "string") {
            validDevice = device;
        }
    }
    
    const hasValidDevice = validDevice || device === undefined;
    const hasValidSuccessful = successful === undefined || typeof successful === "boolean";

    // Validar campos requeridos - pero loguear en lugar de lanzar error
    if (!ip || !hasValidUserId || !hasValidAction || !hasValidSuccessful) {
        console.warn("[createAccessLog] Invalid payload - some required fields missing:", {
            hasValidIp: !!ip,
            hasValidUserId,
            hasValidAction,
            hasValidSuccessful
        });
        return null;
    }

    const payload = { ip, userId: finalUserId, action };

    if (validDevice) {
        payload.device = validDevice;
    }

    if (successful !== undefined) {
        payload.successful = successful;
    }

    const log = await AccessLog.create(payload);
    return log;
}

export { initializeMongo, AccessLogSchema, AccessLog, createAccessLog, getDeviceInfo };