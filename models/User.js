const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  image: {
    type: String, // প্রোফাইল পিকচার URL
  },
  role: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer',
  },
  isBlocked: {
    type: Boolean,
    default: false, // অ্যাডমিন ইউজারকে ব্লক করতে পারবে
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);