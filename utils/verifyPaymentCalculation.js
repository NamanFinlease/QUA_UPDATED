import Close from "../models/close.js";
// import Closed from "../models/Closed.js";
import Collection from "../models/Collection.js";
import Payment from "../models/Payment.js";
import LoanApplication from "../models/User/model.loanApplication.js";
import { calculateReceivedPayment } from "./calculateReceivedPayment.js";
import Disbursal from "../models/Disbursal.js";
// import sendNocMail from "./sendNOC.js";
// import sendNocMail from "./sendNOC.JS";
import sendNocMail from "./sendEmailNoc.js";

export const verifyPaymentCalculation = async (
    loanNo,
    transactionId,
    closingType,
    accountRemarks = "",
    accountEmpId = null,
    session
) => {
    try {
        const collectionData = await Collection.aggregate([
            {
                $match: { loanNo },
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
                    path: "$paymentData",
                    preserveNullAndEmptyArrays: true, // Keeps collections even if no matching payment exists
                },
            },
            {
                $addFields: {
                    filteredPaymentHistory: {
                        $filter: {
                            input: "$paymentData.paymentHistory",
                            as: "history",
                            cond: {
                                $eq: ["$$history.transactionId", transactionId],
                            },
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "camdetails",
                    localField: "camDetails",
                    foreignField: "_id",
                    as: "camDetails",
                },
            },
            {
                $unwind: {
                    path: "$camDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    paymentData: 0,
                },
            },
        ]).session(session);

        if (!collectionData) {
            return false;
        }

        console.log("collectionData", collectionData);

        const calculatedAmount = calculateReceivedPayment(collectionData);

        if (!calculatedAmount) {
            return false;
        }
        let outstandingAmount =
            calculatedAmount.penalty +
            calculatedAmount.interest +
            calculatedAmount.principalAmount;
        if (outstandingAmount < 1) {
            calculatedAmount.principalDiscount += outstandingAmount;
        }

        let updatedPayment = await Payment.findOneAndUpdate(
            {
                loanNo,
                "paymentHistory.transactionId": transactionId,
            },
            {
                $set: {
                    "paymentHistory.$.isPaymentVerified": true,
                    "paymentHistory.$.paymentUpdateRequest": false,
                    "paymentHistory.$.paymentVerifiedBy": accountEmpId,
                    "paymentHistory.$.accountRemarks": accountRemarks,
                },
                $inc: {
                    penaltyDiscount: Number(
                        Number(calculatedAmount.penaltyDiscount).toFixed(2)
                    ),
                    interestDiscount: Number(
                        Number(calculatedAmount.interestDiscount).toFixed(2)
                    ),
                    principalDiscount: Number(
                        Number(calculatedAmount.principalDiscount).toFixed(2)
                    ),
                    penaltyReceived: Number(
                        Number(calculatedAmount.penaltyReceived).toFixed(2)
                    ),
                    interestReceived: Number(
                        Number(calculatedAmount.interestReceived).toFixed(2)
                    ),
                    principalReceived: Number(
                        Number(calculatedAmount.principalReceived).toFixed(2)
                    ),
                    totalReceivedAmount: Number(
                        Number(calculatedAmount.receivedAmount).toFixed(2)
                    ),
                    excessAmount: Number(
                        Number(calculatedAmount.excessAmount).toFixed(2)
                    ),
                },
            },
            { new: true, runValidators: true, session }
        );
        if (!updatedPayment) {
            return false;
        }
        const { interest, penalty, principalAmount } = calculatedAmount;

        let updateCollection = await Collection.findOneAndUpdate(
            {
                loanNo,
            },
            {
                $set: {
                    penalty: Number(penalty.toFixed(2)),
                    interest: Number(interest.toFixed(2)),
                    principalAmount: Number(principalAmount.toFixed(2)),
                    outstandingAmount: penalty + interest + principalAmount,
                },
            },
            { new: true, runValidators: true, session }
        );

        if (
            updateCollection.outstandingAmount < 1
            // || [ "closed" ,  "settled" ,  "writeOff"].includes(closingType)
        ) {
            var closedData = await Close.findOne({
                pan: collectionData[0].pan,
            });
            var closed = await Close.findOneAndUpdate(
                {
                    // pan: collectionData[0].pan,
                    loanNo: collectionData[0].loanNo,
                },
                {
                    $set: {
                        isClosed: true,
                        isActive: false,
                        isSettled: closingType === "settled",
                        isWriteOff: closingType === "writeOff",
                    },
                },
                {
                    new: true,
                    session,
                }
            );

            const loanDetails = await LoanApplication.findOneAndUpdate(
                { loanNo: loanNo },
                {
                    applicationStatus: "CLOSED",
                },
                { new: true, session }
            );
        }

        // console.log('return updated payment',updatedPayment , "The closed are",closed ,  "colection",collectionData[0].loanNo , "Another ",closedData)

        // customerFullName: "John Doe",
        // disbursalAmount: "50000",
        // laonNo: "LN123456",
        // utrNo: "UTR789012",
        // closedDate: "2025-03-16",
        // closingAmount: "0",
        // closingDate: "2025-03-16",
        // disbursalDate: "2025-03-01"
        // to : customer personal mail
        // Send Noc mail

        const pipeline = [
            {
                $match: { loanNo: loanNo }, // Match disbursal with loanNo
            },
            {
                $lookup: {
                    from: "leads", // Name of the leads collection
                    localField: "leadNo",
                    foreignField: "leadNo",
                    as: "leadDetails",
                },
            },
            {
                $unwind: "$leadDetails", // Convert array to object
            },
            {
                $project: {
                    _id: 0,
                    fName: "$leadDetails.fName",
                    mName: "$leadDetails.mName",
                    lName: "$leadDetails.lName",
                    pan: "$leadDetails.pan",
                    personalEmail: "$leadDetails.personalEmail",
                    disbursedAt: 1, // Include disbursalAt from disbursal collection
                    amount: 1, // Include amount from disbursal collection
                },
            },
        ];

        const result = await Disbursal.aggregate(pipeline);
        console.log(
            "the agg result is ",
            result,
            "the mail ke",
            process.env.mail_template_key
        );

        if (result.length > 0 && closed?.isClosed) {
            // const mailData = {
            //     mail_template_key: process.env.mail_template_key,
            //     from: { address: "noreply@qualoan.com", name: "noreply" },
            //     to: [{ email_address: { address: result[0]?.personalEmail, name: result[0]?.fullName } }],
            //     cc: [{ email_address: { address: "badal@only1loan.com", name: "Badal" } }],
            //     merge_info: {
            //         customerFullName: ` ${result[0]?.fName } + ${result[0]?.mName} + ${result[0]?.lName} `,
            //         disbursalAmount: result[0]?.amount,
            //         laonNo: loanNo,
            //         utrNo: transactionId,
            //         closedDate: closed?.updatedAt,
            //         closingAmount: updatedPayment?.totalReceivedAmount,
            //         closingDate: closed?.updatedAt,
            //         disbursalDate: result[0]?.disbursedAt
            //     }
            // };

            const formatDate = (dateString) => {
                if (!dateString) return "N/A";
                return new Date(dateString).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                });
            };

            const mailData = {
                mail_template_key: process.env.MAIL_TEMPLATE_KEY,
                from: { address: "noreply@qualoan.com", name: "noreply" },
                to: [
                    {
                        email_address: {
                            address: result[0]?.personalEmail,
                            name: result[0]?.fullName,
                        },
                    },
                ],
                cc: [
                    {
                        email_address: {
                            address: "collectionhead@qualoan.com",
                            name: "Collection Head",
                        },
                    },
                ],
                merge_info: {
                    customerFullName: `${result[0]?.fName || ""} ${
                        result[0]?.mName || ""
                    } ${result[0]?.lName || ""}`.trim(),
                    disbursalAmount: result[0]?.amount,
                    laonNo: loanNo,
                    utrNo: transactionId,
                    closedDate: formatDate(closed?.updatedAt),
                    closingAmount: updatedPayment?.totalReceivedAmount,
                    closingDate: formatDate(closed?.updatedAt),
                    disbursalDate: formatDate(result[0]?.disbursedAt),
                    pan: result[0].pan,
                },
            };

            sendNocMail(mailData);
        }

        return updatedPayment;
    } catch (error) {
        console.log("errororroror", error);

        return false;
    }
};

//         const result = await Disbursal.aggregate(pipeline);

//         // Example usage:
//         const mailData = {
//     mail_template_key: process.env.mail_template_key,
//     from: { address: "info@qualoan.com", name: "noreply" },
//     to: [{ email_address: { address: result[0].personalEmail, name: result[0].fullName } }],
//     cc: [
//         { email_address: { address: "badal@only1loan.com", name: "Badal" } }
//     ],
//     merge_info: {
//         customerFullName: result[0].fullName,
//         disbursalAmount: result[0].amount,
//         laonNo: loanNo,
//         utrNo: transactionId,
//         closedDate: closed.updatedAt,
//         closingAmount: updatedPayment.totalReceivedAmount,
//         closingDate: closed.updatedAt,
//         disbursalDate: result[0].disbursedAt
//     }
// };
//         sendMail(mailData);

//         return updatedPayment

// Fetch user details to send NOC mail
// const pipeline = [
//     { $match: { loanNo } },
//     {
//         $lookup: {
//             from: "leads",
//             localField: "leadNo",
//             foreignField: "leadNo",
//             as: "leadDetails"
//         }
//     },
//     { $unwind: "$leadDetails" },
//     {
//         $project: {
//             _id: 0,
//             fullName: "$leadDetails.fullName",
//             personalEmail: "$leadDetails.personalEmail",
//             disbursedAt: 1,
//             amount: 1
//         }
//     }
// ];
