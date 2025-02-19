import mongoose from "mongoose";

const repaymentSchema = new mongoose.Schema(
    {
        pan: {
            type : String
        },
        loanNo:{
            type:String
        },
        hash:{
            type : String
        },
        details:{
            type : Object
        }
    },
    { timestamps: true }
);

const Repayment = mongoose.model("Repayment", repaymentSchema);
export default Repayment;
