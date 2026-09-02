require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const USERNAME = "postman_admin";
const PASSWORD = "Postman123!";
const PHONE = "01555000111";

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const users = mongoose.connection.collection("users");
  const now = new Date();

  const result = await users.updateOne(
    { username: USERNAME },
    {
      $set: {
        fullName: "Postman Test Admin",
        username: USERNAME,
        phone: PHONE,

        password: await bcrypt.hash(PASSWORD, 10),
        role: "system_admin",
        status: "active",
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  console.log(
    `${result.upsertedCount ? "Created" : "Reset"} test user:\n` +
      `  username: ${USERNAME}\n` +
      `  password: ${PASSWORD}\n` +
      `  phone:    ${PHONE}\n` +
      `  role:     system_admin`
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Seeding failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
