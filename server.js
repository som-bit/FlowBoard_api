require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON payloads from the Flutter client

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API is running', timestamp: new Date() });
});

// We will mount the auth and sync routes here shortly
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/sync'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 FlowBoard API server running on port ${PORT}`);
});