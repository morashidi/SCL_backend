require("dotenv").config();

const mongoose = require("mongoose");
const { normalizePhone } = require("../src/utils/phone");

const TARGETS = [
  { collection: "users", field: "phone" },
  { collection: "mandoobs", field: "phone" },
  { collection: "applications", field: "phoneNumber" },
  { collection: "calls", field: "caller" },
  { collection: "calls", field: "callee" },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  for (const { collection, field } of TARGETS) {
    const docs = await mongoose.connection
      .collection(collection)
      .find({ [field]: { $type: "string", $ne: "" } })
      .project({ [field]: 1 })
      .toArray();

    console.log(`\n${collection}.${field}: ${docs.length} value(s)`);

    docs.forEach((doc) => {
      const current = doc[field];
      const next = normalizePhone(current);
      const mark = next === current ? "     " : " --> ";
      console.log(`  ${current}${mark}${next === current ? "(unchanged)" : next}`);
    });
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Inspection failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
