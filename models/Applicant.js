import mongoose from "mongoose";

const personalDetailsSchema = new mongoose.Schema(
    {
        fName: {
            type: String,
            required: true,
        },
        mName: {
            type: String,
        },
        lName: {
            type: String,
        },
        gender: { type: String, required: true, enum: ["M", "F"] },
        dob: {
            type: Date,
            required: true,
        },
        mobile: { type: String, required: true, unique: true },
        alternateMobile: {
            type: String,
        },
        personalEmail: {
            type: String,
            required: true,
        },
        officeEmail: {
            type: String,
            required: true,
        },
        screenedBy: {
            type: String,
            required: true,
        },
        pan: {
            type: String,
            required: true,
            unique: true,
        },
        aadhaar: {
            type: String,
            required: true,
            unique: true,
        },
    },
    { _id: false }
);

const residenceSchema = new mongoose.Schema({
    address: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    pincode: {
        type: String,
        required: true,
    },
    residingSince: {
        type: String,
    },
    residenceType:{
        type: String,
        required: true,
        enum: ["OWNED", "RENTED", "PARENTAL", "COMPANY PROVIDED", "OTHERS"],
    }
});

const employmentDetailsSchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
    },
    companyAddress: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    pincode: {
        type: String,
        required: true,
    },
    department: {
        type: String,
        required: true,
    },
    designation: {
        type: String,
        required: true,
    },
    employedSince: {
        type: String,
        // required: true,
    },
});

const referenceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    relation: {
        type: String,
        required: true,
    },
    mobile: {
        type: String,
        required: true,
    },
});

const incomeDetailsSchema = new mongoose.Schema({
  employementType: {
    type: String,
    required: true,
    enum: ["SALARIED", "SELF EMPLOYED"],
  },

  monthlyIncome: {
    type: Number,
    required: true,
  },  
  obligations: {
    type: Number,
  },
  nextSalaryDate: {
    type: Date,
    required: true,
  },  
  incomeMode:{
    type: String,
    required: true,
    enum: ["CASH", "BANK", "CHEQUE", "OTHERS"],
  }
});


const applicantSchema = new mongoose.Schema(
    {
        pan:{
            type:String
        },
        personalDetails: {
            type: personalDetailsSchema,
            required: true,
        },
        residence: {
            type: residenceSchema,
        },
        employment: {
            type: employmentDetailsSchema,
        },
        incomeDetails :{
            type : incomeDetailsSchema
        },
        reference: {
            type: [referenceSchema],
        },
    },
    { timestamps: true }
);

const Applicant = mongoose.model("Applicant", applicantSchema);
export default Applicant;
