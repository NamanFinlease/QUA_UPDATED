import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({

    house: { type: String, },
    street: { type: String, },
    landmark: { type: String, },
    loc: { type: String, },
    po: { type: String, },
    dist: { type: String, },
    subDist: { type: String, },
    vtc: { type: String, },
    pc: { type: String, },
    state: { type: String, },
    country: { type: String, },


})
const detailsSchema = new mongoose.Schema({

    name: {
        type: String,
        unique: true,
        sparse: true,
        required: true
    },

    adharNumber: {
        type: String,
        // required : true
    },
    documentType: {
        type: String,
        // required : true
    },
    uniqueId: {
        type: String,
        // required : true
    },

    passCode: {
        type: String,
        // required : true
    },
    gender: {
        type: String,
        // required : true
    },
    careOf: {
        type: String,
        // required : true
    },
    maskedAdharNumber: {
        type: String,
        // required : true
    },
    dob: {
        type: Date,
        // required : true
    },

    address: {
        type: addressSchema,

    },
    referenceId: {
        type: String,

    },
    link: {
        type: String,

    },
    image: {
        type: String,

    },
    mobile: {
        type: String,

    },
    email: {
        type: String,

    },

})

const aadhaarSchema = new mongoose.Schema(
    {
        uniqueId: {
            type: String,
            unique: true,
            required: true
        },
        details: {
            type: detailsSchema,
        },
    },
    { timestamps: true }
);

const AadhaarDetails = mongoose.model("AadhaarDetails", aadhaarSchema);
export default AadhaarDetails;
