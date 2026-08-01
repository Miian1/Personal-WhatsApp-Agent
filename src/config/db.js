const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  let uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<db_password>')) {
    const user = process.env.MONGODB_USERNAME || 'mypcaccc01_db_user';
    const pass = encodeURIComponent(process.env.MONGODB_PASSWORD || 'ANbMke8vozgG2tBH');
    const host = process.env.MONGODB_HOST || 'cluster0.fdlv4as.mongodb.net';
    const db = process.env.MONGODB_DATABASE || 'whatsapp_agent';
    uri = `mongodb+srv://${user}:${pass}@${host}/${db}?retryWrites=true&w=majority`;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
