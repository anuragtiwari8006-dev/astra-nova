
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'faculty', 'student'], required: true },
  assignedDepartment: { type: String },
  assignedSemester: { type: Number },
  assignedSubject: { type: String },
  roomNumber: { type: String },
  freeSlots: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);