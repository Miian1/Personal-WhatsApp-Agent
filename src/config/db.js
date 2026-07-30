const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');

  if (!uri.includes('/?')) {
    uri = uri.replace('mongodb.net/', 'mongodb.net/whatsapp_agent?');
  }

  cached.promise = mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  });

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
