const Call = require("../models/call.model");

const getDashboardSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const match = {};

    // Filter by date
    if (from || to) {
      match.time = {};

      if (from) {
        match.time.$gte = new Date(`${from}T00:00:00.000Z`);
      }

      if (to) {
        match.time.$lte = new Date(`${to}T23:59:59.999Z`);
      }
    }

    const result = await Call.aggregate([
      {
        $match: match,
      },

      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Default values
    const stats = {
      totalCalls: 0,
      answered: 0,
      declined: 0,
      notAnswered: 0,
      pending: 0,
    };

    // Fill statistics
    result.forEach((item) => {
      stats.totalCalls += item.count;

      if (item._id === "answered") {
        stats.answered = item.count;
      }

      if (item._id === "declined") {
        stats.declined = item.count;
      }

      if (item._id === "not_answered") {
        stats.notAnswered = item.count;
      }

      if (item._id === "pending") {
        stats.pending = item.count;
      }
    });

    // Answer rate
    const completedCalls =
      stats.answered +
      stats.declined +
      stats.notAnswered;

    const answerRate =
      completedCalls > 0
        ? Number(
            ((stats.answered / completedCalls) * 100).toFixed(2)
          )
        : 0;

    res.status(200).json({
      success: true,

      data: {
        totalCalls: stats.totalCalls,

        answered: stats.answered,

        declined: stats.declined,

        notAnswered: stats.notAnswered,

        pending: stats.pending,

        answerRate,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary,
};