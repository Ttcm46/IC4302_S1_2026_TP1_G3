const mongoose = require('mongoose');
const schema = mongoose.schema;

const AccessLogSchema = new Schema({
    ip: {
        type: String,
        required: true
    },
    device: {
        type: String,
        required: true
    },
    successful: {
        type: Boolean,
        required: true
    }
}, {timestamps: true});

const AccessLog = mongoose.model('AccessLog', AccessLogSchema);
module.exports = AccessLog;