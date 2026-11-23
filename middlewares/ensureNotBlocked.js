const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { fromNodeHeaders } = require('better-auth/node');
const { auth } = require('../lib/auth');

const findUser = async (identifier) => {
  const collection = mongoose.connection.db.collection('user');
  const value = String(identifier).trim();

  if (ObjectId.isValid(value)) {
    const user = await collection.findOne({ _id: new ObjectId(value) });
    if (user) return user;
  }

  return collection.findOne({ email: value.toLowerCase() });
};

const resolveUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return findUser(token);
  }

  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session?.user?.id) return findUser(session.user.id);
    if (session?.user?.email) return findUser(session.user.email);
  } catch (error) {
    return null;
  }

  return null;
};

const ensureNotBlocked = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (user) {
      req.currentUser = user;
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_BLOCKED',
          isBlocked: true,
          message: 'Your account has been blocked. Please contact support.',
        });
      }
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = ensureNotBlocked;
