import mongoose from "mongoose";

//Done
const employeeInfoSchema = new mongoose.Schema({
    workFrom: {
        type: String,
        required: true,
        enum: ['OFFICE', 'HOME']
    },
    officeEmail: {
        type: String,
    },
    companyName: {
        type: String,
        required: true,
    },
    companyType: {
        type: String,
        required: true,
    },
    designation: {
        type: String,
        required: true,
    },
    officeAddrress: {
        type: String,
        required: true,
    },
    landmark: {
        type: String,
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
    employedSince: {
        type: Date
    }

})

//Done
const disbursalBankSchema = new mongoose.Schema({
    bankName: {
        type: String,
        required: true,
    },
    accountNumber: {
        type: String,
        required: true,
    },
    ifscCode: {
        type: String,
        required: true,
    },
    accountType: {
        type: String,
        required: true,
        enum: ['SAVINGS', 'CURRENT', 'OVERDRAFT']
    },
    branchName: {
        type: String
    },
    beneficiaryName: {
        type: String
    }
})


// Done
const loanDetailsSchema = new mongoose.Schema({
    principal: {
        type: Number,
        required: true
    },
    totalPayble: {
        type: Number,
        required: true
    },
    roi: {
        type: Number,
        required: true
    },
    tenure: {
        type: Number,
        required: true
    },
    loanPurpose: {
        type: String,
        required: true,
    },
})

const applicationSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },
    PAN: {
        type: String,
    },
    loanNo: {
        type: String
    },
    leadNo: {
        type: String
    },
    expiryDate : {
        type : Date
    },

    loanDetails: loanDetailsSchema,
    employeeDetails: employeeInfoSchema,
    disbursalBankDetails: disbursalBankSchema,

    progressStatus: {
        type: String,
        default: "CALCULATED",
        enum: [
            "CALCULATED",
            "EMPLOYMENT_DETAILS_SAVED",
            "BANK_STATEMENT_FETCHED",
            "DOCUMENTS_SAVED",
            "DISBURSAL_DETAILS_SAVED",
            "COMPLETED",
        ],
    },

    previousJourney: {
        type: String,
        default: "CALCULATED",
        enum: [
            "CALCULATED",
            "EMPLOYMENT_DETAILS_SAVED",
            "BANK_STATEMENT_FETCHED",
            "DOCUMENTS_SAVED",
            "DISBURSAL_DETAILS_SAVED",
            "COMPLETED",
        ],
    },

    applicationStatus: {
        type: String,
        default: 'PENDING',
        enum: ['PENDING', 'LEAD_CREATED', 'APPROVED', 'REJECTED', 'CLOSED']
    },
    isLoanCalculated: {
        type: Boolean,
        default: false
    },
    isEmploymentDetailsSaved: {
        type: Boolean,
        default: false
    },
    isDisbursalDetailsSaved: {
        type: Boolean,
        default: false
    },
    isBankStatementUploaded: {
        type: Boolean,
        default: false
    },
    isDocumentUploaded: {
        type: Boolean,
        default: false
    },
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Leads"
    },
    loanUnderProcess: {
        type: String,
        enum: ["PENDING", "SUCCESS", "REJECTED"],
        default: "PENDING"
    },
    sanction: {
        type: String,
        enum: ["PENDING", "SUCCESS", "REJECTED"],
        default: "PENDING"

    },
    disbursed: {
        type: String,
        enum: ["PENDING", "SUCCESS", "REJECTED"],
        default: "PENDING"

    },
},
    {
        timestamps: true
    });

const LoanApplication = mongoose.model("loanApplication", applicationSchema);

export default LoanApplication;
