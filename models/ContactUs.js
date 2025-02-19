import mongoose from "mongoose";

const contactUSSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        phoneNo: {
            type: String, // Changed from Number to String
            required: true,
            trim: true,
            unique: true,
        },
        message: {
            type: String,
            maxlength: 50, // Fixed maxSize issue
        },
        source: {
            type: String,
            enum: ["website", "others"],
        },
    },
    { timestamps: true }
);

const ContactUs = mongoose.model("ContactUs", contactUSSchema);
export default ContactUs;
