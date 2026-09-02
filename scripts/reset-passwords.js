require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const PASSWORD = process.argv[2] || "password123";

const MIN_PASSWORD_LENGTH = 8;

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set; refusing to run.");
    process.exit(1);
  }

  if (PASSWORD.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const users = mongoose.connection.collection("users");
  const docs = await users.find({}).project({ username: 1, role: 1 }).toArray();

  const hash = await bcrypt.hash(PASSWORD, 10);

  const result = await users.updateMany(
    {},
    { $set: { password: hash, updatedAt: new Date() } }
  );

  console.log(`Set password "${PASSWORD}" on ${result.modifiedCount} user(s):\n`);
  docs.forEach((doc) => {
    console.log(`  ${String(doc.role).padEnd(13)} ${doc.username}`);
  });

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Password reset failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
