const callModel = require('../models/call.model');

const createCall = async (callData) => {
  const call = new callModel(callData);
  return await call.save();
};


module.exports = {
  createCall,
};