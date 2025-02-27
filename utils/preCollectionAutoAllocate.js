import Collection from "../models/Collection"

export const preCollectionAutoAllocate =async () => {
    const pipeline = [
        {
            $lookup: {
                from: "camdetails",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "camDetails"
            }
        },
        {
            $unwind: "$camDetails"
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
                                                "$camDetails.repaymentDate"
                                            ]
                                        },
                                        86400000
                                    ]
                                },
                                -5
                            ]
                        },
                        {
                            $lte: [
                                {
                                    $divide: [
                                        {
                                            $subtract: [
                                                "$$NOW",
                                                "$camDetails.repaymentDate"
                                            ]
                                        },
                                        86400000
                                    ]
                                },
                                5
                            ]
                        }
                    ]
                }
            }
        },
        {
            $match: {
                collectionExecutiveId: {
                    $exists: false
                },
                preCollectionExecutiveId: {
                    $exists: false
                }
            }
        },
        {
            $lookup: {
                from: "closes",
                localField: "close",
                foreignField: "_id",
                as: "closedDetails"
            }
        },
        {
            $unwind: "$closedDetails"
        },
        {
            $match: {
                "closedDetails.isActive": true,
                "closedDetails.isClosed": false,
                "closedDetails.isDisbursed": true
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
            $lookup: {
                from: "disbursals",
                localField: "disbursal",
                foreignField: "_id",
                as: "disbursalDetails"
            }
        },
        {
            $unwind: "$disbursalDetails"
        },
        {
            $lookup: {
                from: "employees",
                localField: "disbursalDetails.disbursedBy",
                foreignField: "_id",
                as: "employeeDetails"
            }
        },
        {
            $unwind: "$employeeDetails"
        },
        {
            $sort: { "camDetails.repaymentDate": -1 }
        },
        {
            $project: {
                _id: 1,
                disbursedBy: {
                    $concat: [
                        "$employeeDetails.fName",
                        " ",
                        "$employeeDetails.lName"
                    ]
                },
                sanctionAmount:"$camDetails.loanRecommended",
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
                disbursalDate: "$camDetails.disbursalDate"
            }
        },
    ]

    const preActiveLeads = await Collection.aggregate(pipeline)

}