import Lead from "../../../models/Leads.js";
import LoanApplication from "../../../models/User/model.loanApplication.js";
import CamDetails from "../../../models/CAM.js";
import Documents from "../../../models/Documents.js";
import Applicant from "../../../models/Applicant.js";
import Application from "../../../models/Applications.js";
import Sanction from "../../../models/Sanction.js";
import Disbursal from "../../../models/Disbursal.js";

export const getMasterSheet = async () => {
    const leads = await Lead.aggregate([
        {
            $lookup: {
                from: "loanapplications",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "loanApplications",
            },
        },
        {
            $unwind: {
                path: "$loanApplications",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $lookup: {
                from: "aadhaardetails",
                localField: "aadhaar",
                foreignField: "uniqueId",
                as: "aadhaarDetails",
            },
        },
        {
            $unwind: {
                path: "$aadhaarDetails",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $lookup: {
                from: "pans",
                let: { leadPan: "$pan" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$data.pan", "$$leadPan"] },
                        },
                    },
                ],
                as: "panDetails",
            },
        },
        { $unwind: { path: "$panDetails", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "camdetails",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "camDetails",
            },
        },
        { $unwind: { path: "$camDetails", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "documents",
                let: { docId: "$documents" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$_id", "$$docId"] },
                        },
                    },
                ],
                as: "docs",
            },
        },
        {
            $unwind: {
                path: "$docs",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $lookup: {
                from: "applicants",
                let: { leadPan: "$pan" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$personalDetails.pan", "$$leadPan"],
                            },
                        },
                    },
                ],
                as: "applicants",
            },
        },
        { $unwind: { path: "$applicants", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "banks",
                localField: "applicants._id",
                foreignField: "borrowerId",
                as: "applicantBank",
            },
        },
        {
            $unwind: {
                path: "$applicantBank",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "applications",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "application",
            },
        },
        { $unwind: { path: "$application", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "sanctions",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "sanction",
            },
        },
        { $unwind: { path: "$sanction", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "disbursals",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "disbursal",
            },
        },
        { $unwind: { path: "$disbursal", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                updatedAt: 1,
                fName: 1,
                mName: 1,
                lName: 1,
                pan: 1,
                mobile: 1,
                leadNo: 1,
                aadhaar: 1,
                personalEmail: 1,
                dob: 1,
                cibilScore: 1,
                fatherName: 1,
                fathersName: 1,
                mothersName: 1,
                gender: 1,
                pinCode: 1,
                state: 1,
                city: 1,
                documents: 1,
                "extraDetails.personalDetails.maritalStatus": 1,
                "extraDetails.personalDetails.spouseName": 1,
                "extraDetails.residenceDetails.residenceType": 1,
                "extraDetails.incomeDetails.employmentType": 1,
                "extraDetails.incomeDetails.monthlyIncome": 1,
                "extraDetails.incomeDetails.workingSince": 1,
                "extraDetails.incomeDetails.incomeMode": 1,
                "loanApplications.loanDetails.loanPurpose": 1,
                "loanApplications.loanDetails.principal": 1,
                "loanApplications.loanDetails.tenure": 1,
                "loanApplications.employeeDetails.workFrom": 1,
                "loanApplications.employeeDetails.companyName": 1,
                "loanApplications.employeeDetails.companyType": 1,
                "loanApplications.employeeDetails.designation": 1,
                "loanApplications.employeeDetails.officeEmail": 1,
                "loanApplications.employeeDetails.officeAddrress": 1,
                "loanApplications.employeeDetails.employedSince": 1,
                "loanApplications.employeeDetails.pincode": 1,
                "loanApplications.employeeDetails.city": 1,
                "aadhaarDetails.details.address.house": 1,
                "aadhaarDetails.details.address.street": 1,
                "aadhaarDetails.details.address.landmark": 1,
                "aadhaarDetails.details.address.loc": 1,
                "aadhaarDetails.details.address.po": 1,
                "aadhaarDetails.details.address.dist": 1,
                "aadhaarDetails.details.address.vtc": 1,
                "aadhaarDetails.details.address.pc": 1,
                "aadhaarDetails.details.address.state": 1,
                "aadhaarDetails.details.address.country": 1,
                "panDetails.data.aadhaar_number": 1,
                "applicants.residence.address": 1,
                "applicants.residence.city": 1,
                "applicants.residence.state": 1,
                "applicants.residence.pincode": 1,
                "applicants.residence.residingSince": 1,
                "applicants.reference": {
                    $slice: ["$applicants.reference", 2],
                }, // ✅ Pick first 2 objects
                "applicantBank.beneficiaryName": 1,
                "applicantBank.bankAccNo": 1,
                "applicantBank.ifscCode": 1,
                "applicantBank.branchName": 1,
                "applicantBank.bankName": 1,
                "applicantBank.accountType": 1,
                "applicantBank.isPennyDropped": 1,

                // "applicant."
            },
        },
    ]);
    return leads;
};
