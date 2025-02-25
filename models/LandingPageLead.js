import mongoose from "mongoose";

const LandingPageLeadSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        pan: {
            type: String,
            required: true,
            trim: true,
            unique: true, // Ensures PAN is unique
        },
        mobile: {
            type: String,
            required: true,
            trim: true,
            unique: true, // Ensures mobile numbers are not duplicated
        },
        email: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        pinCode: {
            type: String,
            required: true,
            trim: true,
        },
        salary: {
            type: Number,
            required: true,
        },
        loanAmount: {
            type: Number,
            required: true,
        },
        source: {
            type: String,
            enum: ["website", "others"],
            default: "website",
        },
        screenerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
        isRejected: {
            type: Boolean,
            default: false,
        },
        isRejectedBySystem: {
            type: Boolean,
            default: false,
        },
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
        remarks: {
            type: String,
            default: ""
        },
        isComplete: {
            type: Boolean,
            default: false,
        },
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },

    },
    { timestamps: true }
);

const LandingPageLead = mongoose.model("LandingPageLead", LandingPageLeadSchema);
export default LandingPageLead;
