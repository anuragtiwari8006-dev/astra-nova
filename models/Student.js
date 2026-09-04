
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rollNumber: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  semester: { type: Number, required: true, default: 1 },
  feeDetails: {
    totalFee: { type: Number, default: 120000 },
    paidAmount: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);