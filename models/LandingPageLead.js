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
    },
    { timestamps: true }
);

const LandingPageLead = mongoose.model("LandingPageLead", LandingPageLeadSchema);
export default LandingPageLead;
