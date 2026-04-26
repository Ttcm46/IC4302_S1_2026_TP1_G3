import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Mongoose schema for messages
 * @type {mongoose.Schema}
 * @property {string} fromUserId - Sender user identifier (required)
 * @property {string} toUserId - Recipient user identifier (required)
 * @property {string} content - Message content (required)
 * @property {boolean} read - Whether the message has been read
 * @property {Date} createdAt - Timestamp of message creation (auto-generated)
 * @property {Date} updatedAt - Timestamp of last update (auto-generated)
 */
const MessageSchema = new Schema(
	{
		fromUserId: {
			type: String,
			required: true,
		},
		toUserId: {
			type: String,
			required: true,
		},
		content: {
			type: String,
			required: true,
		},
		read: {
			type: Boolean,
			required: false,
		},
	},
	{ timestamps: true },
);

/**
 * Message model for MongoDB
 * @type {mongoose.Model}
 */
const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

export { MessageSchema, Message };
