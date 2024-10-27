const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');
const ChatRequest = require('../models/chatRequest');
const ChatRoom = require('../models/chatRoom');
const message = require('../models/Message');

// Search for users by username
router.get('/search/:username', auth, async (req, res) => {
  try {
    const username = req.params.username;
    const userId = req.user.id;

    // Search for users matching the username
    const users = await User.find({ username: { $regex: username, $options: 'i' } })
      .select('username fullName');

    // Get chat requests sent by the logged-in user
    const sentRequests = await ChatRequest.find({ sender: userId }).select('receiver status');
    const receivedRequests = await ChatRequest.find({ receiver: userId }).select('sender status');
    
    // Get added users (accepted chat requests)
    const addedRequests = await ChatRequest.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'accepted'
    }).select('sender receiver');

    // Process each user and determine their status with the logged-in user
    const usersWithStatus = await Promise.all(users.map(async (user) => {
      let status = '';

      // Check if the user is added (accepted request exists)
      const isAdded = addedRequests.some((request) =>
        (request.sender.toString() === user._id.toString() || request.receiver.toString() === user._id.toString())
      );
      if (isAdded) {
        status = 'added';
      }

      // Check if the user has a pending request sent by the logged-in user
      const requestSent = sentRequests.find(request => request.receiver.toString() === user._id.toString() && request.status === 'pending');
      if (requestSent) {
        status = 'request_sent';
      }

      // Check if the user has sent a request to the logged-in user
      const requestReceived = receivedRequests.find(request => request.sender.toString() === user._id.toString() && request.status === 'pending');
      if (requestReceived) {
        status = 'received_request';
      }

      // Return the user data along with their status
      return {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        status: status || 'no_status' // Default to 'no_status' if no relationship exists
      };
    }));

    res.status(200).json(usersWithStatus);
  } catch (err) {
    console.error("Error searching for users:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Send a chat request
router.post('/request', auth, async (req, res) => {
  try {
    const { receiverUsername } = req.body;
    const sender = req.user.id;

    const receiver = await User.findOne({ username: receiverUsername });
    if (!receiver) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check for existing pending request
    const existingRequest = await ChatRequest.findOne({ sender, receiver: receiver._id, status: 'pending' });
    if (existingRequest) {
      console.log(`Request already sent from ${sender} to ${receiver._id}`);
      return res.status(400).json({ msg: 'Chat request already sent' });
    }

    // Create new chat request
    const chatRequest = new ChatRequest({
      sender,
      receiver: receiver._id
    });

    await chatRequest.save();
    console.log(`Request created from ${sender} to ${receiver._id}`);
    res.status(200).json({ msg: 'Chat request sent' });
  } catch (err) {
    console.error("Error sending chat request:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get pending chat requests

router.get('/requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Fetching requests for user ID: ${userId}`);
    
    // Fetch chat requests where the logged-in user is the receiver
    const chatRequests = await ChatRequest.find({ receiver: userId, status: 'pending' })
      .populate('sender', 'username email');

    console.log("Found requests:", chatRequests);
    res.status(200).json(chatRequests);
  } catch (err) {
    console.error("Error getting chat requests:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/added-requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all accepted chat requests where the logged-in user is either the sender or the receiver
    const acceptedRequests = await ChatRequest.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'accepted'
    });

    // Map the requests to get the request ID, name, and username of the second party (other user)
    const addedRequests = await Promise.all(acceptedRequests.map(async (request) => {
      const secondPartyId = request.sender.toString() === userId ? request.receiver : request.sender;
      const secondPartyUser = await User.findById(secondPartyId).select('fullName username');

      return {
        requestId: request._id, // Include the request ID
        name: secondPartyUser.fullName,
        username: secondPartyUser.username
      };
    }));

    res.status(200).json(addedRequests);
  } catch (err) {
    console.error("Error fetching added chat requests:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/remove-user/:username', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username } = req.params;

    // Find the user to be removed by username
    const userToRemove = await User.findOne({ username });
    if (!userToRemove) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Delete any chat requests where the logged-in user and the user to remove are involved
    await ChatRequest.deleteMany({
      $or: [
        { sender: userId, receiver: userToRemove._id },
        { sender: userToRemove._id, receiver: userId }
      ]
    });

    // Delete any chat rooms where both users are participants
    await ChatRoom.deleteMany({
      participants: { $all: [userId, userToRemove._id] }
    });

    res.status(200).json({ msg: `User ${username} and all associated chat data have been removed.` });
  } catch (err) {
    console.error("Error removing user and associated chat data:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
// Accept a chat request
router.post('/accept', auth, async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await ChatRequest.findById(requestId);

    if (!request || request.receiver.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Request not found or unauthorized' });
    }

    request.status = 'accepted';
    await request.save();

    res.status(200).json({ msg: 'Chat request accepted' });
  } catch (err) {
    console.error("Error accepting chat request:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Start a chat room after a chat request has been accepted
router.post('/start-chat', auth, async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await ChatRequest.findById(requestId);

    if (!request || request.status !== 'accepted') {
      return res.status(400).json({ msg: 'Chat request must be accepted first' });
    }

    // Check if a chat room already exists between these users
    const existingChatRoom = await ChatRoom.findOne({
      participants: { $all: [request.sender, request.receiver] }
    });

    if (existingChatRoom) {
      return res.status(200).json({ msg: 'Chat room already exists', chatRoomId: existingChatRoom._id });
    }

    // Create a new chat room
    const chatRoom = new ChatRoom({
      participants: [request.sender, request.receiver]
    });

    await chatRoom.save();
    res.status(200).json({ msg: 'Chat room created successfully', chatRoomId: chatRoom._id });
  } catch (err) {
    console.error("Error starting chat room:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


// Get chat rooms for the authenticated user
// Get chat rooms for the authenticated user


router.get('/rooms', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all chat rooms where the user is a participant
    const chatRooms = await ChatRoom.find({ participants: userId }).populate('participants', 'fullName username email');

    // Prepare an array to store the processed rooms
    const roomsWithMessages = await Promise.all(chatRooms.map(async (room) => {
      const otherParticipant = room.participants.find(participant => participant._id.toString() !== userId);

      // Fetch the latest message from the Message collection
      const latestMessage = await message.findOne({ roomId: room._id }).sort({ timestamp: -1 });

      // Count the number of unread messages for the user
      const unreadMessagesCount = await message.countDocuments({
        roomId: room._id,
        sender: { $ne: userId },  // Messages from other participants
        isRead: false  // Only unread messages
      });

      return {
        roomId: room._id,
        name: otherParticipant.fullName,
        username: otherParticipant.username,
        email: otherParticipant.email,
        latestMessage: latestMessage ? latestMessage.text : 'Click to start the conversation',
        timestamp: latestMessage ? latestMessage.timestamp : new Date(),
        unreadMessagesCount
      };
    }));

    // Return the rooms along with the latest messages and unread message counts
    res.status(200).json(roomsWithMessages);
  } catch (err) {
    console.error("Error getting chat rooms:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get sent chat requests
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch chat requests where the logged-in user is the sender
    const sentRequests = await ChatRequest.find({ sender: userId })
      .populate('receiver', 'username email');

    if (sentRequests.length === 0) {
      return res.status(404).json({ msg: 'No sent requests found' });
    }

    res.status(200).json(sentRequests);
  } catch (err) {
    console.error("Error fetching sent requests:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/delete-all-chats', auth, async (req, res) => {
  try {
    // Delete all chat requests
    await ChatRequest.deleteMany({});
    console.log("All chat requests have been deleted.");

    // Delete all chat rooms
    await ChatRoom.deleteMany({});
    console.log("All chat rooms have been deleted.");

    res.status(200).json({ msg: 'All chat data (requests, rooms) have been deleted successfully.' });
  } catch (err) {
    console.error("Error deleting chat data:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/sent-requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch chat requests where the logged-in user is the sender
    const sentRequests = await ChatRequest.find({ sender: userId })
      .populate('receiver', 'username fullName email'); // Populate receiver info (username, fullName, email)

    // If no sent requests found, return a 404 message
    if (!sentRequests.length) {
      return res.status(404).json({ msg: 'No sent requests found' });
    }

    // Map through the requests and add the profile image URL for each receiver
    const requestsWithProfileImages = sentRequests.map(request => {
      return {
        ...request.toObject(),
        receiver: {
          ...request.receiver.toObject(),
          profileImage: `https://robohash.org/stefan-two`
        }
      };
    });

    // Respond with the list of sent requests, including profile image URLs
    res.status(200).json(requestsWithProfileImages);
  } catch (err) {
    console.error("Error fetching sent requests:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


router.delete('/withdraw-request/:requestId', auth, async (req, res) => {
  try {
    const userId = req.user.id; // Authenticated user's ID
    const { requestId } = req.params; // ID of the chat request to be deleted

    // Find the chat request by ID
    const chatRequest = await ChatRequest.findById(requestId);

    if (!chatRequest) {
      return res.status(404).json({ msg: 'Chat request not found' });
    }

    // Ensure that the logged-in user is the sender of the chat request
    if (chatRequest.sender.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to withdraw this request' });
    }

    // Delete the chat request
    await chatRequest.deleteOne();

    res.status(200).json({ msg: 'Chat request withdrawn successfully' });
  } catch (err) {
    console.error("Error withdrawing chat request:", err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
module.exports = router;
