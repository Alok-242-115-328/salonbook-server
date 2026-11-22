const mongoose = require('mongoose');

const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const email = authHeader.split(' ')[1];
    
    // সরাসরি mongoose দিয়ে 'user' কলেকশনে খোঁজা হচ্ছে (বড় হাতের অক্ষর এড়াতে toLowerCase ব্যবহার)
    const user = await mongoose.connection.db.collection('user').findOne({ 
      email: email.toLowerCase() 
    });

    if (!user) {
      return res.status(403).json({ message: 'Forbidden: User not found in database' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You are not an admin' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = verifyAdmin;