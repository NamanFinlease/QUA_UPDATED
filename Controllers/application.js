import asyncHandler from "../middleware/asyncHandler.js";
import Application from "../models/Applications.js";
import LeadStatus from "../models/LeadStatus.js";
import Employee from "../models/Employees.js";
import mongoose from "mongoose";
import { postLogs } from "./logs.js";
import { checkApproval } from "../utils/checkApproval.js";
import CamDetails from "../models/CAM.js";
import Sanction from "../models/Sanction.js";
import BRE from "../models/BRE.js";
import { calculateRepaymentAmount } from "../utils/repaymentCalculation.js"
import Lead from "../models/Leads.js";

// @desc Get all applications
// @route GET /api/applications
// @access Private
export const getAllApplication = asyncHandler(async (req, res) => {
    if (req.activeRole === "screener") {
        res.status(401);
        throw new Error("Screeners doesn't have the authorization.");
    }
    const page = parseInt(req.query.page) || 1; // current page
    const limit = parseInt(req.query.limit) || 10; // items per page
    const skip = (page - 1) * limit;

    const query = {
        $or: [
            { creditManagerId: { $exists: false } },
            { creditManagerId: null },
        ],
        isRecommended: { $ne: true },
    };

    const applications = await Application.aggregate([
        { $match: query }, // Apply filters

        { $sort: { updatedAt: -1 } }, // Sort by updatedAt in descending order

        { $skip: skip }, // Pagination: Skip documents
        { $limit: limit }, // Pagination: Limit documents

        // Lookup lead details
        {
            $lookup: {
                from: "leads", // The name of the Lead collection
                localField: "lead",
                foreignField: "_id",
                as: "leadData",
            },
        },
        { $unwind: "$leadData" }, // Convert leadData array into an object

        // Lookup recommendedBy details inside Lead
        {
            $lookup: {
                from: "employees", // Assuming 'recommendedBy' refers to users or another collection
                localField: "leadData.recommendedBy",
                foreignField: "_id",
                as: "recommendedBy",
            },
        },
        {
            $unwind: {
                path: "$recommendedBy",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Lookup BRE collection using lead.pan
        {
            $lookup: {
                from: "bres", // The name of the BRE collection
                localField: "leadData.pan",
                foreignField: "pan",
                as: "breData",
            },
        },
        { $unwind: { path: "$breData", preserveNullAndEmptyArrays: true } },

        // Unwind analysis array to extract the latest entry
        {
            $unwind: {
                path: "$breData.analysis",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Sort by the most recent analysis entry (based on createdAt)
        {
            $sort: { "breData.analysis.createdAt": -1 },
        },

        // Group back to keep only the latest analysis entry
        {
            $group: {
                _id: "$_id",
                updatedAt: { $first: "$updatedAt" },

                // Lead Fields
                lead: { $first: "$leadData" },
                recommendedBy: { $first: "$recommendedBy" },

                // Latest BRE Analysis Fields
                finalDecision: { $first: "$breData.analysis.finalDecision" },
                maxLoanAmount: { $first: "$breData.analysis.maxLoanAmount" },
            },
        },

        // Project required fields
        {
            $project: {
                _id: 1,
                updatedAt: 1,

                // Fields from 'lead'
                "lead.fName": "$lead.fName",
                "lead.mName": "$lead.mName",
                "lead.lName": "$lead.lName",
                "lead.mobile": "$lead.mobile",
                "lead.aadhaar": "$lead.aadhaar",
                "lead.pan": "$lead.pan",
                "lead.city": "$lead.city",
                "lead.state": "$lead.state",
                "lead.loanAmount": "$lead.loanAmount",
                "lead.salary": "$lead.salary",
                "lead.source": "$lead.source",

                // Recommended By Details
                "recommendedBy.fName": "$recommendedBy.fName",
                "recommendedBy.lName": "$recommendedBy.lName",

                // BRE Details
                "bre.finalDecision": "$finalDecision",
                "bre.maxLoanAmount": "$maxLoanAmount",
            },
        },
    ]);
    const totalApplications = await Application.countDocuments(query);

    return res.json({
        totalApplications,
        totalPages: Math.ceil(totalApplications / limit),
        currentPage: page,
        applications,
    });
});

// @desc Get application
// @route GET /api/applications/:id
// @access Private
export const getApplication = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const application = await Application.findOne({ _id: id }).populate({
        path: "lead",
        populate: { path: "documents" },
    });
    const bre = await BRE.findOne({ pan: application.lead.pan });
    if (!application) {
        res.status(404);
        throw new Error("Application not found!!!!");
    }
    return res.json({ application, bre });
});

// @desc Allocate new application
// @route PATCH /api/applications/:id
// @access Private
export const allocateApplication = asyncHandler(async (req, res) => {
    // Check if screener exists in the request
    const { id } = req.params;
    let creditManagerId;

    if (req.activeRole === "admin") {
        creditManagerId = req.body.creditManagerId;
    } else if (req.activeRole === "creditManager") {
        creditManagerId = req.employee._id.toString();
    }

    const application = await Application.findByIdAndUpdate(
        id,
        { creditManagerId },
        { new: true }
    ).populate({ path: "lead", populate: { path: "documents" } });

    if (!application) {
        throw new Error("Application not found"); // This error will be caught by the error handler
    }
    const employee = await Employee.findOne({ _id: creditManagerId });

    // update Lead stage
    await LeadStatus.findOneAndUpdate({
        leadNo: application.leadNo
    },
        {
            stage: "APPLICATION",
            subStage: "APPLICATION IN PROCESS"
        }
    )
    const logs = await postLogs(
        application.lead._id,
        "APPLICATION IN PROCESS",
        `${application.lead.fName}${application.lead.mName && ` ${application.lead.mName}`
        }${application.lead.lName && ` ${application.lead.lName}`}`,
        `Application allocated to ${employee.fName} ${employee.lName}`
    );

    // Send the updated lead as a JSON response
    return res.json({ application, logs }); // This is a successful response
});

// @desc Get Allocated Applications depends on whether if it's admin or a creditManager.
// @route GET /api/applications/allocated
// @access Private
export const allocatedApplications = asyncHandler(async (req, res) => {
    let query;
    if (req.activeRole === "admin" || req.activeRole === "sanctionHead") {
        query = {
            creditManagerId: {
                $ne: null,
            },
            onHold: { $ne: true },
            isRejected: { $ne: true },
            isRecommended: { $ne: true },
        };
    } else if (req.activeRole === "creditManager") {
        query = {
            creditManagerId: new mongoose.Types.ObjectId(req.employee.id),
            onHold: { $ne: true },
            isRejected: { $ne: true },
            isRecommended: { $ne: true },
        };
    } else {
        res.status(401);
        throw new Error("Not authorized!!!");
    }
    const page = parseInt(req.query.page) || 1; // current page
    const limit = parseInt(req.query.limit) || 10; // items per page
    const skip = (page - 1) * limit;
    console.log(query);

    const applications = await Application.aggregate([
        { $match: query }, // Apply filters

        { $skip: skip }, // Pagination: Skip documents
        { $limit: limit }, // Pagination: Limit documents

        // Lookup lead details
        {
            $lookup: {
                from: "leads",
                localField: "lead",
                foreignField: "_id",
                as: "leadData",
            },
        },
        { $unwind: { path: "$leadData", preserveNullAndEmptyArrays: true } },

        // Lookup credit manager details
        {
            $lookup: {
                from: "employees",
                localField: "creditManagerId",
                foreignField: "_id",
                as: "creditManagerData",
            },
        },
        {
            $unwind: {
                path: "$creditManagerData",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Lookup BRE collection using lead.pan
        {
            $lookup: {
                from: "bres",
                localField: "leadData.pan",
                foreignField: "pan",
                as: "breData",
            },
        },
        { $unwind: { path: "$breData", preserveNullAndEmptyArrays: true } },

        // Extract latest analysis entry instead of unwinding
        {
            $addFields: {
                latestAnalysis: { $arrayElemAt: ["$breData.analysis", -1] }, // Get the last element (latest entry)
            },
        },

        // Sort applications by updatedAt (after extracting the latest analysis)
        { $sort: { updatedAt: -1 } },

        // Final Projection
        {
            $project: {
                _id: 1,
                updatedAt: 1,

                // Lead Fields
                "lead.fName": "$leadData.fName",
                "lead.mName": "$leadData.mName",
                "lead.lName": "$leadData.lName",
                "lead.mobile": "$leadData.mobile",
                "lead.aadhaar": "$leadData.aadhaar",
                "lead.pan": "$leadData.pan",
                "lead.city": "$leadData.city",
                "lead.state": "$leadData.state",
                "lead.loanAmount": "$leadData.loanAmount",
                "lead.salary": "$leadData.salary",
                "lead.source": "$leadData.source",

                // Credit Manager Details
                "creditManagerId.fName": "$creditManagerData.fName",
                "creditManagerId.lName": "$creditManagerData.lName",

                // BRE Details
                "bre.finalDecision": "$latestAnalysis.finalDecision",
                "bre.maxLoanAmount": "$latestAnalysis.maxLoanAmount",
            },
        },
    ]);
    const totalApplications = await Application.countDocuments(query);

    return res.json({
        totalApplications,
        totalPages: Math.ceil(totalApplications / limit),
        currentPage: page,
        applications,
    });
});

// @desc Adding CAM details
// @access Private
export const postCamDetails = async (leadId, cibilScore, loanAmount, leadNo, pan , session) => {

    // need to add logic details come from lead
    const camDetails = new CamDetails({
        pan: pan,
        leadNo: leadNo,
        leadId: leadId,
        cibilScore: cibilScore,
        loanAmount: loanAmount
    });
    camDetails.save({session})

    return { success: true };
};

// @desc get CAM details
// @route GET /api/applications/cam/:id
// @access Private
export const getCamDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const application = await Application.findById(id);
    if (!application) {
        res.status(404);
        throw new Error("Application not found!!");
    }
    const cam = await CamDetails.findOne({
        leadId: application.lead,
    });

    if (!cam) {
        return { success: false, message: "No record found!!" };
    }

    res.json({ details: cam });
});

// @desc Update CAM details
// @route PATCH /api/applications/cam/:id
// @access Private
export const updateCamDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { details } = req.body;

    const application = await Application.findById(id)
        .populate({ path: "lead", populate: { path: "documents" } })
        .populate("creditManagerId");
    if (!application) {
        res.status(404);
        throw new Error("Application not found!!");
    }

    if (
        req.employee._id.toString() ===
        application.creditManagerId._id.toString()
    ) {

        // Find the CamDetails associated with the application (if needed)
        let cam = await CamDetails.findOne({
            leadId: application.lead._id,
        });

        if (!cam) {
            return res.json({ success: false, message: "No CAM found!!" });
        }

        // recheck calculation of repayment 
        const repaymentAmount = await calculateRepaymentAmount(details.repaymentDate, details.disbursalDate, details.loanRecommended, details.roi)
        if (repaymentAmount.toFixed(2) !== details.repaymentAmount.toFixed(2)) {
            res.status(400)
            return res.json({ success: false, message: "Repayment amount is not correct!! from frontend" });
        }

        // Update only the fields that are sent from the frontend
        Object.assign(cam,details)
        await cam.save();

        const logs = await postLogs(
            application.lead._id,
            "APPLICATION IN PROCESS",
            `${application.lead.fName}${application.lead.mName && ` ${application.lead.mName}`
            }${application.lead.lName && ` ${application.lead.lName}`}`,
            `CAM details added by ${application.creditManagerId.fName} ${application.creditManagerId.lName}`,
            `${cam?.loanAmount} ${cam?.loanRecommended} ${cam?.netDisbursalAmount} ${cam?.disbursalDate} ${cam?.repaymentDate} ${cam?.eligibleTenure} ${cam?.repaymentAmount}`
        );

        res.json({ success: true, log: logs });
    } else {
        res.status(401);
        throw new Error("You are not authorized to update CAM!!");
    }
});

// @desc Forward the Application to Sanction head
// @route Patch /api/applications/recommended/:id
// @access Private
export const recommendedApplication = asyncHandler(async (req, res) => {
    if (req.activeRole === "creditManager") {
        const { id } = req.params;

        // Find the application by its ID
        const application = await Application.findById(id)
            .populate({ path: "lead", populate: { path: "documents" } })
            .populate("creditManagerId");

        if (!application) {
            throw new Error("Application not found"); // This error will be caught by the error handler
        }

        const status = await LeadStatus.findById({
            _id: application.lead.leadStatus.toString(),
        });

        if (!status) {
            res.status(400);
            throw new Error("Status not found");
        }

        if (
            req.employee._id.toString() ===
            application.creditManagerId._id.toString()
        ) {
            const result = await checkApproval(
                {},
                application,
                "",
                req.employee._id.toString()
            );
            if (!result.approved) {
                return res
                    .status(400)
                    .json({ success: false, message: result.message });
            }

            // Sending the application to sanction
            const newSanction = new Sanction({
                leadNo: application.leadNo,
                pan: application.pan,
                application: application._id,
                pan: application.pan,
                leadNo: application.leadNo,
                recommendedBy: req.employee._id,
            });

            const response = await newSanction.save();

            if (!response) {
                res.status(400);
                throw new Error("Could not recommend this application!!");
            }

            // Change lead status to Sanction (showing the lead is in the sanction stage)
            status.stage = "SANCTION";
            status.subStage = "SANCTION IN PROCESS";
            await status.save();

            // Approve the lead by updating its status
            application.isRecommended = true;
            application.recommendedBy = req.employee._id;
            await application.save();
            const logs = await postLogs(
                application.lead._id,
                "APPLICATION FORWARDED. TRANSFERED TO SACNTION HEAD",
                `${application.lead.fName}${application.lead.mName && ` ${application.lead.mName}`
                }${application.lead.lName && ` ${application.lead.lName}`}`,
                `Application forwarded by ${application.creditManagerId.fName} ${application.creditManagerId.lName}`
            );
            return res.json(logs);
        } else {
            res.status(401);
            throw new Error(
                "You are not authorized to recommend this application!!"
            );
        }
    } else {
        res.status(401);
        throw new Error("You are not authorized!!!");
    }
});
