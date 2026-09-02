require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const SEED_USERS = [
  {
    fullName: "Karim Adel Mostafa",
    username: "karim.adel",
    phone: "01001472583",
    password: "password123",
    role: "system_admin",
  },
  {
    fullName: "Sherif Mansour",
    username: "sherif.mansour",
    phone: "01027461583",
    password: "password123",
    role: "admin",
  },
  {
    fullName: "Yasmin Hegazy",
    username: "yasmin.hegazy",
    phone: "01128374655",
    password: "password123",
    role: "finance",
  },
  {
    fullName: "Omar Shalaby",
    username: "omar.shalaby",
    phone: "01096472518",
    password: "password123",
    role: "recruiter",
  },
  {
    fullName: "Ahmed Sayed Nasr",
    username: "ahmed.sayed",
    phone: "01274639182",
    password: "password123",
    role: "mandoob",
  },
];

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set; refusing to run.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const users = mongoose.connection.collection("users");
  const tokens = mongoose.connection.collection("tokens");

  const existing = await users.find({}).toArray();

  if (existing.length > 0) {
    const dir = path.join(__dirname, "..", "backups");
    fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(dir, `users-${stamp}.json`);

    fs.writeFileSync(backup, JSON.stringify(existing, null, 2));
    console.log(`Backed up ${existing.length} user(s) to ${backup}`);
  }

  const removedTokens = await tokens.deleteMany({
    userId: { $in: existing.map((user) => user._id) },
  });
  const removedUsers = await users.deleteMany({});

  console.log(
    `Deleted ${removedUsers.deletedCount} user(s) and ${removedTokens.deletedCount} token(s).`
  );

  const now = new Date();

  const docs = await Promise.all(
    SEED_USERS.map(async (user) => ({
      fullName: user.fullName,
      username: user.username,
      phone: user.phone,
      password: await bcrypt.hash(user.password, 10),
      role: user.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }))
  );

  await users.insertMany(docs);

  console.log(`\nCreated ${docs.length} user(s):\n`);
  SEED_USERS.forEach((user) => {
    console.log(
      `  ${user.role.padEnd(13)} ${user.username.padEnd(16)} ${user.phone}  ${user.password}`
    );
  });

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Seeding failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
