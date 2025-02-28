import asyncHandler from "../../middleware/asyncHandler.js";
import Closed from "../../models/Closed.js";
import generateReceiptId from "../../utils/receiptIDgenerator.js"
import Repayment from "../../models/repayment.js"
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import LogHistory from "../../models/LeadLogHistory.js";
import Collection from "../../models/Collection.js";
import Payment from "../../models/Payment.js";
import User from "../../models/User/model.user.js";
import { verifyPaymentCalculation } from "../../utils/verifyPaymentCalculation.js";
import LoanApplication from "../../models/User/model.loanApplication.js";
import { sessionAsyncHandler } from "../../middleware/sessionAsyncHandler.js";
import Lead from "../../models/Leads.js";
import { postLogs } from "../logs.js";
import LeadStatus from "../../models/LeadStatus.js";
import Close from "../../models/close.js";
dotenv.config();


export const getLoanNumber = asyncHandler(async (req, res) => {

    const userId = req.user._id
    const userDetails = await User.findById(userId)
    const { PAN } = userDetails

    const pipeline = [
        {
            $match: {
                pan: PAN,
                isActive: true
            }
        },
        
        {
            $lookup: {
                from: "disbursals",
                localField: "firstActiveLoan.disbursal",
                foreignField: "_id",
                as: "disbursalData"
            }
        },
        {
            $unwind: "$disbursalData"
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
            $unwind: "$sanctionData"
        },
        {
            $lookup: {
                from: "applications",
                localField: "sanctionData.application",
                foreignField: "_id",
                as: "applicationData"
            }
        },
        {
            $unwind: "$applicationData"
        },
        {
            $lookup: {
                from: "leads",
                localField: "applicationData.lead",
                foreignField: "_id",
                as: "leadData"
            }
        },
        {
            $unwind: "$leadData"
        },
        {
            $lookup: {
                from: "collections",
                localField: "firstActiveLoan.loanNo",
                foreignField: "loanNo",
                as: "collectionData"
            }
        },
        {
            $unwind: {
                path: "$collectionData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                loanNo: "$firstActiveLoan.loanNo",
                pan: PAN,
                personalEmail: "$leadData.personalEmail",
                mobile: "$leadData.mobile",
                fName: "$leadData.fName",
                mName: "$leadData.mName",
                lName: "$leadData.lName",
                repaymentAmount: "$collectionData.outstandingAmount",
                repaymentDate: "$collectionData.repaymentDate",
                penalty: "$collectionData.totalPenalty",
                dpd: "$collectionData.dpd",
                principalAmount: "$collectionData.principalAmount",
                _id: 0
            }
        }
    ]


    const result = await Close.aggregate(pipeline);

    if (!result || result.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Loan is not active or related data could not be found for this PAN."
        });
    }

    return res.status(200).json({
        success: true,
        ...result[0]
    });

})

export const payNow = asyncHandler(async (req, res) => {

    const { loanNo } = req.body;



    // fetch amount from collection table from loanNo
    const pipeline = [
        {
            $match: {
                loanNo: loanNo
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
        {
            $unwind: "$leadDetails"
        },
        {
            $project: {
                amount: "$outstandingAmount",
                pan: 1,
                fName: "$leadDetails.fName",
                mName: "$leadDetails.mName",
                lName: "$leadDetails.lName",
                email: "$leadDetails.personalEmail",
                phone: "$leadDetails.mobile",
                loanNo: 1

            }
        }
    ]

    const collectionDetails = await Collection.aggregate(pipeline)
    console.log("collectionDetails--->", collectionDetails)
    const { amount, fName, mName, lName, email, phone, pan } = collectionDetails[0];
    console.log(" reciptId--->", generateReceiptId())
    // Parameters to send to the payment gateway
    let params = {
        amount: amount * 100,
        currency: 'INR',
        callback_url: process.env.PAYTRING_CALLBACK,
        cname: `${fName} ${mName} ${lName}`,
        email,
        key: process.env.PAYTRING_PROD_KEY,
        phone,
        receipt_id: generateReceiptId(),
        notes: {
            udf1: pan,
            udf2: loanNo,
        }
    };

    // Sort and hash the parameters
    let sorted_params = Object.keys(params).sort().reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
    }, {});

    let value_string = Object.values(sorted_params)
        .filter(value => typeof value !== 'object')
        .join('|') + `|${process.env.PAYTRING_PROD_KEY}`;

    const hash = CryptoJS.SHA512(value_string).toString();
    params.hash = hash;

    console.log("params---->", params)

    // Send request to Paytring's API
    const response = await fetch('https://api.paytring.com/api/v2/order/create', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Basic ${process.env.PAYTRING_PROD_TOKEN}`
        },
        body: JSON.stringify(params)
    });

    const data = await response.json();
    if (!data.order_id) {
        return res.status(500).json({ error: 'Failed to create order' });
    }

    // Return the order details to the frontend
    return res.status(200).json(data);

})

export const callback = sessionAsyncHandler(async (req, res, session) => {
    console.log('Callback received:')
    const callbackResponse = req.body;
    const logData = await LogHistory.create(
        {
            logDate: new Date(),
            status: "Callback URL hit",
            leadRemark: `${JSON.stringify(callbackResponse)}`
        },
    )
    // console.log("logData--->", logData)
    const { order_id } = req.body
    // console.log("received object is ---->", callbackResponse)

    if (!order_id) {
        return res.status(400).json({ message: '--Order ID not provided in callback' });
    }

    console.log("OrderId ----->", order_id)

    const url = 'https://api.paytring.com/api/v2/order/fetch';
    const options = {
        method: 'POST',
        headers: {
            accept: 'text/plain',
            'content-type': 'application/json',
            authorization: `Basic ${process.env.PAYTRING_PROD_TOKEN}`
        },
        body: JSON.stringify({ key: process.env.PAYTRING_PROD_KEY, id: callbackResponse.order_id, hash: callbackResponse.hash })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    // console.log("data--->", data);


    // //  const {amount} = req.body
    //  let data = {
    //     status: "success",
    //     order: {
    //       order_id: "ORD123456",
    //       pg_transaction_id: "TXN789012",
    //       order_status: "success",
    //       receipt_id: "RCT456789",
    //       method: "UPI",
    //       amount: 101,
    //       created_at: "2025-02-13 12:34:56",
    //       notes: {
    //         "udf1": "LIOPK3645N", 
    //         "udf2": "QUALON0001030",  
    //       }
    //     }
    //   }


    if (!data) {
        console.log("error")
        return res.status(500).json({ message: 'Network response was not ok' });
    }

    // Check payment status
    if (data.status) {
        // update in database

        const repaymentDetails = await Repayment.findOneAndUpdate(
            { 'details.pg_transaction_id': data.order.pg_transaction_id }, {
            pan: data.order?.notes?.udf1 ?? "",
            loanNo: data.order?.notes?.udf2 ?? "",
            hash: callbackResponse.hash,
            details: data.order ?? {}
        },
            {
                upsert: true,
                new: true,
                session
            })

        const loanNo = data.order?.notes?.udf2 ?? ""
        let receivedAmount = Number(data.order.amount / 100)
        let transactionId = data.order.pg_transaction_id
        let order_status = data.order.order_status
        let order_id = data.order.order_id
        let receipt_id = data.order.receipt_id
        let paymentMethod = data.order.method
        let paymentMode = "paymentGateway"
        let closingType = "closed"
        let remarks
        let discount = 0
        let excessAmount = 0
        let paymentDate = new Date(data.order.created_at.replace(" ", "T"));

        console.log('loan number-->', loanNo)
        console.log('received amount from paytring-->', receivedAmount)

        let isPartialPaid;
        const collectionData = await Collection.findOne({ loanNo : loanNo })


        if (!collectionData) {
            res.status(404)
            throw new Error("Collection record not found");
        }


        if (receivedAmount > collectionData.outstandingAmount) {
            excessAmount = receivedAmount - collectionData.outstandingAmount;
        } else if (receivedAmount >= Math.floor(collectionData.outstandingAmount) && receivedAmount < collectionData.outstandingAmount) {
            discount = collectionData.outstandingAmount - receivedAmount;
        } else if ((receivedAmount < Math.floor(collectionData.outstandingAmount) || closingType === "partPayment")) {
            isPartialPaid = true;
            closingType = "partPayment";
        }

        console.log('received amount after calculation', receivedAmount)
        // increament amounts when payment status become true-->
        // let updatedPayment;
        // Update Payment Collection --------------
        let updatedPayment = await Payment.findOneAndUpdate(
            {
                loanNo,
                'paymentHistory.transactionId': { $ne: transactionId }
            },
            {
                $push: {
                    paymentHistory: {
                        receivedAmount,
                        paymentMode,
                        paymentDate,
                        closingType,
                        discount,
                        excessAmount,
                        remarks,
                        isPartialPaid,
                        transactionId,
                        order_status,
                        order_id,
                        receipt_id,
                        paymentMethod,
                        isPaymentVerified: true,
                    },
                },
                $inc: {
                    totalReceivedAmount: data.order.order_status === "success" ? Number(receivedAmount) : 0
                },
            },
            { new: true, runValidators: true, session }
        );
        console.log('updatedPayment if transactionId is null --->', updatedPayment)

        if (!updatedPayment) {
            console.log("same transaction id---> , is bloack me nhi jaana chahiye")
            await Payment.findOneAndUpdate(
                {
                    loanNo,
                    'paymentHistory.transactionId': transactionId
                },
                {
                    $set: {
                        'paymentHistory.$.receivedAmount': receivedAmount,
                        'paymentHistory.$.order_status': data.order.order_status,
                        'paymentHistory.$.isPaymentVerified': true
                    }
                },
                {
                    new: true,
                    runValidators: true,
                    session
                }
            );
        }
        console.log('updatedPayment if transactionId is not null --->', updatedPayment)

        if (order_status === "success") {

            const updatedPayment = await verifyPaymentCalculation(loanNo, transactionId, "", null, session)
            if (!updatedPayment) {
                // await session.abortTransaction();
                throw new Error("Payment didn't update");
                return res.status(400).json({ error: `Payment didn't update` });
            }

            console.log("---> updated payment details --->", updatedPayment)
            // Update Logs
            const collectionData = await Collection.findOne({ loanNo: loanNo }, null,{ session })
            const lead = await Lead.findOne({ leadNo: collectionData.leadNo },null, { session })

            // update leadStatus 
            await LeadStatus.findOneAndUpdate({
                leadNo: lead.leadNo
            },
                {
                    stage: "COLLECTION",
                    subStage: "COLLECTION IN PROCESS"
                },
                { session }
            )
            await postLogs(
                lead._id,
                "PAYMENT RECEIVED BY PAYMENT GATEWAY",
                `${lead.fName}${lead.mName && ` ${lead.mName}`}${lead.lName && ` ${lead.lName}`
                }`,
                ``,
                ``,
                session
            );

        }

        // return res.status(200).json({
        //     message: 'Payment verified successfully',
        // });
        return res.redirect(`https://preprod-web.qualoan.com/verify-repayment`)

    }

    else {
        await LogHistory.create({
            logDate: new Date(),
            status: "Payment verification failed By Payment Gateway",
            leadRemark: `Order ID: ${JSON.stringify(callbackResponse)}`,
        });

        return res.status(400).json({
            message: 'Payment verification failed',
        });
    }

})
