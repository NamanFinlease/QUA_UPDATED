import mongoose from "mongoose";

const pennyDropSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        accountNo: {
            type: String,
            required: true,
            trim: true,
            unique: true, // Ensures PAN is unique     
            sparse:true
        },
        ifsc: {
            type: String,
            required: true,
            trim: true,
            // Ensures PAN is unique     
        },
        bankName: {
            type: String,
            // required: true,
            trim: true,
        },
        branch: {
            type: String,
            // required: true,
            trim: true,
        },
        referenceId: {
            type: String,
            // required: true,
            trim: true,
        },
        utr: {
            type: String,
            // required: true,
            trim: true,
        },

    },
    { timestamps: true }
);

const PennyDrop = mongoose.model("pennydrop", pennyDropSchema);
export default PennyDrop;
