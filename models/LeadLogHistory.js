import mongoose from "mongoose";

const leadsLogHistorySchema = new mongoose.Schema(
    {
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
        },
        logDate: {
            type: String,
        },
        status: {
            type: String,
        },
        borrower: {
            type: String,
        },
        leadRemark: {
            type: String,
        },
        reason: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const LogHistory = new mongoose.model("leadloghistory", leadsLogHistorySchema);
export default LogHistory;
