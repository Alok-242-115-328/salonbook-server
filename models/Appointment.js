const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  appointmentDate: {
    type: Date,
    required: true,
  },
  timeSlot: {
    type: String,
    required: true, // যেমন: "10:00 AM - 11:00 AM"
  },
  message: {
    type: String,
    required: false,
  },
  servicePrice: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid',
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Appointment', appointmentSchema);