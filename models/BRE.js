import mongoose from "mongoose";

const AnalysisSchema = new mongoose.Schema(
    {
        datePulled: {
            type: Date,
        },
        failedAccounts: {
            type: String,
        },
        fileName: {
            type: String,
        },
        finalDecision: {
            type: String,
        },
        maxLoanAmount: {
            type: Number,
        },
    },
    { timestamps: true } // This will add createdAt & updatedAt
);

const BRESchema = new mongoose.Schema(
    {
        pan: {
            type: String,
            unique: true,
            sparse: true,
            required: true,
        },
        analysis: [AnalysisSchema],
    },
    { timestamps: true }
);

const BRE = mongoose.model("BRE", BRESchema);
export default BRE;
