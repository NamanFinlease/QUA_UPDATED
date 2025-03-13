import mongoose from "mongoose";

const userLogHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    logDate: {
        type: String,
    },
    userRemark: {
        type: String,
    },
    pan: {
        type: String,
    },
    aadhaar: {
        type: String,
    },
});

const UserLogHistory = new mongoose.model(
    "UserLoghistory",
    userLogHistorySchema
);
export default UserLogHistory;
