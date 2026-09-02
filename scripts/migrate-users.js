require("dotenv").config();

const mongoose = require("mongoose");

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set; nothing to migrate.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const users = mongoose.connection.collection("users");

  const pending = await users.countDocuments({ name: { $exists: true } });

  if (pending === 0) {
    console.log("No documents to migrate; `fullName` is already in place.");
    await mongoose.disconnect();
    return;
  }

  const result = await users.updateMany(
    { name: { $exists: true } },
    { $rename: { name: "fullName" } }
  );

  console.log(`Renamed name -> fullName on ${result.modifiedCount} user(s).`);

  const missing = await users.countDocuments({
    $or: [{ fullName: { $exists: false } }, { fullName: null }],
  });

  if (missing > 0) {
    console.warn(
      `Warning: ${missing} user(s) still have no fullName and will fail validation.`
    );
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Migration failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
