import mongoose from "mongoose";
import { UAParser } from 'ua-parser-js';

const { Schema } = mongoose;

/**
 * Initializes MongoDB connection using Mongoose
 * @async
 * @param {string} [uri] - MongoDB connection URI. Defaults to MONGO_URI env var or localhost cluster
 * @returns {Promise<mongoose.Connection>} The established MongoDB connection
 * @throws {Error} If connection fails within serverSelectionTimeoutMS
 */
async function initializeMongo(uri) {
    const mongoUri = uri || process.env.MONGO_URI || "mongodb://localhost:27017/?directConnection=true";
    

    await mongoose.connect(mongoUri, {
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


function getDeviceInfo(req) {
    try {
        const ua = req.headers['user-agent'];
        console.log('[getDeviceInfo] User-Agent header:', ua);
        
        if (!ua) {
            console.log('[getDeviceInfo] No User-Agent header, retornando device default');
            return {
                type: 'Desktop',
                vendor: 'Unknown',
                model: 'Unknown'
            };
        }

        const parser = new UAParser(ua);
        const result = parser.getResult();
        
        console.log('[getDeviceInfo] UAParser result:', JSON.stringify(result, null, 2));
        
        // Construir objeto device con valores seguros
        const device = {
            type: result.device?.type || 'Desktop',
            vendor: result.browser?.name || result.device?.vendor || 'Unknown',
            model: result.os?.name || result.device?.model || 'Unknown',
        };

        console.log('[getDeviceInfo] Device construido:', device);
        return device;
    } catch (error) {
        console.error("[getDeviceInfo] Error parsing user agent:", error.message);
        // Retornar device default en caso de error
        return {
            type: 'Desktop',
            vendor: 'Unknown',
            model: 'Unknown'
        };
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
    
    // Validar device - ser tolerante con valores vacíos
    let validDevice = null;
    if (device && typeof device === "object") {
        // Todos los campos deben ser strings (no undefined, no null)
        if (typeof device.type === "string" && 
            typeof device.vendor === "string" && 
            typeof device.model === "string") {
            validDevice = device;
            console.log('[createAccessLog] Device válido guardado:', device);
        } else {
            console.warn('[createAccessLog] Device rechazado - campos inválidos:', {
                type: typeof device.type,
                vendor: typeof device.vendor,
                model: typeof device.model,
                device
            });
        }
    } else {
        console.warn('[createAccessLog] Device no es un objeto válido:', device);
    }
    
    const hasValidSuccessful = successful === undefined || typeof successful === "boolean";

    // Validar campos requeridos
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
    } else {
        console.log('[createAccessLog] No se agregó device al payload');
    }

    if (successful !== undefined) {
        payload.successful = successful;
    }

    console.log('[createAccessLog] Payload final:', payload);
    const log = await AccessLog.create(payload);
    console.log('[createAccessLog] Log creado:', log._id);
    return log;
}

export { initializeMongo, AccessLogSchema, AccessLog, createAccessLog, getDeviceInfo };