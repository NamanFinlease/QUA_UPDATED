import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
    {
        leadNo: {
            type: String,
            required: true,
        },
        pan: {
            type: String,
        },
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
            required: true,
            unique: true,
        },
        leadNo: {
            type: String,
            // required: true,
            unique: true,
            sparse: true,
        },
        pan: {
            type: String,
            required: true,
            // unique: true,
        },
        applicant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Applicant",
        },
        creditManagerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
        onHold: {
            type: Boolean,
            default: false,
        },
        heldBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
        isRejected: {
            type: Boolean,
            default: false,
        },
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
        isRecommended: { type: Boolean, default: false },
        recommendedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
        remarks: {
            type: String,
        },
        // isApproved: {
        //     type: Boolean,
        //     default: false,
        // },
        // approvedBy: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "Employee",
        // },
        // sanctionDate: {
        //     type: Date,
        // },
    },
    { timestamps: true }
);

const Application = mongoose.model("Application", applicationSchema);
export default Application;
