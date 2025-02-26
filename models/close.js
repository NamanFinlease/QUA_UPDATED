import mongoose from "mongoose";

export const closedSchema = new mongoose.Schema(
    {
        pan: {
            type: String,
            required: true,
        },
        leadNo: { type: String, },
        loanNo: { type: String, },
        utr: { type: String, },
        isDisbursed: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        isClosed: { type: Boolean, default: false },
        isSettled: { type: Boolean, default: false },
        isWriteOff: { type: Boolean, default: false },
        disbursal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Disbursal",
        },
    },
    {
        timestamps: true,
    }
)



const Close = mongoose.model("Close", closedSchema);
export default Close;