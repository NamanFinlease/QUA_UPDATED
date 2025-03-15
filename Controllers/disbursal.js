import asyncHandler from "../middleware/asyncHandler.js";
import Admin from "../models/Admin.js";
import Bank from "../models/ApplicantBankDetails.js";
import CamDetails from "../models/CAM.js";
import Closed from "../models/Closed.js";
import Disbursal from "../models/Disbursal.js";
// import {
//     exportNewDisbursals,
//     exportDisbursedData,
// } from "../utils/dataChange.js";
import { exportNewDisbursals } from "../utils/MIS/disbursal/NewDisbursal.js";
import { exportDisbursedData } from "../utils/MIS/disbursal/Disbursed.js";
import { postLogs } from "./logs.js";
import generateHashCode from "../utils/generateHash.js";
import Lead from "../models/Leads.js";
import {
    createBeneficiary,
    createPayout,
    fetchPayout,
} from "../utils/payOutPG.js";
import generateReceiptId from "../utils/receiptIDgenerator.js";
import LeadStatus from "../models/LeadStatus.js";
import Collection from "../models/Collection.js";
import Payment from "../models/Payment.js";
import mongoose from "mongoose";
import LoanApplication from "../models/User/model.loanApplication.js";
import { sessionAsyncHandler } from "../middleware/sessionAsyncHandler.js";
import Close from "../models/close.js";

// @desc Get new disbursal
// @route GET /api/disbursals/
// @access Private
export const getNewDisbursal = asyncHandler(async (req, res) => {
    if (
        req.activeRole === "disbursalManager" ||
        req.activeRole === "disbursalHead" ||
        req.activeRole === "admin"
    ) {
        const page = parseInt(req.query.page); // current page
        const limit = parseInt(req.query.limit); // items per page
        const skip = (page - 1) * limit;

        const query = {
            disbursalManagerId: null,
            isRecommended: { $ne: true },
            isApproved: { $ne: true },
            sanctionESigned: { $eq: true },
        };

        // const disbursals = await Disbursal.find(query)
        //     .sort({ updatedAt: -1 })
        //     .skip(skip)
        //     .limit(limit)
        //     .populate({
        //         path: "sanction", // Populating the 'sanction' field in Disbursal
        //         populate: {
        //             path: "application", // Inside 'sanction', populate the 'application' field
        //             populate: {
        //                 path: "lead", // Inside 'application', populate the 'lead' field
        //             },
        //         },
        //     });

        let pipeline = [
            {
                $match: {
                    disbursalManagerId: null,
                    isRecommended: { $ne: true },
                    isApproved: { $ne: true },
                    sanctionESigned: true,
                },
            },
            {
                $sort: { updatedAt: -1 }, // Sort by updatedAt in descending order
            },

            // {
            //     $skip: skip
            // },
            // {
            //     $limit: limit
            // },

            {
                $lookup: {
                    from: "sanctions", // Reference to the 'sanctions' collection
                    localField: "sanction",
                    foreignField: "_id",
                    as: "sanctionData",
                },
            },
            {
                $unwind: {
                    path: "$sanctionData",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "applications",
                    localField: "sanctionData.application",
                    foreignField: "_id",
                    as: "applicationData",
                },
            },
            {
                $unwind: {
                    path: "$applicationData",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "leads",
                    localField: "applicationData.lead",
                    foreignField: "_id",
                    as: "leadData",
                },
            },
            {
                $unwind: {
                    path: "$leadData",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "camdetails",
                    localField: "leadData._id",
                    foreignField: "leadId",
                    as: "camData",
                },
            },
            {
                $unwind: {
                    path: "$camData",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    loanNo: 1,
                    fName: "$leadData.fName",
                    mName: "$leadData.mName",
                    lName: "$leadData.lName",
                    pan: "$leadData.pan",
                    aadhaar: "$leadData.aadhaar",
                    mobile: "$leadData.mobile",
                    leadNo: "$leadData.leadNo",
                    source: "$leadData.source",
                    city: "$leadData.city",
                    state: "$leadData.state",
                    loanRecommended: "$camData.loanRecommended",
                    actualNetSalary: "$camData.actualNetSalary",
                },
            },
        ];

        const disbursals = await Disbursal.aggregate(pipeline);

        const totalDisbursals = await Disbursal.countDocuments(query);

        return res.json({
            totalDisbursals,
            totalPages: Math.ceil(totalDisbursals / limit),
            currentPage: page,
            disbursals,
        });
    }
});

// @desc Get Disbursal
// @route GET /api/disbursals/:id
// @access Private
export const getDisbursal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const disbursal = await Disbursal.findOne({ _id: id })
        .populate([
            {
                path: "sanction", // Populating the 'sanction' field in Disbursal
                populate: [
                    { path: "recommendedBy", select: "fName mName lName" }, // Populate 'approvedBy' inside 'sanction'
                    { path: "approvedBy", select: "fName mName lName" },
                    {
                        path: "application", // Populate 'application' inside 'sanction'
                        populate: [
                            { path: "lead", populate: { path: "documents" } }, // Populate 'lead' inside 'application'
                            { path: "creditManagerId" }, // Populate 'creditManagerId' inside 'application'
                        ],
                    },
                ],
            },
        ])
        .populate("disbursedBy");

    if (!disbursal) {
        res.status(404);
        throw new Error("Disbursal not found!!!!");
    }

    // Convert disbursal to a plain object to make it mutable
    const disbursalObj = disbursal.toObject();

    // Fetch the CAM data and add to disbursalObj
    const cam = await CamDetails.findOne({
        leadId: disbursal?.sanction?.application.lead._id,
    });
    disbursalObj.sanction.application.cam = cam ? { ...cam.toObject() } : null;

    // Fetch banks from Admin model and add to disbursalObj
    const admin = await Admin.findOne();
    disbursalObj.disbursalBanks = admin ? admin.bank : [];

    return res.json({ disbursal: disbursalObj });
});

// @desc Allocate new disbursal
// @route PATCH /api/disbursals/:id
// @access Private
export const allocateDisbursal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let disbursalManagerId;

    if (req.activeRole === "disbursalManager") {
        disbursalManagerId = req.employee._id.toString();
    }

    const disbursal = await Disbursal.findByIdAndUpdate(
        id,
        { disbursalManagerId },
        { new: true }
    ).populate({
        path: "sanction", // Populating the 'sanction' field in Disbursal
        populate: [
            { path: "approvedBy" },
            {
                path: "application",
                populate: [
                    { path: "lead", populate: { path: "documents" } }, // Nested populate for lead and documents
                    { path: "recommendedBy" },
                ],
            },
        ],
    });

    if (!disbursal) {
        throw new Error("Application not found"); // This error will be caught by the error handler
    }

    // update leadStatus
    await LeadStatus.findOneAndUpdate(
        {
            leadNo: disbursal.leadNo,
        },
        {
            stage: "DISBURSAL",
            subStage: "DISBURSAL IN PROCESS",
        }
    );
    const logs = await postLogs(
        disbursal?.sanction?.application.lead._id,
        "DISBURSAL IN PROCESS",
        `${disbursal?.sanction?.application.lead.fName}${
            disbursal?.sanction?.application.lead.mName &&
            ` ${disbursal?.sanction?.application.lead.mName}`
        } ${disbursal?.sanction?.application.lead.lName}`,
        `Disbursal application approved by ${req.employee.fName} ${req.employee.lName}`
    );

    // update user Status
    if (disbursal.sanction.application.lead.userId) {
        const userResult = await LoanApplication.findOneAndUpdate(
            {
                leadNo: disbursal.leadNo,
            },
            {
                sanction: "SUCCESS",
            }
        );
        console.log("user status----> allocate disbursal", userResult);
    }

    // Send the updated lead as a JSON response
    return res.json({ disbursal, logs }); // This is a successful response
});

// @desc Get Allocated Disbursal depends on whether if it's admin or a Disbursal Manager.
// @route GET /api/disbursal/allocated
// @access Private
export const allocatedDisbursal = asyncHandler(async (req, res) => {
    let query;
    if (req.activeRole === "admin" || req.activeRole === "disbursalHead") {
        query = {
            disbursalManagerId: {
                $ne: null,
            },
            isRecommended: { $ne: true },
            isRejected: { $ne: true },
            onHold: { $ne: true },
            isApproved: { $ne: true },
        };
    } else if (req.activeRole === "disbursalManager") {
        query = {
            disbursalManagerId: req.employee.id,
            isRecommended: { $ne: true },
            isRejected: { $ne: true },
            onHold: { $ne: true },
        };
    } else {
        res.status(401);
        throw new Error("Not authorized!!!");
    }
    const page = parseInt(req.query.page); // current page
    const limit = parseInt(req.query.limit); // items per page
    const skip = (page - 1) * limit;
    const disbursals = await Disbursal.find(query)
        .skip(skip)
        .limit(limit)
        .populate({
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
        })
        .populate({
            path: "disbursalManagerId",
            select: "fName mName lName",
        })
        .sort({ updatedAt: -1 });

    const totalDisbursals = await Disbursal.countDocuments(query);

    return res.json({
        totalDisbursals,
        totalPages: Math.ceil(totalDisbursals / limit),
        currentPage: page,
        disbursals,
    });
});

// @desc Recommend a disbursal application
// @route PATCH /api/disbursals/recommend/:id
// @access Private
export const recommendDisbursal = asyncHandler(async (req, res) => {
    if (req.activeRole === "disbursalManager") {
        const { id } = req.params;
        const { remarks } = req.body;

        // Find the application by its ID
        const disbursal = await Disbursal.findById(id)
            .populate({
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
            })
            .populate({
                path: "disbursalManagerId",
                select: "fName mName lName",
            });

        disbursal.isRecommended = true;
        disbursal.recommendedBy = req.employee._id.toString();
        await disbursal.save();

        await LeadStatus.findOneAndUpdate(
            {
                leadNo: disbursal.leadNo,
            },
            {
                stage: "DISBURSAL",
                subStage:
                    "DISBURSAL APPLICATION RECOMMENDED. SENDING TO DISBURSAL HEAD",
            }
        );
        const logs = await postLogs(
            disbursal.sanction.application.lead._id,
            "DISBURSAL APPLICATION RECOMMENDED. SENDING TO DISBURSAL HEAD",
            `${disbursal.sanction.application.lead.fName}${
                disbursal.sanction.application.lead.mName &&
                ` ${disbursal.sanction.application.lead.mName}`
            } ${disbursal.sanction.application.lead.lName}`,
            `Disbursal approved by ${req.employee.fName} ${req.employee.lName}`,
            `${remarks}`
        );

        return res.json({ success: true, logs });
    }
});

// @desc Get all the pending disbursal applications
// @route GET /api/disbursals/pending
// @access Private
export const disbursalPending = asyncHandler(async (req, res) => {
    if (
        req.activeRole === "disbursalManager" ||
        req.activeRole === "disbursalHead" ||
        req.activeRole === "admin"
    ) {
        const page = parseInt(req.query.page); // current page
        const limit = parseInt(req.query.limit); // items per page
        const skip = (page - 1) * limit;

        const query = {
            disbursalManagerId: { $ne: null },
            isRecommended: { $eq: true },
            onHold: { $ne: true },
            isRejected: { $ne: true },
            isDisbursed: { $ne: true },
        };

        const disbursals = await Disbursal.find(query)
            .skip(skip)
            .limit(limit)
            .populate({
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
            })
            .populate("disbursalManagerId");

        const totalDisbursals = await Disbursal.countDocuments(query);

        return res.json({
            totalDisbursals,
            totalPages: Math.ceil(totalDisbursals / limit),
            currentPage: page,
            disbursals,
        });
    } else {
        res.status(401);
        throw new Error("You are not authorized to check this data");
    }
});

// @desc Adding details after the payment is made
// @route PATCH /api/disbursals/approve/:id
// @access Private
export const approveDisbursal = sessionAsyncHandler(
    async (req, res, session) => {
        if (req.activeRole === "disbursalHead") {
            const { id } = req.params;

            const {
                payableAccount,
                paymentMode,
                amount,
                channel,
                disbursalDate,
                remarks,
            } = req.body;

            const disbursalData = await Disbursal.findById(id)
                .populate({
                    path: "sanction",
                    populate: { path: "application" },
                })
                .session(session);
            const cam = await CamDetails.findOne({
                leadId: disbursalData?.sanction?.application?.lead.toString(),
            }).session(session);
            // if()
            let currentDisbursalDate = new Date(disbursalDate);
            let camDisbursalDate = new Date(cam.disbursalDate);
            let camRepaymentDate = new Date(cam.repaymentDate);
            if (
                camDisbursalDate.toLocaleDateString() !==
                currentDisbursalDate.toLocaleDateString()
            ) {
                const tenure = Math.ceil(
                    (camRepaymentDate.getTime() -
                        currentDisbursalDate.getTime()) /
                        (1000 * 3600 * 24)
                );
                const repaymentAmount =
                    Number(cam.loanRecommended) +
                    (Number(cam.loanRecommended) *
                        Number(tenure) *
                        Number(cam.roi)) /
                        100;

                await CamDetails.findByIdAndUpdate(
                    cam._id,
                    {
                        eligibleTenure: tenure,
                        disbursalDate: currentDisbursalDate,
                        repaymentAmount: Number(repaymentAmount.toFixed(2)),
                    },
                    { new: true, session }
                );
            }

            const leadData = await Lead.findById(
                disbursalData?.sanction?.application?.lead.toString()
            ).session(session);
            if (!leadData) {
                throw new Error("Lead data not found");
            }
            // add paytring payout
            if (
                paymentMode.toLowerCase() === "online" &&
                channel.toLowerCase() === "imps"
            ) {
                console.log("I am in Paytrin payement");
                const isBankAccountPresent = await Bank.findOne({
                    bankAccNo: payableAccount,
                }).session(session);
                if (!isBankAccountPresent) {
                    return res.status(400).json({
                        message: "Please select valid Account Number",
                    });
                }

                console.log("lead data", leadData);
                const { fName, lName, mobile, personalEmail, city, state } =
                    leadData;
                const { ifscCode } = isBankAccountPresent;
                console.log("isBankAccountPresent-->", isBankAccountPresent);

                const hash = await generateHashCode(
                    payableAccount,
                    fName,
                    lName,
                    mobile,
                    personalEmail,
                    city,
                    state,
                    ifscCode
                );
                const beneficaryResponse = await createBeneficiary(
                    payableAccount,
                    fName,
                    lName,
                    mobile,
                    personalEmail,
                    city,
                    state,
                    ifscCode,
                    hash
                );
                console.log(beneficaryResponse, "beneficaryResponse-->");

                if (!beneficaryResponse || !beneficaryResponse.status) {
                    return res
                        .status(500)
                        .json({ message: "Issue in creating beneficiary" });
                }

                const receiptId = generateReceiptId();
                const payoutResponse = await createPayout(
                    amount,
                    payableAccount,
                    beneficaryResponse.beneficiary_id,
                    receiptId,
                    hash
                );
                console.log("payoutResponse", payoutResponse);
                if (!payoutResponse || !payoutResponse.status) {
                    return res
                        .status(500)
                        .json({ message: "Issue in creating payout" });
                }

                const fetchPayoutResponse = await fetchPayout(
                    payoutResponse.transfer_id,
                    hash
                );

                if (!fetchPayoutResponse || !fetchPayoutResponse.status) {
                    return res
                        .status(500)
                        .json({ message: "Issue in fetching payout" });
                }

                disbursalData.transactionHinstory = fetchPayoutResponse;
                await disbursalData.save({ session });
            }

            const disbursal = await Disbursal.findByIdAndUpdate(
                id,
                {
                    payableAccount,
                    paymentMode,
                    amount,
                    channel,
                    disbursedAt: disbursalDate,
                    utr: remarks,
                    isDisbursed: true,
                    disbursedBy: req.employee._id.toString(),
                },
                { new: true, session }
            ).populate({
                path: "sanction",
                populate: [
                    { path: "approvedBy" },
                    {
                        path: "application",
                        populate: [
                            { path: "lead", populate: { path: "documents" } }, // Nested populate for lead and documents
                            { path: "recommendedBy" },
                        ],
                    },
                ],
            });

            const objectId = new mongoose.Types.ObjectId(id);
            const closed = await Close.findOneAndUpdate(
                { disbursal: objectId }, // Find the document where data.disbursal matches
                {
                    $set: { isDisbursed: true }, // Use array filter reference
                },
                {
                    returnDocument: "after", // Return the updated document
                    session: session, // Include transaction session if needed
                }
            );

            console.log("close--->", closed);

            if (leadData.userId) {
                const userResult = await LoanApplication.findOneAndUpdate(
                    {
                        leadNo: leadData.leadNo,
                    },
                    {
                        disbursed: "SUCCESS",
                        loanNo: disbursalData?.loanNo ?? "",
                    },
                    { session }
                );
                console.log("userResult from disbursed ---->", userResult);
            }
            if (!leadData.userId) {
                console.log("-------> ID nhi mili h user ki");
            }

            // update lead stage
            await LeadStatus.findOneAndUpdate(
                {
                    leadNo: disbursal.leadNo,
                },
                {
                    stage: "DISBURSED",
                    subStage: "AMOUNT DISBURSED TO CUSTOMER.",
                },
                { session }
            );

            const updatedCAM = await CamDetails.findById(cam._id);

            // calculate outstanding amount for the day of disbursal
            let outstandingAmount =
                updatedCAM.loanRecommended +
                (updatedCAM.loanRecommended * updatedCAM.roi) / 100;
            let interest = outstandingAmount - updatedCAM.loanRecommended;
            // create collection  and payment document after  disbursed amount
            const collectionData = new Collection({
                pan: disbursal.pan,
                leadNo: disbursal.leadNo,
                loanNo: disbursal.loanNo,
                repaymentDate: updatedCAM.repaymentDate,
                penalRate: 2,
                principalAmount: Number(updatedCAM.loanRecommended.toFixed(2)),
                outstandingAmount: Number(outstandingAmount.toFixed(2)),
                interest: Number(interest.toFixed(2)),
                remainingAmount: Number(updatedCAM.loanRecommended),
                disbursal: disbursal._id,
                isDisbursed: true,
                camDetails: updatedCAM._id,
                close: closed._id,
            });
            await collectionData.save({ session });

            if (!collectionData) {
                return res
                    .status(400)
                    .json({ message: "Issue in creating collection document" });
            }

            const payment = new Payment({
                pan: collectionData.pan,
                leadNo: collectionData.leadNo,
                loanNo: collectionData.loanNo,
                repaymentDate: collectionData.repaymentDate,
            });
            await payment.save({ session });
            if (!payment) {
                return res
                    .status(400)
                    .json({ message: "Issue in creating payment document" });
            }

            await Collection.findByIdAndUpdate(
                collectionData._id,
                { payment: payment._id },
                { session }
            );

            const logs = await postLogs(
                disbursal.sanction.application.lead._id,
                "AMOUNT DISBURSED TO CUSTOMER.",
                `${disbursal.sanction.application.lead.fName}${
                    disbursal.sanction.application.lead.mName &&
                    ` ${disbursal.sanction.application.lead.mName}`
                } ${disbursal.sanction.application.lead.lName}`,
                `Amount Disbursed by ${req.employee.fName} ${req.employee.lName}`,
                `${remarks}`,
                session
            );

            res.json({ success: true, logs });
        }
    }
);

// @desc Get all the disbursed applications
// @route GET /api/disbursals/disbursed
// @access Private
export const disbursed = asyncHandler(async (req, res) => {
    if (req.activeRole === "disbursalHead" || req.activeRole === "admin") {
        const page = parseInt(req.query.page); // current page
        const limit = parseInt(req.query.limit); // items per page
        const skip = (page - 1) * limit;

        const query = {
            disbursalManagerId: { $ne: null },
            isDisbursed: { $eq: true },
        };

        const disbursals = await Disbursal.aggregate([
            { $match: query },
            {
                $project: {
                    loanNo: 1,
                    sanction: 1,
                    disbursedBy: 1,
                    updatedAt: 1,
                },
            }, // Direct projection, no need for $arrayElemAt

            // Lookup Sanction
            {
                $lookup: {
                    from: "sanctions",
                    localField: "sanction",
                    foreignField: "_id",
                    as: "sanction",
                    pipeline: [{ $project: { application: 1 } }],
                },
            },
            { $set: { sanction: { $arrayElemAt: ["$sanction", 0] } } },

            // Lookup Application
            {
                $lookup: {
                    from: "applications",
                    localField: "sanction.application",
                    foreignField: "_id",
                    as: "sanction.application",
                    pipeline: [{ $project: { lead: 1 } }],
                },
            },
            {
                $set: {
                    "sanction.application": {
                        $arrayElemAt: ["$sanction.application", 0],
                    },
                },
            },

            // Lookup Lead
            {
                $lookup: {
                    from: "leads",
                    localField: "sanction.application.lead",
                    foreignField: "_id",
                    as: "sanction.application.lead",
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
                            },
                        },
                    ],
                },
            },
            {
                $set: {
                    "sanction.application.lead": {
                        $arrayElemAt: ["$sanction.application.lead", 0],
                    },
                },
            },

            // Lookup CAM Details
            {
                $lookup: {
                    from: "camdetails",
                    localField: "sanction.application.lead._id", // Correctly resolved lead ID
                    foreignField: "leadId",
                    as: "camDetails",
                    pipeline: [
                        {
                            $project: {
                                _id: 0,
                                loanRecommended: "$loanRecommended",
                                actualNetSalary: "$actualNetSalary",
                            },
                        },
                    ],
                },
            },
            {
                $set: {
                    "sanction.camDetails": { $arrayElemAt: ["$camDetails", 0] },
                },
            },

            // Lookup DisbursedBy (Employee who processed the disbursal)
            {
                $lookup: {
                    from: "employees",
                    localField: "disbursedBy",
                    foreignField: "_id",
                    as: "disbursedBy",
                    pipeline: [{ $project: { fName: 1, lName: 1 } }],
                },
            },
            { $set: { disbursedBy: { $arrayElemAt: ["$disbursedBy", 0] } } },

            { $sort: { updatedAt: -1 } },
            // Final Projection
            {
                $project: {
                    updatedAt: 1,
                    "sanction.application.lead.fName": 1,
                    "sanction.application.lead.mName": 1,
                    "sanction.application.lead.lName": 1,
                    "sanction.application.lead.pan": 1,
                    "sanction.application.lead.mobile": 1,
                    loanNo: 1,
                    "sanction.application.lead.aadhaar": 1,
                    "sanction.application.lead.city": 1,
                    "sanction.application.lead.state": 1,
                    "sanction.camDetails.actualNetSalary": 1,
                    "sanction.camDetails.loanRecommended": 1,
                    "sanction.application.lead.source": 1,
                    "disbursedBy.fName": 1,
                    "disbursedBy.lName": 1,
                },
            },
        ]);

        const totalDisbursals = await Disbursal.countDocuments(query);

        return res.json({
            totalDisbursals,
            totalPages: Math.ceil(totalDisbursals / limit),
            currentPage: page,
            disbursals,
        });
    } else {
        res.status(401);
        throw new Error("You are not authorized to check this data");
    }
});

// @desc Get report of today's new Disbursal applications
// @route GET /api/disbursals/new/report
// @access Private
export const newDisbursalReport = asyncHandler(async (req, res) => {
    const data = await exportNewDisbursals();
    console.log("Data: ", data);
    return res.json({ data });
});

// @desc Get report of all disbursed applications
// @route GET /api/disbursals/disbursed/report
// @access Private
export const disbursedReport = asyncHandler(async (req, res) => {
    const data = await exportDisbursedData();
    if(!data) {
        res.status(400)
        throw new Error("Error in generating report")
    }
    // console.log("Data: ", data);
    return res.json({ data });
});
