const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("@better-auth/mongo-adapter");
const { MongoClient } = require("mongodb");

const isProd = process.env.NODE_ENV === "production";

const client = new MongoClient(process.env.MONGODB_URI, {
  autoSelectFamily: false,
});

const db = client.db("salonbook");

const socialProviders = {};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

const auth = betterAuth({
  appName: "SalonBook",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db, { client }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    autoSignIn: false,
  },
  socialProviders,
  trustedOrigins: [
    process.env.CORS_ORIGIN,
    "https://salonbook-ph09.netlify.app",
    "https://*.netlify.app",
    "https://*--salonbook-ph09.netlify.app",
    "https://salonbook-server-vz28.onrender.com",
  ].filter(Boolean),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false,
      },
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      httpOnly: true,
    },
  },
});

module.exports = { auth };
