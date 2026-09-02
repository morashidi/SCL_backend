require("dotenv").config();

const mongoose = require("mongoose");
const { ROLES, toSpecRole } = require("../src/utils/roles");
const { STATUSES } = require("../src/models/user.model");

const BCRYPT = /^\$2[aby]?\$\d{2}\$/;

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const users = mongoose.connection.collection("users");
  const docs = await users.find({}).sort({ _id: 1 }).toArray();

  console.log(`Checked ${docs.length} user document(s).\n`);

  let deviations = 0;

  for (const doc of docs) {
    const issues = [];

    if (!doc.fullName) {
      issues.push("missing fullName (required by the model; blocks save())");
    }

    if (doc.name !== undefined) {
      issues.push("still has the legacy `name` field (run scripts/migrate-users.js)");
    }

    if (!doc.username) {
      issues.push("missing username");
    } else if (doc.username !== doc.username.toLowerCase().trim()) {
      issues.push(`username "${doc.username}" is not normalized (lowercased/trimmed)`);
    }

    if (doc.phone === undefined) {
      issues.push("no phone field at all (model default is null)");
    }

    if (!doc.password) {
      issues.push("missing password - this account can never log in");
    } else if (!BCRYPT.test(doc.password)) {
      issues.push("password is not a bcrypt hash - login comparison will fail");
    }

    if (!doc.role) {
      issues.push("missing role");
    } else if (!ROLES.includes(doc.role)) {
      issues.push(`role "${doc.role}" is outside the model enum [${ROLES.join(", ")}]`);
    }

    if (doc.status === undefined) {
      issues.push(
        'missing status - toUser() reports active:false, so the account reads as inactive over the API'
      );
    } else if (!STATUSES.includes(doc.status)) {
      issues.push(`status "${doc.status}" is outside [${STATUSES.join(", ")}]`);
    }

    if (!doc.createdAt) {
      issues.push("missing createdAt - serialized as null and sorts last in GET /users");
    }

    if (!doc.updatedAt) {
      issues.push("missing updatedAt");
    }

    const label = `${doc.username || "(no username)"} [${String(doc._id)}]`;

    if (issues.length === 0) {
      console.log(`OK   ${label} -> role ${toSpecRole(doc.role)}`);
    } else {
      deviations += 1;
      console.log(`FAIL ${label}`);
      issues.forEach((issue) => console.log(`       - ${issue}`));
    }
  }

  console.log(
    `\n${docs.length - deviations} conforming, ${deviations} with deviations.`
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Audit failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
