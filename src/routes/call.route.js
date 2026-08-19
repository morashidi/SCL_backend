const express = require("express");
const callService = require("../services/call.service");
const upload = require("../middleware/upload.middleware");

const router = express.Router();



router.post("/", upload.single("audio"), async (req, res) => {
  try {
    const callData = {
      caller: req.body.caller,
      callee: req.body.callee,
      text: req.body.text || "",
      status: req.body.status || "pending",
      audio: req.file ? `/uploads/${req.file.filename}` : null, // ( object store  )
    };



    const call = await callService.createCall(callData);

    res.status(201).json(call);
  } catch (error) {
    console.error("Create call error:", error);

    res.status(400).json({
      message: error.message,
    });
  }
});



router.get("/", async (req, res) => {
  try {
    const calls = await callService.getAllCalls();

    res.status(200).json(calls);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});



router.get("/:id", async (req, res) => {
  try {
    const call = await callService.getCallById(req.params.id);

    if (!call) {
      return res.status(404).json({
        message: "Call not found",
      });
    }

    res.status(200).json(call);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

module.exports = router;