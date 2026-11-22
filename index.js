const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Models & Middleware (সবার আগে ইমপোর্ট করতে হবে)
const User = require('./models/User');
const Appointment = require('./models/Appointment');
const Service = require('./models/Service');
const Transaction = require('./models/Transaction');
const verifyAdmin = require('./middlewares/verifyAdmin');

// Stripe Initialize
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// ==========================================
// STRIPE WEBHOOK (express.json এর আগে থাকতে হবে)
// ==========================================
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const appointmentId = session.metadata.appointmentId;
    
    try {
      const appointment = await Appointment.findById(appointmentId);
      if (appointment) {
        appointment.paymentStatus = 'paid';
        await appointment.save();

        const transaction = new Transaction({
          appointmentId: appointmentId,
          customerId: appointment.customerId,
          amount: session.amount_total / 100,
          currency: session.currency,
          stripeSessionId: session.id,
          status: 'paid'
        });
        await transaction.save();
        console.log("✅ Payment successful & DB updated!");
      }
    } catch (err) {
      console.error("DB Update error:", err);
    }
  }

  res.json({ received: true });
});

// JSON Parser (Webhook এর পর)
app.use(express.json());

// ==========================================
// BASIC ROUTE
// ==========================================
app.get('/', (req, res) => {
  res.send('SalonBook Server is running!');
});

// ==========================================
// PAYMENT CHECKOUT SESSION (সম্পূর্ণ ঠিক করা হলো)
// ==========================================
app.post('/api/payment/create-checkout-session', async (req, res) => {
  try {
    const { appointmentId } = req.body;

    // অ্যাপয়েন্টমেন্ট ডাটা বের করা
    const appointment = await Appointment.findById(appointmentId).populate('serviceId');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    // Stripe Checkout Session তৈরি করা
    const session = await stripe.checkout.sessions.create({
      managed_payments: { enabled: false }, // 👈 Tax code এরর ফিক্স করার জন্য
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: appointment.serviceId.serviceName },
          unit_amount: appointment.servicePrice * 100, // সেন্টসে কনভার্ট
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: { appointmentId: appointmentId },
      success_url: `http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}&appointment_id=${appointmentId}`,
      cancel_url: `http://localhost:3000/payment/cancel`,
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ADMIN ROUTES (Overview)
// ==========================================
app.get('/api/admin/overview', verifyAdmin, async (req, res) => {
  try {
    const totalCustomers = await mongoose.connection.db.collection('user').countDocuments({ role: 'customer' });
    const activeServices = await Service.countDocuments({ status: 'active' });
    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      data: { totalCustomers, activeServices, pendingAppointments }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// PUBLIC SERVICES
// ==========================================
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/services/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ADMIN SERVICES ROUTES
// ==========================================
app.get('/api/admin/services', verifyAdmin, async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/services', verifyAdmin, async (req, res) => {
  try {
    const { serviceName, category, description, price, duration, image, status } = req.body;
    if (Number(price) <= 0) return res.status(400).json({ success: false, message: 'Price must be positive' });
    if (Number(duration) <= 0) return res.status(400).json({ success: false, message: 'Duration must be positive' });

    const newService = new Service({
      serviceName, category, description, price: Number(price), duration: Number(duration), image, status: status || 'active'
    });
    await newService.save();
    res.status(201).json({ success: true, data: newService, message: 'Service created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/admin/services/:id', verifyAdmin, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// সার্ভিস আপডেট করা (Edit)
app.put('/api/admin/services/:id', verifyAdmin, async (req, res) => {
  try {
    const { serviceName, category, description, price, duration, image, status } = req.body;

    if (Number(price) <= 0) return res.status(400).json({ success: false, message: 'Price must be positive' });
    if (Number(duration) <= 0) return res.status(400).json({ success: false, message: 'Duration must be positive' });

    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      { 
        serviceName, 
        category, 
        description, 
        price: Number(price), 
        duration: Number(duration), 
        image, 
        status 
      },
      { new: true }
    );

    if (!updatedService) return res.status(404).json({ success: false, message: 'Service not found' });

    res.json({ success: true, data: updatedService, message: 'Service updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ==========================================
// // =========================================
//ADMIN APPOINTMENTS ROUTES
// ==========================================
app.get('/api/admin/appointments', verifyAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ createdAt: -1 });
    
    // সার্ভিস এবং কাস্টমারের ডাটা ম্যানুয়ালি অ্যাটাচ করা হচ্ছে
    const populatedAppointments = await Promise.all(appointments.map(async (app) => {
      const appObj = app.toObject();

      // ১. সার্ভিসের ডাটা আনা
      if (appObj.serviceId) {
        const service = await Service.findById(appObj.serviceId);
        appObj.serviceId = service;
      }

      // ২. Better Auth এর 'user' কলেকশন থেকে কাস্টমারের ডাটা আনা
      if (appObj.customerId) {
        const customer = await mongoose.connection.db.collection('user').findOne(
          { _id: new mongoose.Types.ObjectId(appObj.customerId) }
        );
        appObj.customerId = customer 
          ? { name: customer.name, email: customer.email, image: customer.image } 
          : null;
      }

      return appObj;
    }));

    res.json({ success: true, data: populatedAppointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// অ্যাপয়েন্টমেন্ট Confirm করা
app.patch('/api/admin/appointments/:id/confirm', verifyAdmin, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Not found' });
    if (appointment.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending can be confirmed' });
    appointment.status = 'confirmed';
    await appointment.save();
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// অ্যাপয়েন্টমেন্ট Cancel করা
app.patch('/api/admin/appointments/:id/cancel', verifyAdmin, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Not found' });
    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ADMIN USERS ROUTES
// ==========================================
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    const users = await mongoose.connection.db.collection('user')
      .find({ role: 'customer' })
      .toArray();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/admin/users/:id/toggle-block', verifyAdmin, async (req, res) => {
  try {
    const ObjectId = require('mongodb').ObjectId;
    const user = await mongoose.connection.db.collection('user').findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const newStatus = !user.isBlocked;
    await mongoose.connection.db.collection('user').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isBlocked: newStatus } }
    );
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ADMIN TRANSACTIONS ROUTES
// ==========================================
app.get('/api/admin/transactions', verifyAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });

    // ম্যানুয়ালি কাস্টমার এবং সার্ভিসের ডাটা অ্যাটাচ করা
    const populatedTransactions = await Promise.all(transactions.map(async (txn) => {
      const txnObj = txn.toObject();

      // ১. কাস্টমারের ডাটা আনা (Better Auth 'user' কলেকশন)
      if (txnObj.customerId) {
        const customer = await mongoose.connection.db.collection('user').findOne(
          { _id: new mongoose.Types.ObjectId(txnObj.customerId) }
        );
        txnObj.customerId = customer 
          ? { name: customer.name, email: customer.email } 
          : null;
      }

      // ২. অ্যাপয়েন্টমেন্ট ও সার্ভিসের ডাটা আনা
      if (txnObj.appointmentId) {
        const appointment = await Appointment.findById(txnObj.appointmentId);
        if (appointment && appointment.serviceId) {
          const service = await Service.findById(appointment.serviceId);
          txnObj.appointmentId = { 
            ...appointment.toObject(), 
            serviceId: service 
          };
        }
      }

      return txnObj;
    }));

    res.json({ success: true, data: populatedTransactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// PROFILE ROUTE
// ==========================================
app.patch('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const email = authHeader.split(' ')[1];
    const { name, image } = req.body;
    const result = await mongoose.connection.db.collection('user').updateOne(
      { email: email },
      { $set: { name, image, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// USER STATUS ROUTE
// ==========================================
app.get('/api/user/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
    const email = authHeader.split(' ')[1];

    const user = await mongoose.connection.db.collection('user').findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ success: true, isBlocked: user.isBlocked || false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// CUSTOMER APPOINTMENTS ROUTES
// ==========================================
app.get('/api/customer/appointments', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
    const email = authHeader.split(' ')[1];

    const user = await mongoose.connection.db.collection('user').findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const appointments = await Appointment.find({ customerId: user._id })
      .populate('serviceId', 'serviceName image category price duration')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customer/appointments', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
    const email = authHeader.split(' ')[1];

    const user = await mongoose.connection.db.collection('user').findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { serviceId, appointmentDate, timeSlot, message } = req.body;
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    const existing = await Appointment.findOne({
      customerId: user._id,
      appointmentDate,
      timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (existing) return res.status(400).json({ success: false, message: 'You already have an active appointment at this time.' });

    const newAppointment = new Appointment({
      serviceId,
      customerId: user._id,
      appointmentDate,
      timeSlot,
      message,
      servicePrice: service.price,
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    await newAppointment.save();
    res.status(201).json({ success: true, data: newAppointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch('/api/customer/appointments/:id/cancel', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Not found' });
    if (appointment.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending appointments can be cancelled.' });

    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ success: true, message: 'Appointment cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// SERVER & DB CONNECTION
// ==========================================
mongoose.connect(process.env.MONGODB_URI, {
  autoSelectFamily: false
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch((err) => console.log('❌ MongoDB Connection Error:', err));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
