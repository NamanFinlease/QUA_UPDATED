import moment from "moment"
import Collection from "../models/Collection.js";

const BATCH_SIZE = 500;


export const calculateInterest = async (msg) => {
    // console.log('cron is running', msg, new Date())

    const payments = await Collection.aggregate([
        {
            $lookup: {
                from: "closes",
                localField: "close",
                foreignField: "_id",
                as: "closedData"
            }
        },
        {
            $unwind: {
                path: "$closedData",
                preserveNullAndEmptyArrays: true // In case there is no match
            }
        },
        {
            $match: {
                "closedData.isActive": true, // Ensure correct field reference
                "closedData.isClosed": false
            }
        },

        {
            $lookup: {
                from: "disbursals",
                localField: "disbursal",
                foreignField: "_id",
                as: "disbursalData"
            }
        },
        {
            $unwind: {
                path: "$disbursalData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "sanctions",
                localField: "disbursalData.sanction",
                foreignField: "_id",
                as: "sanctionData"
            }
        },

        {
            $unwind: {
                path: "$sanctionData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "payments",
                localField: "payment",
                foreignField: "_id",
                as: "paymentData"
            }
        },

        {
            $unwind: {
                path: "$paymentData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "camdetails",
                localField: "camDetails",
                foreignField: "_id",
                as: "camData"
            }
        },
        {
            $unwind: {
                path: "$camData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $set: {
                latestPayment: {
                    $arrayElemAt: [
                        {
                            $slice: [
                                {
                                    $filter: {
                                        input: "$paymentData.paymentHistory",
                                        as: "history",
                                        cond: {
                                            $and: [
                                                { $ne: ["$$history.paymentDate", null] },  // Ensure paymentDate exists
                                                { $eq: ["$$history.isPaymentVerified", true] } // Check if payment is verified
                                            ]
                                        }
                                    }
                                },
                                -1 // Gets the last (latest) payment after filtering
                            ]
                        },
                        0
                    ]
                }
            }
        },
        {
            $project: {
                penalty: 1,
                interest: 1,
                loanNo: 1,
                principalAmount: 1,
                penalRate: 1,
                dpd: 1,
                sanctionedAmount: "$camData.loanRecommended",
                repaymentDate: "$camData.repaymentDate",
                roi: "$camData.roi",
                tenure: "$camData.eligibleTenure",
                sanctionDate: "$sanctionData.sanctionDate",
                disbursedDate: "$camData.disbursalDate",
                paymentDate: "$latestPayment.paymentDate",
                closingType: "$latestPayment.closingType"
            }
        }
    ]);




    const collectionBulk = []
    let count = 0


    for (let payment of payments) {
        count++
        let { roi, tenure, sanctionDate, principalAmount, penalty, disbursedDate, interest, dpd, loanNo, paymentDate, closingType, repaymentDate } = payment
        let penalRate = 2

        // console.log('repayment',payment)

        // console.log('cronnnnn', !disbursedDate, !tenure, !roi, loanNo, !principalAmount, principalAmount)


        if (!disbursedDate || !tenure || !roi || !principalAmount) return "Insuficiant Data!";
        let localDisbursedDate = moment(disbursedDate).startOf("day");
        const today = moment().startOf("day");
        const elapseDays = today.diff(localDisbursedDate, "days") + 1

        dpd = Math.max(0, elapseDays - tenure)


        if (closingType && closingType === "partPayment") {

            let localPaymentDate = moment(paymentDate).startOf("day");
            let localRepaymentDate = moment(repaymentDate).startOf("day");
            const paymentBeforeRepayment = localPaymentDate.isBefore(localRepaymentDate);
            const daysBetweenPaymentAndRepayment = localRepaymentDate.diff(localPaymentDate, "days");

            console.log('date difference', loanNo, )
            if (paymentBeforeRepayment) {
                console.log('payment before')
                penalty = Number((principalAmount * (penalRate / 100) * dpd).toFixed(2))
                interest = Number((principalAmount * (roi / 100) * daysBetweenPaymentAndRepayment).toFixed(2))
            } else {
                console.log('payment after')
                penalty = Number((principalAmount * (penalRate / 100) * today.diff(localPaymentDate, "days")).toFixed(2))
            }
            dpd = elapseDays - tenure

        } else {

            if (dpd > 0) {
                dpd = elapseDays - tenure
                penalty = Number((principalAmount * (penalRate / 100) * dpd).toFixed(2))
            } else {
                interest = Number((principalAmount * (roi / 100) * elapseDays).toFixed(2))
            }
        }

        collectionBulk.push({
            updateOne: {
                filter: { _id: payment._id },
                update: {
                    $set: {
                        interest: Number(interest.toFixed(2)),
                        penalty: Number(penalty.toFixed(2)),
                        dpd,
                        outstandingAmount: Number(((principalAmount || 0) + (interest || 0) + (penalty || 0)).toFixed(2))
                    }
                }
            }
        });

        if (collectionBulk.length > BATCH_SIZE) {
            await Collection.bulkWrite(collectionBulk);
            collectionBulk.length = 0

        }

    }
    console.log("count ", count)

    if (collectionBulk.length > 0) {
        await Collection.bulkWrite(collectionBulk);
    }


}