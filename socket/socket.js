const jwt = require('jsonwebtoken');  // Token verification
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatRoom');
const Message = require('../models/Message');
const User = require('../models/user');  // Import your User model

const setupSocket = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.query.token;
    console.log('Token being passed to socket:', token);  // Debugging

    if (!token) {
      return next(new Error('Authentication error: Token not provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.user.id;  // Attach user ID from the token
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    try {
      const user = await User.findById(socket.userId).lean();
      if (!user) return socket.emit('error', 'User not found');
      socket.emit('userDetails', {
        userId: user._id,
        name: user.fullName,
        username: user.username,
        email: user.email,
      });
      console.log(user.fullName)
      socket.on('joinRoom', async ({ roomId }) => {
        try {
          console.log(roomId);
          const room = await ChatRoom.findById(roomId);
          if (!room) return socket.emit('error', 'Room not found');

          if (!room.participants.includes(socket.userId)) {
            return socket.emit('error', 'Unauthorized to join this room');
          }

          const participants = await User.find({
            _id: { $in: room.participants },
          }).lean();

          const otherParticipants = participants.filter(participant => participant._id.toString() !== socket.userId);

          const participantDetails = otherParticipants.map(participant => ({
            userId: participant._id,
            name: participant.fullName,
            username: participant.username,
          }));
          socket.emit('roomParticipants', participantDetails);

          socket.join(roomId);

          // Fetch and send previous messages
          const messages = await Message.find({ roomId }).sort({ timestamp: 1 }).lean();
          const formattedMessages = messages.map(msg => ({
            ...msg,
            isSentByYou: msg.sender.toString() === socket.userId,
          }));
          socket.emit('previousMessages', formattedMessages);

          // Mark all messages as seen by current user
          await Message.updateMany(
            { roomId, seenBy: { $ne: socket.userId } },
            { $addToSet: { seenBy: socket.userId } }
          );

          // Notify others that messages have been seen
          socket.broadcast.to(roomId).emit('messagesSeen', {
            userId: socket.userId,
            roomId,
            timestamp: new Date(),
          });

          // Handle sending messages
          socket.on('sendMessage', async ({ message }) => {
            try {
              const newMessage = new Message({
                roomId,
                sender: socket.userId,
                text: message,
                seenBy: [socket.userId], // Automatically mark as seen by the sender
              });
              await newMessage.save();

              const messageData = {
                roomId,
                text: newMessage.text,
                sender: socket.userId,
                timestamp: newMessage.timestamp,
              };

              // // Emit the message to the sender with `isSentByYou: true`
              // socket.emit('message', { ...messageData, isSentByYou: true });

              // Emit the message to all other clients in the room with `isSentByYou: false`
              socket.broadcast.to(roomId).emit('message', { ...messageData, isSentByYou: false });
            } catch (err) {
              console.error('Error sending message:', err);
              socket.emit('error', 'Failed to send message');
            }
          });

        } catch (err) {
          console.error('Error joining room:', err);
          socket.emit('error', 'Internal server error');
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
      });

    } catch (error) {
      console.error('Error fetching user details:', error);
      socket.emit('error', 'Failed to retrieve user details');
    }
  });
};

module.exports = setupSocket;
