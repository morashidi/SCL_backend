const Call = require("../models/call.model");

const createCall = async (callData) => {
    const call = new Call(callData);
    return await call.save();
};

const getAllCalls = async () => {
    return await Call.find().sort({ time: -1 });
};

const getCallById = async (id) => {
    return await Call.findById(id);
};

module.exports = {
    createCall,
    getAllCalls,
    getCallById
};
