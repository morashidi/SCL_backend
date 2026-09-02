require("dotenv").config();

const app = require("../src/app");
const connectDB = require("../src/config/db");

// Serverless entry point. Vercel invokes this handler per request instead of
// running a long-lived listener, so the database connection is established
// lazily and reused across warm invocations.
module.exports = async (req, res) => {
  await connectDB();

  return app(req, res);
};
