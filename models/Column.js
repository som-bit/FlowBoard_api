const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  boardId: { type: String, ref: 'Board', required: true },
  title: { type: String, required: true },
  position: { type: Number, required: true }, // Critical for Spaced Integer Indexing
  isDeleted: { type: Boolean, default: false },
  updatedAt: { type: Date, required: true },
  createdAt: { type: Date, required: true }
});

module.exports = mongoose.model('Column', columnSchema);