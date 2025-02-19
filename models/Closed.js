import mongoose from "mongoose";

const closedSubSchema = new mongoose.Schema(
    {
        disbursal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Disbursal",
        },
        loanNo: { type: String, required: true },
        isDisbursed: { type: Boolean, default: false },
        date: { type: Date },
        amount: { type: Number, default: 0 },
        requestedStatus: {
            type: String,
            enum: ["closed", "settled", "writeOff"],
        },
        isActive: { type: Boolean, default: true },
        isClosed: { type: Boolean, default: false },
        isSettled: { type: Boolean, default: false },
        isWriteOff: { type: Boolean, default: false },
        defaulted: { type: Boolean, default: false },
        dpd: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
)

const closedSchema = new mongoose.Schema(
    {
        pan: {
            type: String,
            required: true,
            unique: true,
        },
        data: [
            closedSubSchema
        ],
    },
    { timestamps: true }
);

const Closed = mongoose.model("Closed", closedSchema);
export default Closed;