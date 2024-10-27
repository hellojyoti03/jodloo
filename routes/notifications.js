const { Expo } = require('expo-server-sdk');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');

// Send a notification
router.post('/send', auth, async (req, res) => {
  const expo = new Expo();
  const { title, body, userId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user || !user.expoPushToken) {
      return res.status(404).json({ msg: 'User not found or Expo Push Token not available' });
    }

    if (!Expo.isExpoPushToken(user.expoPushToken)) {
      return res.status(400).json({ msg: 'Invalid Expo Push Token' });
    }

    const messages = [];
    messages.push({
      to: user.expoPushToken,
      sound: 'default',
      title: title || 'No Title',
      body: body || 'No Body',
      data: { withSome: 'data' }, // You can customize this if needed
    });

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }

    res.status(200).json({ msg: 'Notification sent successfully', tickets });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ msg: 'Failed to send notification', error });
  }
});

router.post('/send-with-image', auth, async (req, res) => {
    const expo = new Expo();
    const { title, body, imageUrl, userId } = req.body;
  
    try {
      const user = await User.findById(userId);
      if (!user || !user.expoPushToken) {
        return res.status(404).json({ msg: 'User not found or Expo Push Token not available' });
      }
  
      if (!Expo.isExpoPushToken(user.expoPushToken)) {
        return res.status(400).json({ msg: 'Invalid Expo Push Token' });
      }
  
      const messages = [];
      messages.push({
        to: user.expoPushToken,
        sound: 'default',
        title: title || 'No Title',
        body: body || 'No Body',
        data: {
          withSome: 'data',
          imageUrl: imageUrl || ''
        },
        android: {
          notification: {
            sound: 'default',
            body: body || 'No Body',
            title: title || 'No Title',
            imageUrl: imageUrl || '',
            channelId: 'new_order',
          },
        },
        ios: {
          sound: 'default',
          body: body || 'No Body',
          title: title || 'No Title',
          attachments: [
            {
              url: imageUrl || ''
            }
          ],
        },
      });
  
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];
  
      for (let chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error(error);
        }
      }
  
      res.status(200).json({ msg: 'Notification with image sent successfully', tickets });
    } catch (error) {
      console.error('Error sending notification with image:', error);
      res.status(500).json({ msg: 'Failed to send notification with image', error });
    }
  });
module.exports = router;
