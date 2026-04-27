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
		// implementación de mensajes leídos
		isRead: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true },
);

/**
 * Message model for MongoDB
 * @type {mongoose.Model}
 */
const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

async function createMessage({fromUserId, toUserId, content}) {
    return Message.create({fromUserId, toUserId, content});
}

async function getInboxMessages(userId) {
  // Obtener tanto mensajes recibidos como enviados
  const allMessages = await Message.find({
    $or: [
      { toUserId: userId },      // Mensajes recibidos
      { fromUserId: userId }     // Mensajes enviados
    ]
  }).sort({ createdAt: -1 }).lean();

  // Deduplicar por conversación: para cada contacto, mantener solo el mensaje más reciente
  const conversationMap = new Map();
  for (const msg of allMessages) {
    // Determinar quién es el "otro" usuario en la conversación
    const otherUserId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
    
    // Si esta conversación aún no está en el mapa, agregarla
    if (!conversationMap.has(otherUserId)) {
      conversationMap.set(otherUserId, msg);
    }
  }

  // Convertir el mapa en array ordenado por fecha descendente
  return Array.from(conversationMap.values()).sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
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

async function clearAllMessages() {
  const result = await Message.deleteMany({});
  return result;
}

async function markMessagesAsRead(userId, otherUserId) {
  const result = await Message.updateMany(
    {
      toUserId: userId,
      fromUserId: otherUserId,
      isRead: false
    },
    { isRead: true }
  );
  return result;
}

async function getUnreadCount(userId, otherUserId) {
  const count = await Message.countDocuments({
    toUserId: userId,
    fromUserId: otherUserId,
    isRead: false
  });
  return count;
}

export { MessageSchema, Message, createMessage, getInboxMessages, getConversationMessages, clearAllMessages, markMessagesAsRead, getUnreadCount };
