import mongoose from "mongoose";

const bankSchema = new mongoose.Schema(
    {
        borrowerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Applicant",
            // unique: true,
            // sparse:true,
        },
        bankName: {
            type: String,
            required: true,
        },
        branchName: {
            type: String,
            required: true,
        },
        bankAccNo: {
            type: String,
            required: true,
            // unique: true,
            // sparse:true,
        },
        ifscCode: {
            type: String,
            required: true,
        },
        beneficiaryName: {
            type: String,
            required: true,
        },
        accountType: {
            type: String,
            required: true,
            enum: ['SAVINGS', 'CURRENT', "OVERDRAFT"],
        },
    },
    { timestamps: true }
);

const Bank = mongoose.model("Bank", bankSchema);
export default Bank;
