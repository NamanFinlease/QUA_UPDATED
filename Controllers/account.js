import asyncHandler from "../middleware/asyncHandler.js";
import { sessionAsyncHandler } from "../middleware/sessionAsyncHandler.js";
import Closed from "../models/Closed.js";
import Collection from "../models/Collection.js";
import Employee from "../models/Employees.js";
import Lead from "../models/Leads.js";
import LeadStatus from "../models/LeadStatus.js";
import Payment from "../models/Payment.js";
import { calculateReceivedPayment } from "../utils/calculateReceivedPayment.js";
import { verifyPaymentCalculation } from "../utils/verifyPaymentCalculation.js";
import { postLogs } from "./logs.js";

// @desc Get all the updated Active leads to verify
// @route GET /api/accounts/active/verify
// @access Private
export const activeLeadsToVerify = asyncHandler(async (req, res) => {
    if (
        req.activeRole === "accountExecutive" ||
        req.activeRole === "collectionExecutive"
    ) {
        // const page = parseInt(req.query.page) || 1; // current page
        // const limit = parseInt(req.query.limit) || 10; // items per page
        // const skip = (page - 1) * limit;

        const pipeline = [
            {
                $match: {
                    data: {
                        $elemMatch: {
                            isActive: true,
                            isDisbursed: true,
                            isVerified: false,
                            isClosed: false,
                            $or: [
                                { date: { $exists: true, $ne: null } },
                                { amount: { $exists: true, $ne: 0 } },
                                { utr: { $exists: true, $ne: 0 } },
                                {
                                    partialPaid: {
                                        $elemMatch: {
                                            date: { $exists: true, $ne: null },
                                            amount: { $exists: true, $gt: 0 },
                                            utr: { $exists: true },
                                            isPartlyPaid: { $ne: true },
                                        },
                                    },
                                },
                                {
                                    requestedStatus: {
                                        $exists: true,
                                        $ne: null,
                                    },
                                },
                                { dpd: { $exists: true, $gt: 0 } },
                            ],
                        },
                    },
                },
            },
            {
                $project: {
                    data: {
                        $filter: {
                            input: "$data",
                            as: "item",
                            cond: {
                                $and: [
                                    { $eq: ["$$item.isActive", true] },
                                    { $eq: ["$$item.isDisbursed", true] },
                                    { $eq: ["$$item.isVerified", false] },
                                    { $eq: ["$$item.isClosed", false] },
                                ],
                            },
                        },
                    },
                },
            },
            {
                $addFields: {
                    data: { $arrayElemAt: ["$data", 0] },
                },
            },
            {
                $match: {
                    data: { $ne: null }, // Ensures that we only return documents with at least one matching data entry
                },
            },
            {
                $sort: {
                    updatedAt: -1,
                },
            },
        ];

        const results = await Closed.aggregate(pipeline).sort({
            updatedAt: -1,
        });

        // Populate the filtered data
        const leadsToVerify = await Closed.populate(results, {
            path: "data.disbursal",
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

        const totalActiveLeadsToVerify = await Closed.countDocuments({
            "data.isActive": true,
            "data.isDisbursed": true,
            "data.isVerified": false,
            "data.isClosed": false,
            $or: [
                { "data.closingDate": { $exists: true, $ne: null } },
                { "data.closingAmount": { $exists: true, $ne: 0 } },
                {
                    "data.partialPaid": {
                        $elemMatch: {
                            date: { $exists: true, $ne: null },
                            amount: { $exists: true, $gt: 0 },
                        },
                    },
                },
                { "data.requestedStatus": { $exists: true, $ne: null } },
                { "data.dpd": { $exists: true, $gt: 0 } },
            ],
        });

        res.json({
            totalActiveLeadsToVerify,
            // totalPages: Math.ceil(totalActiveLeadsToVerify / limit),
            // currentPage: page,
            leadsToVerify,
        });
    }
});

// @desc Verify the active lead if the payment is received and change its status
// @route PATCH /api/accounts/active/verify/:loanNo
// @access Private
export const verifyPayment = sessionAsyncHandler(async (req, res, session) => {
    if (req.activeRole === "accountExecutive" || req.activeRole === "accountHead") {
        const { loanNo } = req.params;
        const { accountRemarks } = req.body
        let accountEmpId = req.employee._id.toString();
        const { transactionId } = req.query
       

        const updatedPayment = await verifyPaymentCalculation(loanNo, transactionId, accountRemarks, accountEmpId, session)
        if (!updatedPayment) {
            // await session.abortTransaction();
            throw new Error("Payment didn't update")
            // return res.status(400).json({ error: `Payment didn't update` });
        }
        const collectionData = await Collection.findOne({ loanNo: loanNo }, null, { session })
        const lead = await Lead.findOne({ leadNo: collectionData.leadNo },  null, { session })
        const employee = await Employee.findById(accountEmpId , null, { session })

        // update leadStatus 
        await LeadStatus.findOneAndUpdate({
            leadNo: lead.leadNo
        },
            {
                stage: "ACCOUNTS",
                subStage: "ACCOUNTS IN PROCESS"
            },
            { session }
        )
        await postLogs(
            lead._id,
            "VERIFY PAYMENT BY ACCOUNTS",
            `${lead.fName}${lead.mName && ` ${lead.mName}`}${lead.lName && ` ${lead.lName}`
            }`,
            `Payment Verfied by ${employee.fName} ${employee.lName}`,
            `${accountRemarks}`,
            session
        );
        res.json({ message: "Payment verified", updatedPayment })


    }
});

// @desc Reject the payment verification if the payment is not received and remove the requested status
// @route PATCH /api/accounts/active/verify/reject/:loanNo
// @access Private
// export const rejectPaymentVerification1 = asyncHandler(async (req, res) => {
//     if (req.activeRole === "accountExecutive") {
//         const { loanNo } = req.params;
//         const { utr } = req.body;

//         // Find the document containing the specific loanNo in the `data` array
//         const activeRecord = await Closed.findOne(
//             {
//                 "data.loanNo": loanNo,
//                 $or: [{ "data.utr": utr }, { "data.partialPaid.utr": utr }],
//             },
//             {
//                 pan: 1, // Include only necessary fields
//                 "data.partialPaid": 1, // Return only the partialPaid array
//                 "data.loanNo": 1,
//                 // data: { $elemMatch: { loanNo: loanNo } }, // Fetch only the matched data entry
//             }
//         ).populate({
//             path: "data.disbursal",
//             populate: {
//                 path: "sanction", // Populating the 'sanction' field in Disbursal
//                 populate: [
//                     { path: "approvedBy" },
//                     {
//                         path: "application",
//                         populate: [
//                             { path: "lead", populate: { path: "documents" } }, // Nested populate for lead and documents
//                             { path: "creditManagerId" }, // Populate creditManagerId
//                             { path: "recommendedBy" },
//                         ],
//                     },
//                 ],
//             },
//         });

//         if (!activeRecord || !activeRecord.data?.length) {
//             res.status(404);
//             throw new Error({
//                 success: false,
//                 message: "Loan number not found.",
//             });
//         }

//         // Remove the `requestedStatus` field
//         await Closed.updateOne(
//             { "data.loanNo": loanNo },
//             { $unset: { "data.$.requestedStatus": "" } } // Use positional operator to unset the field
//         );

//         // Send a success response
//         return res.json({
//             success: true,
//             message: `Record updated successfully. Requested status has been removed.`,
//         });
//     }
// });


//   pending payment verification for a particular loanNo 
export const getPendingPaymentVerification = asyncHandler(async (req, res) => {
    const { loanNo } = req.params
    if (!loanNo) {
        return res.status(400).json({ message: "Loan number is required" })
    }

    if (req.activeRole === "collectionExecutive" || req.activeRole === "collectionHead" || req.activeRole === "accountExecutive" || req.activeRole === "accountHead"|| req.activeRole === "admin") {

        const pipeline = [
            {
                $match: { loanNo: loanNo }
            },
            { $unwind: "$paymentHistory" },


            {
                $project: {
                    _id: 1,
                    loanNo: 1,
                    pan: 1,
                    paymentHistory: "$paymentHistory"
                }
            }
        ]

        const paymentList = await Payment.aggregate(pipeline)

        return res.status(200).json({ message: "Payment List fetched sucessfully", paymentList })
    }
    return res.status(400).json({ message: "You are not authorized" })

})

// @desc Reject the payment verification if the payment is not received and remove the requested status
export const rejectPaymentVerification = asyncHandler(async (req, res) => {
    if (req.activeRole === "accountExecutive" || req.activeRole === "accountHead") {
        const { transactionId , accountRemarks } = req.body;
        let accountEmpId = req.employee._id.toString();

        // Find the payment record based on loanNo and transactionId
        const paymentRecord = await Payment.findOne(
            {
                "paymentHistory.transactionId": transactionId,
            },
            {
                pan: 1,
                leadNo: 1,
                loanNo: 1,
                paymentHistory: 1,
            }
        );

        if (!paymentRecord || !paymentRecord.paymentHistory?.length) {
            res.status(400).json({
                message: "Loan number not found.",
            });
        }

        // Unset `paymentUpdateRequest` for the specific transaction in paymentHistory
        const paymentDetails = await Payment.findOneAndUpdate(
            {
                "paymentHistory.transactionId": transactionId,
            },
            {
                "paymentHistory.paymentUpdateRequest": false,
                "paymentHistory.isRejected": true,
                "paymentHistory.isPaymentVerified": true
            }
        );

        console.log("PaymentDetails-->", paymentDetails)

        const employee = await Employee.findById(accountEmpId)

        // update leadStatus 
        const lead = await Lead.findOne({ leadNo: paymentRecord.leadNo })
        await LeadStatus.findOneAndUpdate({
            leadNo: lead.leadNo
        },
            {
                stage: "ACCOUNTS",
                subStage: "ACCOUNTS IN PROCESS"
            },
        )
        await postLogs(
            lead._id,
            "REJECT PAYMENT BY ACCOUNTS",
            `${lead.fName}${lead.mName && ` ${lead.mName}`}${lead.lName && ` ${lead.lName}`
            }`,
            `Payment Rejected by ${employee.fName} ${employee.lName}`,
            `${accountRemarks}`,
            );
        // Send a success response
        return res.json({
            success: true,
            message: `Payment record updated successfully. Payment update request has been removed.`,
        });
    }
});


// for pending verification bucket
export const getPendingPaymentVerificationList = asyncHandler(async (req, res) => {
    if (req.activeRole === "accountExecutive"
        || req.activeRole === "accountHead"
        || req.activeRole === "collectionExecutive"
        || req.activeRole === "collectionHead"
        || req.activeRole === "admin"

    ) {
        const pipeline = [
            { $unwind: "$paymentHistory" },
            {
                $match: {
                    "paymentHistory.isPaymentVerified": false
                }
            },
            {
                $lookup: {
                    from: "leads",
                    localField: "leadNo",
                    foreignField: "leadNo",
                    as: "leadDetails"
                }
            },
            { $unwind: "$leadDetails" },

            {
                $project: {
                    _id: 1,
                    loanNo: 1,
                    pan: 1,
                    receivedAmount: "$paymentHistory.receivedAmount",
                    paymentDate: "$paymentHistory.paymentDate",
                    transactionId: "$paymentHistory.transactionId",
                    fName: "$leadDetails.fName",
                    mName: "$leadDetails.mName",
                    lName: "$leadDetails.lName",
                    email: "$leadDetails.personalEmail",
                    mobile: "$leadDetails.mobile"
                }
            }
        ];

        const paymentList = await Payment.aggregate(pipeline)

        return res.status(200).json({ message: "Payment List get sucessfully", paymentList })
    }
    return res.status(400).json({ message: "You are not authorized" })

})