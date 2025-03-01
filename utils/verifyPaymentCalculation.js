import Close from "../models/close.js";
import Closed from "../models/Closed.js";
import Collection from "../models/Collection.js";
import Payment from "../models/Payment.js";
import LoanApplication from "../models/User/model.loanApplication.js";
import { calculateReceivedPayment } from "./calculateReceivedPayment.js";

export const verifyPaymentCalculation = async (loanNo, transactionId, accountRemarks = "", accountEmpId = null, session) => {
    try {
        
        const collectionData = await Collection.aggregate([
            {
                $match: { loanNo }
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
                    preserveNullAndEmptyArrays: true // Keeps collections even if no matching payment exists
                }
            },
            {
                $addFields: {
                    filteredPaymentHistory: {
                        $filter: {
                            input: "$paymentData.paymentHistory",
                            as: "history",
                            cond: { $eq: ["$$history.transactionId", transactionId] }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "camdetails",
                    localField: "camDetails",
                    foreignField: "_id",
                    as: "camDetails"
                }
            },
            {
                $unwind: {
                    path: "$camDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    paymentData: 0
                }
            }
        ]).session(session);
        
        if (!collectionData) {
            return false;
        }
        
        const calculatedAmount = calculateReceivedPayment(collectionData)
        
        if (!calculatedAmount) {
            return false
        }
        let outstandingAmount = calculatedAmount.penalty + calculatedAmount.interest + calculatedAmount.principalAmount
        if (outstandingAmount < 1) {
            calculatedAmount.principalDiscount += outstandingAmount
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
                    penaltyDiscount: Number(Number(calculatedAmount.penaltyDiscount).toFixed(2)),
                    interestDiscount: Number(Number(calculatedAmount.interestDiscount).toFixed(2)),
                    principalDiscount: Number(Number(calculatedAmount.principalDiscount).toFixed(2)),
                    penaltyReceived: Number(Number(calculatedAmount.penaltyReceived).toFixed(2)),
                    interestReceived: Number(Number(calculatedAmount.interestReceived).toFixed(2)),
                    principalReceived: Number(Number(calculatedAmount.principalReceived).toFixed(2)),
                    totalReceivedAmount: Number(Number(calculatedAmount.receivedAmount).toFixed(2)),
                    excessAmount: Number(Number(calculatedAmount.excessAmount).toFixed(2)),
                    
                }
                
            },
            { new: true, runValidators: true, session }
        );
        if (!updatedPayment) {
            return false;
        }
        const { interest, penalty, principalAmount } = calculatedAmount
        
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

        
        if (updateCollection.outstandingAmount < 1) {
            
            const closed = await Close.findOneAndUpdate(
                {
                    pan: collectionData[0].pan,
                    loanNo: collectionData[0].loanNo
                },
                {
                    $set: {
                        isClosed: true,
                        isActive: false
                    }
                },
                {
                    new: true,
                    session
                }
            );
            
            console.log('in verify payment ---->')
            const loanDetails = await LoanApplication.findOneAndUpdate({ loanNo: loanNo }, {
                applicationStatus: "CLOSED"
            }, { new: true , session })
            console.log("loandetails ----->", loanDetails)
        }

        return updatedPayment
    } catch (error) {
        console.log('errororroror', error)

        return false

    }
}