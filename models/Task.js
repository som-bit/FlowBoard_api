const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  columnId: { type: String, ref: 'Column', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['To Do', 'In Progress', 'Done'], required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  dueDate: { type: Date, default: null },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  position: { type: Number, required: true }, // For ordering within the column
  isDeleted: { type: Boolean, default: false },
  updatedAt: { type: Date, required: true },
  createdAt: { type: Date, required: true }
});

module.exports = mongoose.model('Task', taskSchema);
