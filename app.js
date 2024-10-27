const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');
const budgetRoutes = require('./routes/budget');
const expenseRoutes = require('./routes/expense');
const investmentRoutes = require('./routes/investment');
const goalRoutes = require('./routes/goal');
const transferRoutes = require('./routes/transfer');
const udhaarRoutes = require('./routes/udhaar');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/user');
const categoryRoutes = require('./routes/category');
const cors = require('cors');
const notificationRoutes = require('./routes/notifications'); // Add this line
const http = require('http');
const socketSetup = require('./socket/socket');
require('dotenv').config();
const googleAuthRoutes = require('./routes/googleAuth');
const subscriptionRoutes = require('./routes/subscription'); 

const app = express();
app.use(cors())
const server = http.createServer(app);
socketSetup(server);

// Firebase Admin Initialization
// var admin = require("firebase-admin");
const errorHandler = require('./middleware/errorHandler');

// const adminConfig = {
//   "projectId": "jodloo-e08db",
//   "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDQj9un+g1q1RC4\nzhOWmOzJnBcK8sNJZB7yXtLts83TDWcZ/Eo/3EglmjeKdEmq+AZ5g6OekMz3Tp+6\n7BY8/e2bxb+zYMu61s5pu2f+GnXU3JD8IPu18XMxaXcSVj2ii4PtgRXpWV0cv3a4\n3tuh/qunU0L3WN3Voyx0cYx2fIoPETk01IRFBO12z128DDNvNtq7828wRluSy8Yv\nvWiiXO2jmBgzSFaGZaTjMOrfjSn8YtH6MRUu9z/QTkFh+WvhZkHjke4K+ux+eSpB\nhypr4tHQ9PgJHy0/qjv5Ey0ev2PtQCbH0g6nHCp/uXQsjyWKrYCOFrSI46JF0h5p\nlq2IHbCdAgMBAAECggEAGK3dNSxOqCScPPINuVVRN64jv+ToHOgfDVkRJpWPNnkw\niQ+kjZf4ZZKxHc4S5YtB4OEl3F6QEneYSRskqoT1t+gXfhdnJC3E8Rf+/z+MT+rl\nsSAKCQaQNfmf4GiaFIDj1JfgyuMLNJqnZsrgPHQRRdSBaRl37o7HdOP21hJ4l72g\nSBptWKf7ArsOuP9TzEXnt49lPyYvOE4KgtBTEM2W8E5znKNvoD/ulLryji3S2f8+\nvOHesqljtM5Q7/KW/oJHf5n5GmCjKfAVKw/jZ9pLPbc+gspchycGPAYIsxOJ2Hut\nyPZelA1arHiZBZV6Ty4BzgjlKvQ7rp64nfMsVDaetQKBgQDwVV6BoEpPp16Kw9RR\nD0ER3OmiUDi6FQeyfigsQawaWZS6nAenDaTyl7uG0Bav85nPqM0UOk05NiwGSfnl\n5Lr+mtMeh579Ou/8NUJSZBXgV4IQ8SB94ProtaW1G5Sw/klyZ5aJwChEmEiKqBe0\nKMozyMFAq9LE+3tu1Tg7Q4EldwKBgQDeKEry/lfK6a6jf37dVl0b+jxQPah5GkuX\nzu9kjD5aE4g8xmQIDOumOVFuuAEWtdNRNb2LFstrtU0N9YRtbG9hdcotFm54CtCc\nsiWqhFPsBvvbkl7mxz7PpajMc2Vtk6NX0zRe9Wnr2hAKr/3VhBOpVQpYkYYIRodv\nasg0Sy6viwKBgQCOrmAZHQyBFaBvSau3JBNBg6HBF1dWQj37niJDhAmk6yH9V7zD\nVLpku+g9NTUC6OCcBF8cbzCBksO4SBrwfUb2+Pv12BZvyJnJZeUl/P1v3wP9AuqD\nURolJhJm3yT7nzwDi7Q3u7ksYCxRBVJtRvoknD7/IgNTpum09ykXJhB6KQKBgE5D\ng6P3VpZ1nMCcueTf+A1TKsxZ7HA9g0QH8u5JOe4h020Vt0fexWXZ64ZF7JxDkh6a\nABxv+1oGlQ7F39Fs0hBTntYjgOdpZ/TMDdj0pVwRWckQ174Vk1sz0TO1s5XW3USj\nc1/AtYARYnVhats9nG+bNfndyoo/zpbB16YUlm3hAoGAe0TitQOd1jJDrZvXa23s\nUZxafQoEDasgJknyViHcQG2y7ApwXFncEHTG3Krtbk5bVcg4ANH8ulA86ttFy2On\nK1abLOAdCaGgQgMe4Y1x+Nw3hprx+gIxOqNJpGZvEJHL3dPr4hKYjXxRZ+vwX7e1\n/5GW+2ZNzKuB9Nn+/eUqdEA=\n-----END PRIVATE KEY-----\n"
//     .replace(/\\n/g, '\n'),
//   "clientEmail": "firebase-adminsdk-6ix4j@jodloo-e08db.iam.gserviceaccount.com",
// };

// admin.initializeApp({
//   credential: admin.credential.cert(adminConfig),
//   databaseURL: "https://jodloo-e08db.firebaseio.com"
// });

connectDB();

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/transaction', expenseRoutes);
app.use('/api/investment', investmentRoutes);
app.use('/api/goal', goalRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/udhaar', udhaarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notification', notificationRoutes); // Use the new route
app.use('/api/google', googleAuthRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT,HOST, () => {
  console.log(`Server is running on port ${PORT}`);
});
