import mongoose from "mongoose";


const camSchema = new mongoose.Schema(
    {
        pan: {
            type: String,
        },
        leadNo: {
            type: String,
            unique:true,
            sparse:true
            // required: true
        },
        leadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
            unique: true,
            sparse: true,
        },
        details: {
            type: Object,
            // required: true,
        },
        cibilScore: {
            type: Number,
            // required: true,
        },
        loanAmount: {
            type: Number,
            // required: true,
        },
        
        salaryDate1: {
            type: Date,
            // required: true,
        },
        salaryAmount1: {
            type: Number,
            // required: true,
        },
        salaryDate2: {
            type: Date,
            // required: true,
        },
        salaryAmount2: {
            type: Number,
            // required: true,
        },
        salaryDate3: {
            type: Date,
            // required: true,
        },
        salaryAmount3: {
            type: Number,
            // required: true,
        },
        nextPayDate: {
            type: Date,
            // required: true,
        },
        averageSalary: {
            type: Number,
            // required: true,
        },
        actualNetSalary: {
            type: Number,
            // required: true,
        },
        creditBureauScore: {
            type: Number,
            // required: true,
        },
        customerType: {
            type: String,
            enum: ['NEW', 'EXISTING'],
            // required: true,
        },
        dedupeCheck: {
            type: String, // Assuming it returns "Yes" or "No"
            enum: ['Yes', 'No'],
            // required: true,
        },
        obligations: {
            type: Number,
            // required: true,
        },
        salaryToIncomeRatio: {
            type: Number,
            // required: true,
        },
        eligibleLoan: {
            type: Number,
            // required: true,
        },
        netDisbursalAmount: {
            type: Number,
            // required: true,
        },
        loanRecommended: {
            type: Number,
            // required: true,
        },
        disbursalDate: {
            type: Date,
            // required: true,
        },
        finalSalaryToIncomeRatioPercentage: {
            type: Number,
            // required: true,
        },
        repaymentDate: {
            type: Date,
            // required: true,
        },
        adminFeePercentage: {
            type: Number, // Assuming it can be an empty string
            default: "",
        },
        totalAdminFeeAmount: {
            type: Number,
            // required: true,
        },
        roi: {
            type: Number,
            // required: true,
        },
        netAdminFeeAmount: {
            type: Number,
            // required: true,
        },
        eligibleTenure: {
            type: Number,
            // required: true,
        },
        repaymentAmount: {
            type: Number,
            // required: true,
        },
        customerCategory: {
            type: String,
            // required: true,
        },
        eligiblesalaryToIncomeRatioPercentage: {
            type: String, // Assuming it includes the "%" symbol
            // required: true,
        },
        remarks: {
            type: String,
            default: '',
        },


    },

    { timestamps: true }
);

const CamDetails = mongoose.model("CamDetail", camSchema);
export default CamDetails;
