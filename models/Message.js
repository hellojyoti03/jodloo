const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },  // Automatically add timestamp
  seenBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],  // Array of users who have seen the message
});

module.exports = mongoose.model('Message', messageSchema);
