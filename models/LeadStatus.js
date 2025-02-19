import mongoose from "mongoose";

const leadStatusSchema = new mongoose.Schema(
    {
        leadNo: {
            type: String,
            required: true,
            unique: true,
        },
        stage: {
            type: String,
            default: "Lead",
            required: true,
        },
        subStage:{
            type : String,
            default : "Lead",
        },
        isApproved: {
            type: Boolean,
            default: false,
        },
        pan: {
            type: String,
            required: true,
        },
        source: {
            type: String,
        },
        isHold: {
            type: Boolean,
            default: false,
        },
        isRejected: {
            type: Boolean,
        },
        isInProcess: {
            type: Boolean,
            default: true,
        },

        close: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Closed",
        },
    },
    { timestamps: true }
);

const LeadStatus = mongoose.model("leadStatus", leadStatusSchema);
export default LeadStatus;
