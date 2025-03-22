import mongoose from "mongoose";

const paymentHistory = new mongoose.Schema(
    {
        receivedAmount: { type: Number, required: true },
        paymentDate: { type: Date, required: true },
        paymentMode: {
            type: String,
            enum: ["offline", "online", "paymentGateway"],
        },
        transactionId: { type: String },
        closingType: {
            type: String,
            enum: ["partPayment", "closed", "writeOff", "settled", ""],
        },
        paymentUpdateRequest: { type: Boolean },
        discount: { type: Number },
        isPaymentVerified: { type: Boolean, default: false },
        paymentReceivedOn: { type: Date },
        isRejected: { type: Boolean, default: false },
        order_status: { type: String },
        order_id: { type: String },
        receipt_id: { type: String },
        paymentMethod: { type: String },
        collectionRemarks: { type: String },
        accountRemarks: { type: String },
        isPartialPaid: { type: Boolean },
        bankName: { type: String },
        excessAmount: { type: Number, default: 0 },
        paymentUpdateRequestBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
        paymentVerifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        },
    },
    {
        timestamps: true,
    }
);

// Explicitly create a unique index on transactionId
// paymentHistory.index({ transactionId: 1 }, { unique: true });

const paymentSchema = new mongoose.Schema(
    {
        pan: { type: String, required: true },
        leadNo: { type: String },
        loanNo: { type: String, required: true, unique: true, sparse: true },
        paymentHistory: { type: [paymentHistory], default: [] },
        repaymentDate: { type: Date, required: true },
        totalReceivedAmount: { type: Number, default: 0 },
        interestDiscount: { type: Number, default: 0 },
        penaltyDiscount: { type: Number, default: 0 },
        principalDiscount: { type: Number, default: 0 },
        interestReceived: { type: Number, default: 0 },
        penaltyReceived: { type: Number, default: 0 },
        principalReceived: { type: Number, default: 0 },
        excessAmount: { type: Number, default: 0 },
        settledAmount: { type: Number },
        writeOffAmount: { type: Number },
        outstandingAmount: { type: Number },
    },
    {
        timestamps: true,
    }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
