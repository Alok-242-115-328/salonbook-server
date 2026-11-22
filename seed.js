const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Service = require('./models/Service'); // নিশ্চিত করো models ফোল্ডার সার্ভারের ভেতরে আছে

dotenv.config();

const dummyServices = [
  {
    serviceName: 'Premium Haircut & Styling',
    category: 'Haircut & Styling',
    description: 'A complete hair makeover including washing, precision cutting, and professional styling by our experts.',
    price: 45,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    status: 'active'
  },
  {
    serviceName: 'Luxury Hair Coloring',
    category: 'Hair Coloring',
    description: 'Transform your look with our premium hair coloring service using top-tier, damage-free products.',
    price: 120,
    duration: 120,
    image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    status: 'active'
  },
  {
    serviceName: 'Deep Cleansing Facial',
    category: 'Facial & Skincare',
    description: 'Rejuvenate your skin with our deep cleansing facial, perfect for removing impurities and hydrating.',
    price: 60,
    duration: 45,
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    status: 'active'
  },
  {
    serviceName: 'Bridal Makeup Package',
    category: 'Makeup',
    description: 'Complete bridal makeup including base, contouring, eye makeup, and hair styling for your special day.',
    price: 250,
    duration: 180,
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    status: 'active'
  },
  {
    serviceName: 'Spa Manicure & Pedicure',
    category: 'Manicure & Pedicure',
    description: 'Relaxing hand and foot treatment including nail shaping, cuticle care, scrub, and massage.',
    price: 50,
    duration: 75,
    image: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    status: 'active'
  },
  {
    serviceName: 'Full Body Relaxation Massage',
    category: 'Spa & Massage',
    description: 'Unwind and relieve stress with our full body aromatherapy massage using essential oils.',
    price: 90,
    duration: 90,
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    status: 'active'
  }
];
const seedDatabase = async () => {
  try {
    // এখানে autoSelectFamily: false যোগ করা হয়েছে
    await mongoose.connect(process.env.MONGODB_URI, {
      autoSelectFamily: false
    });
    
    console.log('✅ Connected to MongoDB for seeding');

    // আগের ডাটা মুছে ফেলা হচ্ছে (যাতে ডুপ্লিকেট না হয়)
    await Service.deleteMany(); 
    console.log('🗑️ Old services cleared');

    // নতুন ডাটা ঢোকানো হচ্ছে
    await Service.insertMany(dummyServices);
    console.log('🎉 6 Dummy Services added successfully!');

    process.exit();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();