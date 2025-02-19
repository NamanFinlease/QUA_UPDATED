import mongoose from "mongoose";

const loanSchema = new mongoose.Schema({
    LAN: String,
    NAME: String,
    PAN: String,
    MOBILE_NO: String,
    ALTERNATE_NO: String,
    PINCODE: Number,
    MAIL_ID: String,
    OFFICE_MAIL: String,
    AMOUNT: Number,
    PF_AMOUNT: Number,
    DISBURSED_AMOUNT: Number,
    ROI: String,
    DOD: Date,
    DOR: Date,
    DPD: Number,
    TENURE: Number,
    REPAYMENT_AMOUNT: Number,
    PAID_DATE: Date,
    PAID_AMT: Number,
    STATUS : String,
    PF : String
});

export const Loan = mongoose.model('csv', loanSchema);