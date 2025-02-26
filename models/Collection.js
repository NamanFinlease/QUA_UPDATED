import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
    {
        pan: {
            type: String,
            required: true
        },
        leadNo: { type: String, required: true, unique: true, sparse: true },
        loanNo: { type: String, required: true, unique: true, sparse: true },
        repaymentDate: { type: Date, required: true },
        dpd: { type: Number, default: 0 },
        principalAmount: { type: Number },
        penalRate: { type: Number },
        interest: { type: Number, default: 0 },
        penalty: { type: Number, default: 0 },
        outstandingAmount: { type: Number, default: 0 },
        isDisbursed: { type: Boolean, default: false },
        disbursal: { type: mongoose.Schema.Types.ObjectId, ref: "Disbursal" },
        camDetails: { type: mongoose.Schema.Types.ObjectId, ref: "CamDetail" },
        payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
        close: { type: mongoose.Schema.Types.ObjectId, ref: "Close" },
        collectionExecutiveId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        preCollectionExecutiveId : {type : mongoose.Schema.Types.ObjectId, ref : "Employee"}
    },
    {
        timestamps: true
    }
);



const Collection = mongoose.model("Collection", collectionSchema)

export default Collection