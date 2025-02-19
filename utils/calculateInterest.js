import moment from "moment"
import Collection from "../models/Collection.js";

const BATCH_SIZE = 500;


export const calculateInterest = async (msg) => {
    console.log('cron is running', msg, new Date())

    const collections = await Collection.aggregate([
        {
            $lookup: {
                from: "closeds",
                localField: "closed",
                foreignField: "_id",
                as: "closedData"
            }
        },
        {
            $match: {
                "closedData.data.isActive": true,
                "closedData.data.isClosed": false,
                "closedData.data.isDisbursed": true
            }
        },
        {
            $addFields: {
                activeClosed: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: "$closedData.data", // Access `data` inside `closedData`
                                as: "item",
                                cond: {
                                    $and: [
                                        {
                                            $eq: ["$$item.isActive", true]
                                        },
                                        {
                                            $eq: [
                                                "$$item.isClosed",
                                                false
                                            ]
                                        },
                                        {
                                            $eq: [
                                                "$$item.isDisbursed",
                                                true
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        0
                    ]
                }
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
            $lookup: {
                from: "sanctions",
                localField: "disbursalData.sanction",
                foreignField: "_id",
                as: "sanctionData"
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
            $unwind: {
                path: "$sanctionData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                penalty: 1,
                interest: 1,
                principalAmount: 1,
                penalRate: 1,
                dpd: 1,
                sanctionedAmount:
                    "$camData.loanRecommended",
                roi: "$camData.roi",
                tenure: "$camData.eligibleTenure",
                sanctionDate: "$sanctionData.sanctionDate",
                disbursedDate: "$camData.disbursalDate"
            }
        }
    ]);



    const collectionBulk = []


    for(let collectionData of collections) {
        let { roi, tenure, sanctionDate, principalAmount, penalty, disbursedDate, penalRate, interest, dpd } = collectionData

        if (!disbursedDate || !tenure) return "Insuficiant Data!";


        let localDisbursedDate = moment(disbursedDate).startOf("day");
        const today = moment().startOf("day");


        const elapseDays = today.diff(localDisbursedDate, "days") + 1
        console.log('elapse days', elapseDays, today, localDisbursedDate)
        if (elapseDays > tenure) {
            penalty += Number((principalAmount * (penalRate / 100)).toFixed(2))
            dpd = elapseDays - tenure
        } else {
            interest += Number((principalAmount * (roi / 100)).toFixed(2))
        }
        collectionBulk.push({
            updateOne: {
                filter: { _id: collectionData._id },
                update: {
                    $set: {
                       interest: Number(interest.toFixed(2)),
                        penalty:Number(penalty.toFixed(2)),
                        dpd,
                        outstandingAmount: Number(((principalAmount || 0) + (interest || 0) + (penalty || 0)).toFixed(2))
                    }
                }
            }
        });

        if(collectionBulk.length > BATCH_SIZE){
            await Collection.bulkWrite(collectionBulk);
            collectionBulk.length = 0

        }

    }

    if (collectionBulk.length > 0) {
        await Collection.bulkWrite(collectionBulk);
    }


}