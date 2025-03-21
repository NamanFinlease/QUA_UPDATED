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
            $unwind: "$loanApplications",
        },
        {
            $lookup: {
                from: "camdetails",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "camDetails",
            },
        },
        {
            $unwind: "$camDetails",
        },
        {
            $lookup: {
                from: "documents",
                localField: "documents", // This is a single ObjectId
                foreignField: "_id",
                as: "documents",
            },
        },
        {
            $unwind: "$documents",
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
        {
            $unwind: "$applicants",
        },
        {
            $lookup: {
                from: "applications",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "application",
            },
        },
        {
            $unwind: "$application",
        },
        {
            $lookup: {
                from: "sanctions",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "sanction",
            },
        },
        {
            $unwind: "$sanction",
        },
        {
            $lookup: {
                from: "disbursals",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "disbursal",
            },
        },
        {
            $unwind: "$disbursal",
        },
    ]);

    console.log("leads: ", leads);
};
