const mongoose = require("mongoose");

// The connection is cached on the global object so that warm serverless
// invocations reuse a single pool instead of opening a new one per request.
let cached = global.__mongoConnection;

if (!cached) {
  cached = global.__mongoConnection = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined");
    }

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, { maxPoolSize: 10 })
      .then((connection) => {
        console.log("MongoDB connected successfully");
        return connection;
      })
      .catch((error) => {
        // Drop the rejected promise so the next request can retry.
        cached.promise = null;
        console.error("MongoDB connection failed:", error.message);
        throw error;
      });
  }

  cached.conn = await cached.promise;

  return cached.conn;
};

module.exports = connectDB;
