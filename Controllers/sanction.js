import asyncHandler from "../middleware/asyncHandler.js";
import Closed from "../models/Closed.js";
import { createActiveLead } from "./collection.js";
import { dateFormatter } from "../utils/dateFormatter.js";
import Disbursal from "../models/Disbursal.js";
import { exportApprovedSanctions } from "../utils/dataChange.js";
import { generateSanctionLetter } from "../utils/sendsanction.js";
import { getSanctionData } from "../utils/sanctionData.js";
import mongoose from "mongoose";
import { postLogs } from "./logs.js";

import Lead from "../models/Leads.js";
import Sanction from "../models/Sanction.js";
import { nextSequence } from "../utils/nextSequence.js";
import Documents from "../models/Documents.js";
import LeadStatus from "../models/LeadStatus.js";
import User from "../models/User/model.user.js";
import LoanApplication from "../models/User/model.loanApplication.js";
import Close from "../models/close.js";

// @desc Get the forwarded applications
// @route GET /api/sanction/recommended
// @access Private
export const getPendingSanctions = asyncHandler(async (req, res) => {
    if (req.activeRole === "sanctionHead"||req.activeRole === "admin") {
        const page = parseInt(req.query.page); // current page
        const limit = parseInt(req.query.limit); // items per page
        const skip = (page - 1) * limit;

        const query = {
            isRejected: { $ne: true },
            // isApproved: { $ne: true },
            eSignPending: { $ne: true },
            eSigned: { $ne: true },
        };

        const sanctions = await Sanction.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ updatedAt: -1 })
            .populate({
                path: "application",
                populate: [
                    { path: "lead", populate: { path: "documents" } },
                    { path: "recommendedBy", select: "fName mName lName" },
                ],
            });

        const totalSanctions = await Sanction.countDocuments(query);

        return res.json({
            totalSanctions,
            totalPages: Math.ceil(totalSanctions / limit),
            currentPage: page,
            sanctions,
        });
    }
});
// @desc Get the forwarded applications
// @route GET /api/sanction/eSignPending
// @access Private
export const getPendingESign = asyncHandler(async (req, res) => {
    if (req.activeRole === "sanctionHead"||req.activeRole === "admin") {
        const page = parseInt(req.query.page); // current page
        const limit = parseInt(req.query.limit); // items per page
        const skip = (page - 1) * limit;

        const query = {
            $and: [
                { isRejected: false },
                { isApproved: true },
                { eSigned: false },
            ],
        };

        const sanctions = await Sanction.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ updatedAt: -1 })
            .populate({
                path: "application",
                populate: [
                    { path: "lead", populate: { path: "documents" } },
                    { path: "recommendedBy", select: "fName mName lName" },
                ],
            });

        const totalSanctions = await Sanction.countDocuments(query);

        return res.json({
            totalSanctions,
            totalPages: Math.ceil(totalSanctions / limit),
            currentPage: page,
            sanctions,
        });
    }
});

// @desc Get the forwarded applications
// @route GET /api/sanction/recommended
// @access Private
export const recommendedApplications = asyncHandler(async (req, res) => {
    if (req.activeRole === "creditManager"||req.activeRole === "admin") {
        const page = parseInt(req.query.page); // current page
        const limit = parseInt(req.query.limit); // items per page
        const skip = (page - 1) * limit;

        const query = {
            recommendedBy: req.employee._id.toString(),
            isRejected: { $ne: true },
            onHold: { $ne: true },
            eSigned: { $ne: true },
        };

        const recommended = await Sanction.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ updatedAt: -1 })
            .populate({
                path: "application",
                populate: [
                    { path: "lead", populate: { path: "documents" } },
                    // { path: "recommendedBy", select: "fName mName lName" },
                ],
            });

        const totalRecommended = await Sanction.countDocuments(query);

        return res.json({
            totalRecommended,
            totalPages: Math.ceil(totalRecommended / limit),
            currentPage: page,
            recommended,
        });
    }

    if (req.activeRole === "sanctionHead" || activeRole === "admin") {
        const page = parseInt(req.query.page); // current page
        const limit = parseInt(req.query.limit); // items per page
        const skip = (page - 1) * limit;

        const query = {
            isRejected: { $ne: true },
            onHold: { $ne: true },
            isDisbursed: { $ne: true },
        };

        const recommended = await Sanction.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ updatedAt: -1 })
            .populate({
                path: "application",
                populate: [
                    { path: "lead", populate: { path: "documents" } },
                    { path: "recommendedBy", select: "fName mName lName" },
                ],
            });

        const totalRecommended = await Sanction.countDocuments(query);

        return res.json({
            totalRecommended,
            totalPages: Math.ceil(totalRecommended / limit),
            currentPage: page,
            recommended,
        });
    }
});

// @desc Get sanction
// @route GET /api/sanction/:id
// @access Private
export const getSanction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const sanction = await Sanction.findOne({ _id: id }).populate({
        path: "application",
        populate: [
            { path: "lead", populate: { path: "documents" } },
            { path: "recommendedBy", select: "fName mName lName" },
        ],
    });
    if (!sanction) {
        res.status(404);
        throw new Error("Application not found!!!!");
    }
    return res.json(sanction);
});

// @desc Preview Sanction letter
// @route GET /api/sanction/preview/:id
// @access Private
export const sanctionPreview = asyncHandler(async (req, res) => {
    if (req.activeRole === "sanctionHead") {
        const { id } = req.params;

        const { response } = await getSanctionData(id);

        return res.json({
            ...response,
            sanctionDate: dateFormatter(response.sanctionDate),
        });
    }
});

// @desc Send Sanction letter to applicants
// @route PATCH /api/sanction/approve/:id
// @access Private
export const sanctionApprove = asyncHandler(async (req, res) => {
    if (req.activeRole === "sanctionHead") {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;

            const { sanction, response, leadNo } = await getSanctionData(
                id
            );

            const { fName, mName, lName, pan } =
                sanction.application.applicant.personalDetails;

            const lead = await Lead.findById({
                _id: sanction.application.lead,
            });

            const activeLead = await Close.findOne(
                {
                    pan,
                    isActive:true,
                },
                {
                    pan: 1,
                    isActive:1
                }
            );

            if (activeLead) {
                res.status(403);
                throw new Error("This PAN already has an active lead!!");
            }

            const newLoanNo = await nextSequence("loanNo", "QUALON", 7);

            const update = await Sanction.findByIdAndUpdate(
                id,
                {
                    loanNo: newLoanNo,
                    sanctionDate: response.sanctionDate,
                    isApproved: true,
                    approvedBy: req.employee._id.toString(),
                },
                { new: true }
            );

            // insert loanNo in loanApplication (user side)
            let user
            user = await User.findOne(
                { PAN:pan },
               
            );
            if(user){
                const loanDetails = await LoanApplication.findOneAndUpdate(
                    { userId: user._id },
                    { loanNo: newLoanNo },
                    { new: true, sort: { createdAt: -1 } }
                );
                console.log("loanDetails--->" , loanDetails)

            }

            

            

            const existing = await Sanction.findById(id);

            if (!update) {
                res.status(400);
                throw new Error("There was some problem with update!!");
            }

            const newActiveLead = await createActiveLead(
                pan,
                existing.loanNo,
                lead.leadNo
                // disbursalRes._id
            );
            console.log(newActiveLead);

            if (!newActiveLead.success) {
                res.status(400);
                throw new Error(
                    "Could not create an active lead for this record!!"
                );
            }


            await LeadStatus.findOneAndUpdate({
                leadNo: lead.leadNo
            },
                {
                    subStage : "SANCTION APPROVED AND LOAN NUMBER ALLOTTED",
                    stage: "SANCTION"
                })
            const logs = await postLogs(
                sanction.application.lead,
                "SANCTION APPROVED AND LOAN NUMBER ALLOTTED",
                `${fName}${mName && ` ${mName}`}${lName && ` ${lName}`}`,
                `Sanction approved by ${req.employee.fName} ${req.employee.lName}`
            );

            return res.json({ success: true, logs , leadNo :lead.leadNo  });
        } catch (error) {
            console.log("error", error);
            res.status(500);
            throw new Error(error.message);
        }
    } else {
        res.status(401);
        throw new Error("You are not authorized!!");
    }
});
// @desc Send Sanction letter to applicants
// @route PATCH /api/sanction/sendESign/:id
// @access Private
export const sendESign = asyncHandler(async (req, res) => {
    if (req.activeRole === "sanctionHead") {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;

            const { sanction, camDetails, response } = await getSanctionData(
                id
            );

            const { fName, mName, lName, pan, personalEmail } =
                sanction.application.applicant.personalDetails;

            const lead = await Lead.findById({
                _id: sanction.application.lead,
            });

            const docs = await Documents.findOne({ _id: lead.documents });


            // Call the generateSanctionLetter utility function
            const emailResponse = await generateSanctionLetter(
                `SANCTION LETTER - ${response.fullname}`,
                dateFormatter(response.sanctionDate),
                response.title,
                response.loanNo,
                response.fullname,
                response.mobile,
                response.residenceAddress,
                response.stateCountry,
                camDetails,
                lead,
                docs,
                `${personalEmail}`
            );

            // // Return a unsuccessful response
            if (!emailResponse.success) {
                return res.status(400).json({ success: false });
            }

            const update = await Sanction.findByIdAndUpdate(
                id,
                {
                    eSignPending: true,
                },
                { new: true }
            );

            const existing = await Sanction.findById(id);

            console.log('existing',existing)

            if (!update) {
                res.status(400);
                throw new Error("There was some problem with update!!");
            }


            const newDisbursal = new Disbursal({
                sanction: sanction._id,
                pan: sanction.pan,
                leadNo: sanction.leadNo,
                loanNo: existing.loanNo,
            });

            const disbursalRes = await newDisbursal.save();

            if (!disbursalRes) {
                res.status(400);
                throw new Error("Could not approve this application!!");
            }

            // Update the Closed collection
            const updateResult = await Close.updateOne(
                {
                    pan,
                    loanNo: existing.loanNo, // Match the document where the data array has this loanNo
                },
                {
                    $set: {
                        disbursal: disbursalRes._id, // Use the `$` positional operator to update the matched array element
                    },
                }
            );

            if (updateResult.modifiedCount === 0) {
                res.status(400);
                throw new Error(
                    "No matching record found to update in the Closed collection!"
                );
            }

            await LeadStatus.findOneAndUpdate({
                leadNo: lead.leadNo
            },
                {
                    stage : "SANCTION" , 
                    subStage: "SANCTION LETTER SENT TO CLIENT FOR E-SIGN"
                })
            const logs = await postLogs(
                sanction.application.lead,
                "SANCTION LETTER SENT TO CLIENT FOR E-SIGN",
                `${fName}${mName && ` ${mName}`}${lName && ` ${lName}`}`,
                `Sanction Letter sent by ${req.employee.fName} ${req.employee.lName}`
            );

            return res.json({ success: true, logs });
        } catch (error) {
            console.log("error", error);
            res.status(500);
            throw new Error(error.message);
        }
    } else {
        res.status(401);
        throw new Error("You are not authorized!!");
    }
});

// @desc Get all sanctioned applications
// @route GET /api/sanction/approved
// @access Private
export const sanctioned = asyncHandler(async (req, res) => {
    // const page = parseInt(req.query.page); // current page
    // const limit = parseInt(req.query.limit); // items per page
    // const skip = (page - 1) * limit;
    let query;
    if (req.activeRole === "creditManager") {
        query = {
            creditManagerId: req.employee._id.toString(),
            eSigned: { $ne: true },
        };
    } else if (req.activeRole === "sanctionHead") {
        query = {
            // eSigned: { $eq: true },
            isApproved: { $eq: true },
            // isDisbursed: { $ne: true },
            $or: [
                { eSigned: { $eq: true } },
                { eSignPending: { $eq: true } }
            ]
        };
    }
    const sanction = await Sanction.aggregate([
        { $match: query },
        // { $skip: skip },
        // { $limit: limit },

        // Lookup Application
        {
            $lookup: {
                from: "applications",
                localField: "application",
                foreignField: "_id",
                as: "application",
                pipeline: [
                    {
                        $project: {
                            lead: 1,
                            recommendedBy: 1,
                        },
                    },
                ],
            },
        },
        { $set: { application: { $arrayElemAt: ["$application", 0] } } },

        // Lookup Lead
        {
            $lookup: {
                from: "leads",
                localField: "application.lead",
                foreignField: "_id",
                as: "application.lead",
                pipeline: [
                    {
                        $project: {
                            fName: 1,
                            mName: 1,
                            lName: 1,
                            pan: 1,
                            aadhaar: 1,
                            mobile: 1,
                            city: 1,
                            state: 1,
                            source: 1,
                            // salary: 1,
                            // loanAmount: 1,
                        },
                    },
                ],
            },
        },
        {
            $set: {
                "application.lead": { $arrayElemAt: ["$application.lead", 0] },
            },
        },

        // Lookup CAM Details
        {
            $lookup: {
                from: "camdetails",
                localField: "application.lead._id", // Correctly resolved lead ID
                foreignField: "leadId",
                as: "camDetails",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            loanRecommended: "$details.loanRecommended",
                            actualNetSalary: "$details.actualNetSalary",
                        },
                    },
                ],
            },
        },
        { $set: { camDetails: { $arrayElemAt: ["$camDetails", 0] } } },

        // Lookup RecommendedBy (Users)
        {
            $lookup: {
                from: "employees",
                localField: "application.recommendedBy",
                foreignField: "_id",
                as: "application.recommendedBy",
                pipeline: [
                    {
                        $project: {
                            fName: 1,
                            lName: 1,
                        },
                    },
                ],
            },
        },
        {
            $set: {
                "application.recommendedBy": {
                    $arrayElemAt: ["$application.recommendedBy", 0],
                },
            },
        },
        { $sort: { updatedAt: -1 } },

        // Final Projection
        {
            $project: {
                "application.lead.fName": 1,
                "application.lead.mName": 1,
                "application.lead.lName": 1,
                "application.lead.pan": 1,
                "application.lead.mobile": 1,
                "application.lead.aadhaar": 1,
                "application.lead.city": 1,
                "application.lead.state": 1,
                "application.lead.source": 1,
                "application.recommendedBy.fName": 1,
                "application.recommendedBy.mName": 1,
                "application.recommendedBy.lName": 1,
                "camDetails.loanRecommended": 1,
                "camDetails.actualNetSalary": 1,
            },
        },
    ]);

    const totalSanctions = await Sanction.countDocuments(query);

    return res.json({
        totalSanctions,
        // totalPages: Math.ceil(totalSanctions / limit),
        // currentPage: page,
        sanction,
    });
});

// @desc Get report of today's sanctioned applications
// @route GET /api/sanction/approved/report
// @access Private
export const sanctionedReport = asyncHandler(async (req, res) => {
    const data = await exportApprovedSanctions();
    return res.json({ data });
});
