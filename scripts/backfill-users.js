require("dotenv").config();

const mongoose = require("mongoose");
const { normalizePhone } = require("../src/utils/phone");

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set; nothing to backfill.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const users = mongoose.connection.collection("users");

  const status = await users.updateMany(
    { status: { $exists: false } },
    { $set: { status: "active" } }
  );
  console.log(`status: set "active" on ${status.modifiedCount} user(s).`);

  const phone = await users.updateMany(
    { phone: { $exists: false } },
    { $set: { phone: null } }
  );
  console.log(`phone: set null on ${phone.modifiedCount} user(s).`);

  const withPhone = await users
    .find({ phone: { $type: "string", $ne: "" } })
    .project({ phone: 1 })
    .toArray();

  let normalized = 0;

  for (const doc of withPhone) {
    const next = normalizePhone(doc.phone);

    if (next !== doc.phone) {
      await users.updateOne({ _id: doc._id }, { $set: { phone: next } });
      console.log(`  phone: ${doc.phone} -> ${next}`);
      normalized += 1;
    }
  }
  console.log(`phone: normalized ${normalized} of ${withPhone.length} value(s).`);

  const undated = await users
    .find({ $or: [{ createdAt: { $exists: false } }, { updatedAt: { $exists: false } }] })
    .toArray();

  for (const doc of undated) {
    const createdAt = doc.createdAt || doc._id.getTimestamp();

    await users.updateOne(
      { _id: doc._id },
      { $set: { createdAt, updatedAt: doc.updatedAt || createdAt } }
    );
  }
  console.log(`timestamps: filled on ${undated.length} user(s).`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Backfill failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
