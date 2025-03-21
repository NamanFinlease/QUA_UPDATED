import asyncHandler from "../middleware/asyncHandler.js";
import CamDetails from "../models/CAM.js";
import Closed from "../models/Closed.js";
import Collection from "../models/Collection.js";
import Disbursal from "../models/Disbursal.js";
import mongoose, { mongo } from "mongoose";
import Payment from "../models/Payment.js";
import { postLogs } from "./logs.js";
import { calculateReceivedPayment } from "../utils/calculateReceivedPayment.js";
import Documents from "../models/Documents.js";
import { uploadDocs } from "../utils/docsUploadAndFetch.js";
import LeadStatus from "../models/LeadStatus.js";
import Employee from "../models/Employees.js";
import Lead from "../models/Leads.js";
import { sessionAsyncHandler } from "../middleware/sessionAsyncHandler.js";
import Close from "../models/close.js";

// @desc Create a lead to close after collection/recovery
// @route POST /api/collections/
export const createActiveLead = async (pan, loanNo, leadNo) => {
    try {
        const existingActiveLead = await Close.findOne({ pan: pan });

        const newActiveLead = await Close.create({
            pan,
            loanNo,
            leadNo,
        });
        if (!newActiveLead) {
            return { success: false };
        }
        return { success: true };

        // console.log('existing',existingActiveLead)
        // if (!existingActiveLead) {
        //     const newActiveLead = await Close.create({
        //         pan,
        //         loanNo,
        //         leadNo,
        //     });
        //     if (!newActiveLead) {
        //         return { success: false };
        //     }
        //     return { success: true };
        // } else if (
        //     existingActiveLead.isActive === false
        // ) {
        //     // If disbursal ID is not found, add the new disbursal
        //     existingActiveLead.push({ loanNo: loanNo, leadNo: leadNo });
        //     const res = await existingActiveLead.save();
        //     if (!res) {
        //         return { success: false };
        //     }
        //     return { success: true };
        // } else {
        //     return { success: false };
        // }
    } catch (error) {
        console.log(error);
    }
};

// @desc Get all active leads
// @route GET /api/collections/active
// @access Private
export const activeLeads = asyncHandler(async (req, res) => {
    if (
        req.activeRole === "collectionExecutive" ||
        req.activeRole === "admin"
    ) {
        // const page = parseInt(req.query.page) || 1; // current page
        // const limit = parseInt(req.query.limit) || 10; // items per page
        // const skip = (page - 1) * limit;

        // const pipeline = [
        //     {
        //         $match: {
        //             // Match the parent document where the data array contains elements
        //             // that have isActive: true
        //             "data.isActive": true,
        //             "data.isDisbursed": true,
        //             "data.isClosed": false,
        //         },
        //     },
        //     {
        //         $project: {
        //             pan: 1,
        //             data: {
        //                 $arrayElemAt: [
        //                     {
        //                         $filter: {
        //                             input: "$data",
        //                             as: "item", // Alias for each element in the array
        //                             cond: {
        //                                 $and: [
        //                                     { $eq: ["$$item.isActive", true] }, // Condition for isActive
        //                                     {
        //                                         $eq: [
        //                                             "$$item.isDisbursed",
        //                                             true,
        //                                         ],
        //                                     },
        //                                 ],
        //                             },
        //                         },
        //                     },
        //                     0,
        //                 ],
        //             },
        //         },
        //     },
        //     {
        //         $sort: {
        //             updatedAt: -1, // Sort by updatedAt in descending order
        //         },
        //     },
        //     // {
        //     //     $skip: skip,
        //     // },
        //     // {
        //     //     $limit: limit,
        //     // },
        // ];

        // // const results = await Closed.aggregate(pipeline);
        // const activeLeads = await Closed.aggregate([

        //     {
        //         $addFields: {
        //             data: {
        //                 $filter: {
        //                     input: "$data",
        //                     as: "item",
        //                     cond: {
        //                         $and: [
        //                             { $eq: ["$$item.isActive", true] },
        //                             { $eq: ["$$item.isDisbursed", true] },
        //                             { $eq: ["$$item.isClosed", false] },
        //                         ],
        //                     },
        //                 },
        //             },
        //         },
        //     },
        //     {
        //         $unwind: "$data", // Ensure `data` becomes a single object, not an array
        //     },
        //     {
        //         $lookup: {
        //             from: "disbursals", // Replace with the actual collection name for disbursals
        //             localField: "data.disbursal",
        //             foreignField: "_id",
        //             as: "data.disbursal",
        //         },
        //     },
        //     {
        //         $unwind: {
        //             path: "$data.disbursal",
        //             preserveNullAndEmptyArrays: true,
        //         },
        //     },
        //     {
        //         $lookup: {
        //             from: "sanctions", // Replace with the actual collection name for sanctions
        //             localField: "data.disbursal.sanction",
        //             foreignField: "_id",
        //             as: "data.disbursal.sanction",
        //         },
        //     },
        //     {
        //         $unwind: {
        //             path: "$data.disbursal.sanction",
        //             preserveNullAndEmptyArrays: true,
        //         },
        //     },
        //     {
        //         $lookup: {
        //             from: "applications", // Replace with the actual collection name for applications
        //             localField: "data.disbursal.sanction.application",
        //             foreignField: "_id",
        //             as: "data.disbursal.sanction.application",
        //         },
        //     },
        //     {
        //         $unwind: {
        //             path: "$data.disbursal.sanction.application",
        //             preserveNullAndEmptyArrays: true,
        //         },
        //     },
        //     {
        //         $lookup: {
        //             from: "leads", // Replace with the actual collection name for leads
        //             localField: "data.disbursal.sanction.application.lead",
        //             foreignField: "_id",
        //             as: "data.disbursal.sanction.application.lead",
        //         },
        //     },
        //     {
        //         $unwind: {
        //             path: "$data.disbursal.sanction.application.lead",
        //             preserveNullAndEmptyArrays: true,
        //         },
        //     },
        //     {
        //         $lookup: {
        //             from: "documents", // Replace with the actual collection name for documents
        //             localField:
        //                 "data.disbursal.sanction.application.lead.documents",
        //             foreignField: "_id",
        //             as: "data.disbursal.sanction.application.lead.documents",
        //         },
        //     },
        //     {
        //         $sort: { updatedAt: -1 },
        //     },
        // ]);

        // const totalActiveLeads = await Closed.countDocuments({
        //     "data.isActive": true,
        // });

        const pipeline = [
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
                $match: {
                    $expr: {
                        $gt: [
                            {
                                $divide: [
                                    {
                                        $subtract: [
                                            "$$NOW",
                                            "$camDetails.repaymentDate",
                                        ],
                                    },
                                    86400000,
                                ],
                            },
                            5,
                        ],
                    },
                },
            },
            {
                $match: {
                    collectionExecutiveId: {
                        $exists: false,
                    },
                },
            },
            {
                $lookup: {
                    from: "closes",
                    localField: "close",
                    foreignField: "_id",
                    as: "closedDetails",
                },
            },
            {
                $unwind: "$closedDetails",
            },
            {
                $match: {
                    "closedDetails.isActive": true,
                    "closedDetails.isClosed": false,
                    "closedDetails.isDisbursed": true,
                },
            },
            {
                $lookup: {
                    from: "leads",
                    localField: "leadNo",
                    foreignField: "leadNo",
                    as: "leadDetails",
                },
            },
            {
                $unwind: "$leadDetails",
            },
            {
                $lookup: {
                    from: "disbursals",
                    localField: "disbursal",
                    foreignField: "_id",
                    as: "disbursalDetails",
                },
            },
            {
                $unwind: "$disbursalDetails",
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "disbursalDetails.disbursedBy",
                    foreignField: "_id",
                    as: "employeeDetails",
                },
            },
            {
                $unwind: "$employeeDetails",
            },
            {
                $project: {
                    _id: 1,
                    disbursedBy: {
                        $concat: [
                            "$employeeDetails.fName",
                            " ",
                            "$employeeDetails.lName",
                        ],
                    },
                    sanctionAmount: "$camDetails.loanRecommended",
                    fName: "$leadDetails.fName",
                    mName: "$leadDetails.mName",
                    lName: "$leadDetails.lName",
                    gender: "$leadDetails.gender",
                    dob: "$leadDetails.dob",
                    aadhaar: "$leadDetails.aadhaar",
                    pan: "$leadDetails.pan",
                    mobile: "$leadDetails.mobile",
                    personalEmail: "$leadDetails.personalEmail",
                    state: "$leadDetails.state",
                    city: "$leadDetails.city",
                    salary: "$leadDetails.salary",
                    leadNo: "$leadDetails.leadNo",
                    loanNo: 1,
                    repaymentDate: "$camDetails.repaymentDate",
                    disbursalDate: "$camDetails.disbursalDate",
                },
            },
        ];

        const activeLeads = await Collection.aggregate(pipeline);
        const totalActiveLeads = Number(activeLeads.length);
        res.json({
            totalActiveLeads,
            // totalPages: Math.ceil(totalActiveLeads / limit),
            // currentPage: page,
            activeLeads,
        });
    }
});

// @desc Add received payment
// @route POST /api/collections/updatePayment/:loanNo
// @access Private
export const updatePayment = sessionAsyncHandler(async (req, res, session) => {
    if (
        req.activeRole === "collectionExecutive" ||
        req.activeRole === "collectionHead"
    ) {
        const { loanNo } = req.params;
        let collectionEmpId = req.employee._id.toString();
        let {
            bankName,
            receivedAmount,
            transactionId,
            paymentMode,
            paymentMethod,
            closingType,
            remarks,
            discount = 0,
            excessAmount = 0,
            discountType,
            collectionRemarks,
            isSettledAmount,
            isWriteOffAmount,
            paymentDate,
        } = req.body;

        let isPartialPaid;
        const collectionData = await Collection.findOne({ loanNo }).session(
            session
        );

        if (!collectionData) {
            await session.abortTransaction();
            return res
                .status(404)
                .json({ error: "Collection record not found" });
        }

        const docs = await Documents.findOne({
            pan: collectionData.pan,
        }).session(session);

        if (receivedAmount > collectionData.outstandingAmount) {
            excessAmount = receivedAmount - collectionData.outstandingAmount;
        } else if (
            receivedAmount >= Math.floor(collectionData.outstandingAmount) &&
            receivedAmount < collectionData.outstandingAmount
        ) {
            discount = collectionData.outstandingAmount - receivedAmount;
        } else if (
            receivedAmount < Math.floor(collectionData.outstandingAmount) ||
            closingType === "partPayment"
        ) {
            isPartialPaid = true;
            closingType = "partPayment";
        }

        if (req.files) {
            const result = await uploadDocs(docs, req.files, remarks);
            if (!result) {
                await session.abortTransaction();
                return res
                    .status(400)
                    .json({ error: "Couldn't store documents." });
            }
        }

        const existingPayment = await Payment.findOne(
            {
                loanNo,
                "paymentHistory.transactionId": transactionId,
            },
            { "paymentHistory.$": 1, totalReceivedAmount: 1 }
        ).session(session);

        if (
            existingPayment &&
            existingPayment.paymentHistory[0].isPaymentVerified
        ) {
            await session.abortTransaction();
            return res
                .status(403)
                .json({ error: "Payment is already updated!" });
        }

        let updatedPayment;

        if (existingPayment && existingPayment.paymentHistory.length > 0) {
            updatedPayment = await Payment.findOneAndUpdate(
                {
                    loanNo,
                    "paymentHistory.transactionId": transactionId,
                },
                {
                    $set: {
                        "paymentHistory.$.receivedAmount": receivedAmount,
                        "paymentHistory.$.excessAmount": excessAmount,
                        "paymentHistory.$.paymentMode": paymentMode,
                        "paymentHistory.$.paymentMethod": paymentMethod,
                        "paymentHistory.$.paymentDate": paymentDate,
                        "paymentHistory.$.closingType": closingType,
                        "paymentHistory.$.discountType": discountType,
                        "paymentHistory.$.discount": discount,
                        "paymentHistory.$.excessAmount": excessAmount,
                        "paymentHistory.$.collectionRemarks": collectionRemarks,
                        "paymentHistory.$.isPartialPaid": isPartialPaid,
                        "paymentHistory.$.paymentUpdateRequest": true,
                        "paymentHistory.$.paymentUpdateRequestBy":
                            collectionEmpId,
                        "paymentHistory.$.bankName": bankName,
                    },
                },
                { new: true, runValidators: true, session }
            );
        } else {
            // Update Payment Collection --------------
            updatedPayment = await Payment.findOneAndUpdate(
                { loanNo },
                {
                    $push: {
                        paymentHistory: {
                            receivedAmount,
                            paymentMode,
                            paymentMethod,
                            paymentDate,
                            closingType,
                            discountType,
                            discount,
                            excessAmount,
                            collectionRemarks,
                            isPartialPaid,
                            transactionId,
                            paymentUpdateRequest: true,
                            paymentUpdateRequestBy: collectionEmpId,
                        },
                    },
                },
                { new: true, runValidators: true, session }
            );

            if (!updatedPayment) {
                res.status(404);
                throw new Error("Payment record not found");
            }

            // update logs and leadStatus
            const collectionData = await Collection.findOne(
                { loanNo: loanNo },
                null,
                { session }
            );
            const lead = await Lead.findOne(
                { leadNo: collectionData.leadNo },
                null,
                { session }
            );
            const employee = await Employee.findById(collectionEmpId, null, {
                session,
            });
            await LeadStatus.findOneAndUpdate(
                {
                    leadNo: lead.leadNo,
                },
                {
                    stage: "COLLECTION",
                    subStage: "COLLECTION IN PROCESS",
                },
                { session }
            );
            await postLogs(
                lead._id,
                "UPDATE PAYMENT BY COLLECTION EXECUTIVE",
                `${lead.fName}${lead.mName && ` ${lead.mName}`}${
                    lead.lName && ` ${lead.lName}`
                }`,
                `Payment Updated by ${employee.fName} ${employee.lName}`,
                `${collectionRemarks}`,
                session
            );
        }

        return res.json({ message: "Payment is updated!" });
    }
});

// @desc Get a specific active leads
// @route GET /api/collections/repayment/:id
// @access Private
export const repaymentDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("id", id);
    // const activeRecord = (await Closed.aggregate(pipeline))[0];
    const repaymentDetails = await Collection.aggregate([
        {
            $match: {
                loanNo: id,
            },
        },
        {
            $lookup: {
                from: "camdetails",
                localField: "camDetails",
                foreignField: "_id",
                as: "camData",
            },
        },
        {
            $lookup: {
                from: "disbursals",
                localField: "disbursal",
                foreignField: "_id",
                as: "disbursalData",
            },
        },
        {
            $lookup: {
                from: "sanctions",
                localField: "disbursalData.sanction",
                foreignField: "_id",
                as: "sanctionData",
            },
        },
        {
            $lookup: {
                from: "payments",
                localField: "payment",
                foreignField: "_id",
                as: "paymentData",
            },
        },
        {
            $unwind: {
                path: "$camData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $unwind: {
                path: "$disbursalData",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $unwind: {
                path: "$sanctionData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $unwind: {
                path: "$paymentData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                penalty: 1,
                interest: 1,
                principalAmount: 1,
                penalRate: 2,
                dpd: 1,
                loanNo: 1,
                outstandingAmount: 1,
                penaltyDiscount: "$paymentData.penaltyDiscount",
                interestDiscount: "$paymentData.interestDiscount",
                principalDiscount: "$paymentData.principalDiscount",
                penaltyReceived: "$paymentData.penaltyReceived",
                interestReceived: "$paymentData.interestReceived",
                principalReceived: "$paymentData.principalReceived",
                sanctionedAmount: "$camData.loanRecommended",
                repaymentDate: "$camData.repaymentDate",
                roi: "$camData.roi",
                sanctionDate: "$sanctionData.sanctionDate",
                paymentHistory: "$paymentData.paymentHistory",
            },
        },
    ]);

    if (!repaymentDetails) {
        res.status(404);
        throw new Error({
            success: false,
            message: "Loan number not found.",
        });
    }

    return res.json({ status: true, repaymentDetails: repaymentDetails[0] });
});
// @desc Get a specific active leads
// @route GET /api/collections/active/:loanNo
// @access Private
export const getActiveLead = asyncHandler(async (req, res) => {
    const { loanNo } = req.params;

    // const activeRecord = (await Closed.aggregate(pipeline))[0];
    const leadInfo = await Close.aggregate([
        { $match: { loanNo } }, // Match loan number

        // Lookup Disbursal
        {
            $lookup: {
                from: "disbursals",
                localField: "disbursal",
                foreignField: "_id",
                as: "disbursal",
            },
        },
        { $unwind: { path: "$disbursal", preserveNullAndEmptyArrays: true } },

        // Lookup ApprovedBy inside Sanction
        {
            $lookup: {
                from: "employees",
                localField: "disbursal.disbursedBy",
                foreignField: "_id",
                as: "disbursal.disbursedBy",
            },
        },
        {
            $unwind: {
                path: "$disbursal.disbursedBy",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Lookup Sanction inside Disbursal
        {
            $lookup: {
                from: "sanctions",
                localField: "disbursal.sanction",
                foreignField: "_id",
                as: "disbursal.sanction",
            },
        },
        {
            $unwind: {
                path: "$disbursal.sanction",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Lookup ApprovedBy inside Sanction
        {
            $lookup: {
                from: "employees",
                localField: "disbursal.sanction.approvedBy",
                foreignField: "_id",
                as: "disbursal.sanction.approvedBy",
            },
        },
        {
            $unwind: {
                path: "$disbursal.sanction.approvedBy",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Lookup Application inside Sanction
        {
            $lookup: {
                from: "applications",
                localField: "disbursal.sanction.application",
                foreignField: "_id",
                as: "disbursal.sanction.application",
            },
        },
        {
            $unwind: {
                path: "$disbursal.sanction.application",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Lookup Lead inside Application
        {
            $lookup: {
                from: "leads",
                localField: "disbursal.sanction.application.lead",
                foreignField: "_id",
                as: "disbursal.sanction.application.lead",
            },
        },
        {
            $unwind: {
                path: "$disbursal.sanction.application.lead",
                preserveNullAndEmptyArrays: true,
            },
        },
        // Lookup Documents inside Lead

        // Lookup Documents inside Lead
        {
            $lookup: {
                from: "documents",
                localField: "disbursal.sanction.application.lead.documents",
                foreignField: "_id",
                as: "disbursal.sanction.application.lead.documents",
            },
        },

        // Transform documents array into a single object
        {
            $set: {
                "disbursal.sanction.application.lead.documents": {
                    $arrayElemAt: [
                        "$disbursal.sanction.application.lead.documents",
                        0,
                    ],
                },
            },
        },

        // Lookup CreditManagerId inside Application
        {
            $lookup: {
                from: "employees",
                localField: "disbursal.sanction.application.creditManagerId",
                foreignField: "_id",
                as: "disbursal.sanction.application.creditManagerId",
            },
        },
        {
            $unwind: {
                path: "$disbursal.sanction.application.creditManagerId",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Lookup RecommendedBy inside Application
        {
            $lookup: {
                from: "employees",
                localField: "disbursal.sanction.application.recommendedBy",
                foreignField: "_id",
                as: "disbursal.sanction.application.recommendedBy",
            },
        },
        {
            $unwind: {
                path: "$disbursal.sanction.application.recommendedBy",
                preserveNullAndEmptyArrays: true,
            },
        },

        // Project only required fields
        {
            $project: {
                pan: 1,
                loanNo: 1,
                isClosed: 1,
                isActive: 1,
                disbursal: 1, // Keep full disbursal structure
            },
        },
    ]);

    if (!leadInfo) {
        res.status(404);
        throw new Error({
            success: false,
            message: "Loan number not found.",
        });
    }

    // Fetch the CAM data and add to disbursalObj
    const cam = await CamDetails.findOne({
        leadId: leadInfo[0]?.disbursal?.sanction?.application?.lead._id,
    });

    // const activeLeadObj = activeRecord.toObject();

    // // Extract the matched data object from the array
    // const matchedData = activeLeadObj; // Since $elemMatch returns a single matching element
    leadInfo[0].disbursal.sanction.application.cam = cam;

    return res.json({
        // pan: activeLeadObj.pan, // Include the parent fields
        data: leadInfo[0], // Send the matched object as a single object
    });
});

// @desc Update an active lead after collection/recovery
// @route PATCH /api/collections/active/:loanNo
// @access Private
export const updateActiveLead = asyncHandler(async (req, res) => {
    if (req.activeRole === "collectionExecutive") {
        const { loanNo } = req.params;
        const updates = req.body;

        const pipeline = [
            {
                $match: { loanNo: loanNo }, // Match documents where the data array contains the loanNo
            },
            {
                $project: {
                    loanNo: 1,
                },
            },
        ];

        const activeRecord = (await Close.aggregate(pipeline))[0];

        if (!activeRecord || !activeRecord.data?.length) {
            res.status(404);
            throw new Error({
                success: false,
                message: "Loan number not found.",
            });
        }

        // Populate the filtered data
        const populatedRecord = await Close.populate(activeRecord, {
            path: "disbursal",
            populate: {
                path: "sanction", // Populating the 'sanction' field in Disbursal
                populate: [
                    { path: "approvedBy" },
                    {
                        path: "application",
                        populate: [
                            { path: "lead", populate: { path: "documents" } }, // Nested populate for lead and documents
                            { path: "creditManagerId" }, // Populate creditManagerId
                            { path: "recommendedBy" },
                        ],
                    },
                ],
            },
        });

        // Check if updates are provided
        if (updates && updates.data) {
            const updateQuery = {
                loanNo,
            };

            let updateOperation = {};

            if (updates.data.partialPaid) {
                // If partialPaid is present in the updates, push the object into the array
                updateOperation.$push = {
                    partialPaid: updates.partialPaid,
                    requestedStatus: updates.requestedStatus,
                };
            } else {
                updateOperation.$set = {
                    ...populatedRecord,
                    ...updates,
                };
            }

            const updatedRecord = await Close.findOneAndUpdate(
                updateQuery,
                updateOperation,
                { new: true } // Return the updated document
            );

            if (updatedRecord) {
                return res.json({
                    success: true,
                    message: "Record updated successfully.",
                });
            } else {
                res.status(404);
                throw new Error("Unable to update the record.");
            }
        }
    }
    // If no updates or empty data, return a successful response with no changes
    return res.json({
        success: true,
        message: "No changes made. Record remains unchanged.",
    });
});

// @desc Get all the closed leads
// @route GET /api/collections/closed/
// @access Private
export const closedLeads = asyncHandler(async (req, res) => {
    // if (req.activeRole === "accountExecutive") {
    // const page = parseInt(req.query.page) || 1; // current page
    // const limit = parseInt(req.query.limit) || 10; // items per page
    // const skip = (page - 1) * limit;

    const closedLeads = await Close.find({
        isActive: false,
        isClosed: true,
    })
        .populate({
            path: "disbursal",
            populate: {
                path: "sanction", // Populating the 'sanction' field in Disbursal
                populate: [
                    { path: "approvedBy" },
                    {
                        path: "application",
                        populate: [
                            { path: "lead", populate: { path: "documents" } }, // Nested populate for lead and documents
                            { path: "creditManagerId" }, // Populate creditManagerId
                            { path: "recommendedBy" },
                        ],
                    },
                ],
            },
        })
        .sort({ updatedAt: -1 });

    const totalClosedLeads = await Close.countDocuments({
        isActive: false,
        isClosed: true,
    });

    res.json({
        totalClosedLeads,
        // totalPages: Math.ceil(totalClosedLeads / limit),
        // currentPage: page,
        closedLeads,
    });
    // }
});

// need to changes in this controller according to UI
export const getPaymentCalculation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: "Collection ID not provided" });
    }

    const pipeline = [
        {
            $match: {
                _id: new mongoose.Types.ObjectId(id), // Match the specific Collection document by ID
            },
        },
        {
            $lookup: {
                from: "payments", // The name of the Payment collection
                localField: "payment",
                foreignField: "_id",
                as: "paymentDetails", // Embed the matching Payment documents
            },
        },
        {
            $project: {
                _id: 0,
                loanNo: 1,
                pan: 1,
                leadNo: 1,
                payableAmount: {
                    $add: ["$principalAmount", "$interest", "$totalPenalty"], // Directly map the payable amount
                },
                receivedAmount: "$paymentDetails.paymentHistory.receivedAmount", // Include payment history
                discountAmount: "$paymentDetails.paymentHistory.waiver", // Include discount amounts
                outstandingAmount: "$outstandingAmount", // Include outstanding amount
                paymentDetails: 1, // Keep the array of matching payments for reference
            },
        },
    ];
    const collection = await Collection.aggregate(pipeline);

    if (!collection) {
        res.status(404).json({ message: "Collection not found" });
    }

    return res.status(200).json({ collection });
});

export const getRecoveryList = asyncHandler(async (req, res) => {
    const { collectionId } = req.params;
    if (!collectionId) {
        return res.status(400).json({ message: "collection id not defined" });
    }
    const collectionDetails = await Collection.findById(collectionId);

    const pipeline = [
        {
            $match: {
                _id: new mongoose.Types.ObjectId(collectionDetails.payment),
            },
        },
        {
            $project: {
                _id: 1,
                paymentHistory: 1,
            },
        },
    ];

    const recoveryList = await Payment.aggregate(pipeline);

    return res
        .status(200)
        .json({ message: "Recovery List get sucessfully", recoveryList });
});

// get list for closed bucket
export const getClosedList = asyncHandler(async (req, res) => {
    if (
        req.activeRole === "collectionExecutive" ||
        req.activeRole === "collectionHead" ||
        req.activeRole === "accountExecutive" ||
        req.activeRole === "accountHead" ||
        req.activeRole === "admin"
    ) {
        const pipeline = [
            {
                $match: {
                    isActive: false,
                    isClosed: true,
                    // isDisbursed: true
                },
            },

            {
                $lookup: {
                    from: "disbursals",
                    localField: "disbursal",
                    foreignField: "_id",
                    as: "disbursalDetails",
                },
            },

            { $unwind: "$disbursalDetails" },
            {
                $match: {
                    "disbursalDetails.isDisbursed": true,
                },
            },

            {
                $lookup: {
                    from: "sanctions",
                    localField: "disbursalDetails.sanction",
                    foreignField: "_id",
                    as: "sanctionData",
                },
            },

            { $unwind: "$sanctionData" },
            {
                $lookup: {
                    from: "applications",
                    localField: "sanctionData.application",
                    foreignField: "_id",
                    as: "applicationData",
                },
            },

            { $unwind: "$applicationData" },

            {
                $lookup: {
                    from: "leads",
                    localField: "applicationData.lead",
                    foreignField: "_id",
                    as: "leadData",
                },
            },

            { $unwind: "$leadData" },
            {
                $lookup: {
                    from: "camdetails",
                    localField: "leadData._id",
                    foreignField: "leadId",
                    as: "camData",
                },
            },

            { $unwind: "$camData" },
            {
                $match: {
                    "camData.repaymentAmount": { $gt: 0 },
                },
            },
            {
                $lookup: {
                    from: "payments",
                    localField: "disbursalDetails.loanNo",
                    foreignField: "loanNo",
                    as: "paymentData",
                },
            },
            {
                $unwind: "$paymentData",
            },
            {
                $project: {
                    _id: 0,
                    pan: 1,
                    loanNo: 1,
                    sanctionAmount: "$sanctionData.loanRecommended",
                    requestedStatus: 1,
                    isSettled: 1,
                    isWriteOff: 1,
                    defaulted: 1,
                    leadNo: "$leadData.leadNo",
                    fName: "$leadData.fName",
                    mName: "$leadData.mName",
                    lName: "$leadData.lName",
                    gender: "$leadData.gender",
                    dob: "$leadData.dob",
                    mobile: "$leadData.mobile",
                    email: "$leadData.personalEmail",
                    state: "$leadData.state",
                    city: "$leadData.city",
                    totalReceivedAmount: "$paymentData.totalReceivedAmount",
                },
            },
        ];

        const closedList = await Close.aggregate(pipeline);

        return res
            .status(200)
            .json({ message: "Closed List get sucessfully", closedList });
    }
    return res
        .status(400)
        .json({ message: "You are not authorized to access this resource" });
});

// collection executive allocate collectionlead
export const allocate = asyncHandler(async (req, res) => {
    const { collectionId } = req.params;

    let collectionExecutiveId;
    if (req.activeRole === "collectionExecutive") {
        collectionExecutiveId = req.employee._id.toString(); // Current user is a screener
    }

    const collection = await Collection.findByIdAndUpdate(
        collectionId,
        { collectionExecutiveId: collectionExecutiveId },
        { new: true }
    );
    if (!collection) {
        return res.status(400).json({ message: "collection not found" });
    }

    const employee = await Employee.findById(collectionExecutiveId);

    const lead = await Lead.findOne({ leadNo: collection.leadNo });
    await LeadStatus.findOneAndUpdate(
        {
            leadNo: lead.leadNo,
        },
        {
            stage: "COLLECTION",
            subStage: "LEAD ALLOCATED BY COLLECTION EXECUTIVE",
        }
    );
    const logs = await postLogs(
        lead._id,
        "LEAD ALLOCATED BY COLLECTION EXECUTIVE",
        `${lead.fName} ${lead.mName ?? ""} ${lead.lName}`,
        `Lead allocated to ${employee.fName} ${employee.lName}`
    );

    return res
        .status(200)
        .json({ message: "Collection allocated sucessfully", collection });
});

// list of  allocated collectionLead by a  collection executive
export const getAllocatedList = asyncHandler(async (req, res) => {
    let collectionExecutiveId = req.employee._id.toString();

    let query;
    if (
        req.activeRole === "collectionExecutive" ||
        req.activeRole === "collectionHead"
    ) {
        query = {
            collectionExecutiveId: new mongoose.Types.ObjectId(
                collectionExecutiveId
            ),
        };
    } else if (req.activeRole === "admin") {
        query = {};
    }
    console.log("collectionExecutive");

    const pipeline = [
        ...(Object.keys(query).length ? [{ $match: query }] : []),
        {
            $lookup: {
                from: "closes",
                localField: "close",
                foreignField: "_id",
                as: "closedDetails",
            },
        },
        {
            $unwind: "$closedDetails",
        },
        {
            $match: {
                "closedDetails.isActive": true,
                "closedDetails.isClosed": false,
                "closedDetails.isDisbursed": true,
            },
        },
        {
            $lookup: {
                from: "leads",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "leadDetails",
            },
        },
        {
            $unwind: "$leadDetails",
        },
        {
            $lookup: {
                from: "disbursals",
                localField: "disbursal",
                foreignField: "_id",
                as: "disbursalDetails",
            },
        },
        {
            $unwind: "$disbursalDetails",
        },
        {
            $lookup: {
                from: "employees",
                localField: "disbursalDetails.disbursedBy",
                foreignField: "_id",
                as: "employeeDetails",
            },
        },
        {
            $unwind: "$employeeDetails",
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
            $match: {
                "camDetails.repaymentAmount": { $gt: 0 },
            },
        },
        {
            $project: {
                _id: 1,
                disbursedBy: {
                    $concat: [
                        "$employeeDetails.fName",
                        " ",
                        "$employeeDetails.lName",
                    ],
                },
                sanctionAmount: "$camDetails.loanRecommended",
                fName: "$leadDetails.fName",
                mName: "$leadDetails.mName",
                lName: "$leadDetails.lName",
                gender: "$leadDetails.gender",
                dob: "$leadDetails.dob",
                aadhaar: "$leadDetails.aadhaar",
                pan: "$leadDetails.pan",
                mobile: "$leadDetails.mobile",
                personalEmail: "$leadDetails.personalEmail",
                state: "$leadDetails.state",
                city: "$leadDetails.city",
                salary: "$leadDetails.salary",
                leadNo: "$leadDetails.leadNo",
                loanNo: 1,
            },
        },
    ];
    const collectionList = await Collection.aggregate(pipeline);
    return res
        .status(200)
        .json({ message: "Collection List get sucessfully", collectionList });

    return res
        .status(400)
        .json({ message: "You are not authorized to access this resource" });
});

export const preActiveLeads = asyncHandler(async (req, res) => {
    if (
        req.activeRole === "collectionExecutive" || req.activeRole === "collectionHead"||
        req.activeRole === "admin"
    ) {
        const pipeline = [
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
                $match: {
                    $expr: {
                        $and: [
                            {
                                $gte: [
                                    {
                                        $divide: [
                                            {
                                                $subtract: [
                                                    "$$NOW",
                                                    "$camDetails.repaymentDate",
                                                ],
                                            },
                                            86400000,
                                        ],
                                    },
                                    -5,
                                ],
                            },
                            {
                                $lte: [
                                    {
                                        $divide: [
                                            {
                                                $subtract: [
                                                    "$$NOW",
                                                    "$camDetails.repaymentDate",
                                                ],
                                            },
                                            86400000,
                                        ],
                                    },
                                    5,
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $match: {
                    collectionExecutiveId: {
                        $exists: false,
                    },
                    preCollectionExecutiveId: {
                        $exists: false,
                    },
                },
            },
            {
                $lookup: {
                    from: "closes",
                    localField: "close",
                    foreignField: "_id",
                    as: "closedDetails",
                },
            },
            {
                $unwind: "$closedDetails",
            },
            {
                $match: {
                    "closedDetails.isActive": true,
                    "closedDetails.isClosed": false,
                    // "closedDetails.isDisbursed": true,
                },
            },
            {
                $lookup: {
                    from: "leads",
                    localField: "leadNo",
                    foreignField: "leadNo",
                    as: "leadDetails",
                },
            },
            {
                $unwind: "$leadDetails",
            },
            {
                $lookup: {
                    from: "disbursals",
                    localField: "disbursal",
                    foreignField: "_id",
                    as: "disbursalDetails",
                },
            },
            {
                $unwind: "$disbursalDetails",
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "disbursalDetails.disbursedBy",
                    foreignField: "_id",
                    as: "employeeDetails",
                },
            },
            {
                $unwind: "$employeeDetails",
            },
            {
                $sort: { "camDetails.repaymentDate": -1 },
            },
            {
                $project: {
                    _id: 1,
                    disbursedBy: {
                        $concat: [
                            "$employeeDetails.fName",
                            " ",
                            "$employeeDetails.lName",
                        ],
                    },
                    sanctionAmount: "$camDetails.loanRecommended",
                    fName: "$leadDetails.fName",
                    mName: "$leadDetails.mName",
                    lName: "$leadDetails.lName",
                    gender: "$leadDetails.gender",
                    dob: "$leadDetails.dob",
                    aadhaar: "$leadDetails.aadhaar",
                    pan: "$leadDetails.pan",
                    mobile: "$leadDetails.mobile",
                    personalEmail: "$leadDetails.personalEmail",
                    state: "$leadDetails.state",
                    city: "$leadDetails.city",
                    salary: "$leadDetails.salary",
                    leadNo: "$leadDetails.leadNo",
                    loanNo: 1,
                    repaymentDate: "$camDetails.repaymentDate",
                    disbursalDate: "$camDetails.disbursalDate",
                },
            },
        ];

        const activeLeads = await Collection.aggregate(pipeline);
        const totalActiveLeads = Number(activeLeads.length);
        res.json({
            totalActiveLeads,
            // totalPages: Math.ceil(totalActiveLeads / limit),
            // currentPage: page,
            activeLeads,
        });
    }
});

export const preAllocate = asyncHandler(async (req, res) => {
    const { collectionId } = req.params;

    let collectionExecutiveId;
    if (req.activeRole === "collectionExecutive") {
        collectionExecutiveId = req.employee._id.toString(); // Current user is a screener
    }

    const collection = await Collection.findByIdAndUpdate(
        collectionId,
        { preCollectionExecutiveId: collectionExecutiveId },
        { new: true }
    );
    if (!collection) {
        return res.status(400).json({ message: "collection not found" });
    }

    const employee = await Employee.findById(collectionExecutiveId);

    const lead = await Lead.findOne({ leadNo: collection.leadNo });
    await LeadStatus.findOneAndUpdate(
        {
            leadNo: lead.leadNo,
        },
        {
            stage: "COLLECTION",
            subStage:
                "LEAD ALLOCATED TO COLLECTION EXECUTIVE IN PRE-COLLECTION",
        }
    );
    const logs = await postLogs(
        lead._id,
        "LEAD ALLOCATED TO COLLECTION EXECUTIVE IN PRE-COLLECTION",
        `${lead.fName} ${lead.mName ?? ""} ${lead.lName}`,
        `Lead allocated to ${employee.fName} ${employee.lName}`
    );

    return res
        .status(200)
        .json({ message: "Collection allocated sucessfully", collection });
});

export const getPreAllocatedList = asyncHandler(async (req, res) => {
    console.log("collectionExecutive");
    if (
        req.activeRole === "collectionExecutive" ||
        req.activeRole === "collectionHead" ||
        req.activeRole === "admin"
    ) {
        let preCollectionExecutiveId = req.employee._id.toString();

        const pipeline = [
            {
                $match: {
                    preCollectionExecutiveId: new mongoose.Types.ObjectId(
                        preCollectionExecutiveId
                    ),
                },
            },
            {
                $lookup: {
                    from: "closes",
                    localField: "close",
                    foreignField: "_id",
                    as: "closedDetails",
                },
            },
            {
                $unwind: "$closedDetails",
            },
            {
                $match: {
                    "closedDetails.isActive": true,
                    "closedDetails.isClosed": false,
                    "closedDetails.isDisbursed": true,
                },
            },
            {
                $lookup: {
                    from: "leads",
                    localField: "leadNo",
                    foreignField: "leadNo",
                    as: "leadDetails",
                },
            },
            {
                $unwind: "$leadDetails",
            },
            {
                $lookup: {
                    from: "disbursals",
                    localField: "disbursal",
                    foreignField: "_id",
                    as: "disbursalDetails",
                },
            },
            {
                $unwind: "$disbursalDetails",
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "disbursalDetails.disbursedBy",
                    foreignField: "_id",
                    as: "employeeDetails",
                },
            },
            {
                $unwind: "$employeeDetails",
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
                $match: {
                    "camDetails.repaymentAmount": { $gt: 0 },
                },
            },
            {
                $project: {
                    _id: 1,
                    disbursedBy: {
                        $concat: [
                            "$employeeDetails.fName",
                            " ",
                            "$employeeDetails.lName",
                        ],
                    },
                    sanctionAmount: "$camDetails.loanRecommended",
                    fName: "$leadDetails.fName",
                    mName: "$leadDetails.mName",
                    lName: "$leadDetails.lName",
                    gender: "$leadDetails.gender",
                    dob: "$leadDetails.dob",
                    aadhaar: "$leadDetails.aadhaar",
                    pan: "$leadDetails.pan",
                    mobile: "$leadDetails.mobile",
                    personalEmail: "$leadDetails.personalEmail",
                    state: "$leadDetails.state",
                    city: "$leadDetails.city",
                    salary: "$leadDetails.salary",
                    leadNo: "$leadDetails.leadNo",
                    loanNo: 1,
                },
            },
        ];
        const collectionList = await Collection.aggregate(pipeline);
        return res.status(200).json({
            message: "Collection List get sucessfully",
            collectionList,
        });
    }
    return res
        .status(400)
        .json({ message: "You are not authorized to access this resource" });
});
