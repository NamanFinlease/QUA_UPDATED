import Disbursal from "../../../models/Disbursal.js";
import moment from "moment-timezone";


export const exportCollectionData = async () => {
    try {


        console.log("Start Time:", moment().format("DD/MM/YYYY HH:mm:ss"));

        // Fetch disbursed records with necessary fields
        const collectionReportsData = await Disbursal.aggregate(
            [
                { $match: { isDisbursed: true } },

                {
                    $lookup: {
                        from: "closes",
                        localField: "_id",
                        foreignField: "disbursal",
                        as: "close"
                    }
                },
                { $unwind: { path: "$close", preserveNullAndEmptyArrays: true } },


                {
                    $lookup: {
                        from: "payments",
                        let: { loanNo: "$loanNo" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$loanNo", "$$loanNo"]
                                    }
                                }
                            },
                            {
                                $project: {
                                    totalReceivedAmount: 1,
                                    successfulPayments: {
                                        $filter: {
                                            input: "$paymentHistory",
                                            as: "payment",
                                            cond: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$$payment.isPaymentVerified",
                                                            true
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$$payment.isRejected",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        ],
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
                        from: "sanctions",
                        localField: "sanction",
                        foreignField: "_id",
                        as: "sanction"
                    }
                },
                { $unwind: "$sanction" },

                {
                    $lookup: {
                        from: "applications",
                        localField: "sanction.application",
                        foreignField: "_id",
                        as: "application"
                    }
                },
                { $unwind: "$application" },

                {
                    $lookup: {
                        from: "leads",
                        localField: "application.lead",
                        foreignField: "_id",
                        as: "lead"
                    }
                },
                { $unwind: "$lead" },

                {
                    $lookup: {
                        from: "employees",
                        localField: "lead.recommendedBy",
                        foreignField: "_id",
                        as: "leadRecommendedBy"
                    }
                },
                {
                    $unwind: {
                        path: "$leadRecommendedBy",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "applicants",
                        localField: "application.applicant",
                        foreignField: "_id",
                        as: "applicant"
                    }
                },
                {
                    $unwind: {
                        path: "$applicant",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "camdetails",
                        localField: "lead._id",
                        foreignField: "leadId",
                        as: "cam"
                    }
                },
                {
                    $unwind: {
                        path: "$cam",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "aadhaardetails",
                        localField: "lead.aadhaar",
                        foreignField: "uniqueId",
                        as: "aadhaarDetails"
                    }
                },
                {
                    $unwind: {
                        path: "$aadhaarDetails",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "banks",
                        localField: "applicant._id",
                        foreignField: "borrowerId",
                        as: "bank"
                    }
                },
                {
                    $unwind: {
                        path: "$bank",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $set: {
                        successfulPayments: {
                            $slice: [
                                {
                                    $sortArray: {
                                        input: { $ifNull: ["$paymentData.successfulPayments", []] },
                                        sortBy: { paymentDate: -1 }
                                    }
                                },
                                10
                            ]
                        },
                        status: {
                            $cond: {
                                if: { $and: [{ $eq: ["$close.isActive", false] }, { $eq: ["$close.isClosed", true] }] },
                                then: "Closed",
                                else: {
                                    $cond: {
                                        if: {
                                            $eq: [{ $size: { $ifNull: ["$paymentData.successfulPayments", []] } }, 0]
                                        },
                                        then: "",
                                        else: {
                                            $concat: [
                                                "part-",
                                                {
                                                    $toString: { $size: { $ifNull: ["$paymentData.successfulPayments", []] } }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        "Repayment Date": {
                            $dateToString: {
                                format: "%d %b %Y",
                                date: "$cam.repaymentDate"
                            }
                        },
                        "Disbursed Date": {
                            $dateToString: {
                                format: "%d %b %Y",
                                date: "$disbursedAt"
                            }
                        },
                        "Loan No": "$loanNo",
                        Name: {
                            $trim: {
                                input: {
                                    $concat: [
                                        "$lead.fName",
                                        {
                                            $cond: {
                                                if: { $gt: [{ $strLenCP: { $ifNull: ["$lead.mName", ""] } }, 0] },
                                                then: { $concat: [" ", "$lead.mName"] },
                                                else: ""
                                            }
                                        },
                                        " ",
                                        "$lead.lName"
                                    ]
                                }
                            }
                        },
                        PAN: "$lead.pan",
                        Mobile: "$lead.mobile",
                        AlternateMobile: "$lead.alternateMobile",
                        "Sanctioned Amount": "$cam.loanRecommended",
                        ROI: "$cam.roi",
                        "Repayment Amount": "$cam.repaymentAmount",
                        "Payment Date": {
                            $dateToString: {
                                format: "%d %b %Y",
                                date: {
                                    $arrayElemAt: [
                                        "$successfulPayments.paymentDate",
                                        0
                                    ]
                                }
                            }
                        },
                        "Paid Amount": {
                            $ifNull: [
                                "$paymentData.totalReceivedAmount",
                                0
                            ]
                        },
                        "Credited Bank": {
                            $ifNull: [
                                {
                                    $arrayElemAt: [
                                        "$successfulPayments.bankName",
                                        0
                                    ]
                                },
                                ""
                            ]
                        },
                        "Account Remarks": {
                            $ifNull: [
                                {
                                    $arrayElemAt: [
                                        "$successfulPayments.accountRemarks",
                                        0
                                    ]
                                },
                                ""
                            ]
                        },
                        Status: "$status"
                    }
                }
            ])


        if (!collectionReportsData.length) {
            console.log("No data found.")
            return []
        };

        return collectionReportsData;
    } catch (error) {
        console.error("Error generating report:", error);
    }
};


export const exportMasterCollectionData = async () => {
    try {


        console.log("Start Time:", moment().format("DD/MM/YYYY HH:mm:ss"));

        // Fetch disbursed records with necessary fields
        const collectionReportsData = await Disbursal.aggregate(
            [
                { $match: { isDisbursed: true } },

                {
                    $lookup: {
                        from: "closes",
                        localField: "_id",
                        foreignField: "disbursal",
                        as: "close"
                    }
                },
                { $unwind: { path: "$close", preserveNullAndEmptyArrays: true } },


                {
                    $lookup: {
                        from: "payments",
                        let: { loanNo: "$loanNo" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$loanNo", "$$loanNo"]
                                    }
                                }
                            },
                            {
                                $project: {
                                    totalReceivedAmount: 1,
                                    successfulPayments: {
                                        $filter: {
                                            input: "$paymentHistory",
                                            as: "payment",
                                            cond: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$$payment.isPaymentVerified",
                                                            true
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$$payment.isRejected",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        ],
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
                        from: "sanctions",
                        localField: "sanction",
                        foreignField: "_id",
                        as: "sanction"
                    }
                },
                { $unwind:{ path:"$sanction", preserveNullAndEmptyArrays: true} },

                {
                    $lookup: {
                        from: "employees",
                        localField: "sanction.approvedBy",
                        foreignField: "_id",
                        as: "approvedBy"
                    }
                },
                { $unwind: {path:"$approvedBy", preserveNullAndEmptyArrays: true} },

                {
                    $lookup: {
                        from: "applications",
                        localField: "sanction.application",
                        foreignField: "_id",
                        as: "application"
                    }
                },
                { $unwind: "$application" },

                {
                    $lookup: {
                        from: "leads",
                        localField: "application.lead",
                        foreignField: "_id",
                        as: "lead"
                    }
                },
                { $unwind: "$lead" },

                {
                    $lookup: {
                        from: "employees",
                        localField: "lead.recommendedBy",
                        foreignField: "_id",
                        as: "leadRecommendedBy"
                    }
                },
                {
                    $unwind: {
                        path: "$leadRecommendedBy",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "applicants",
                        localField: "application.applicant",
                        foreignField: "_id",
                        as: "applicant"
                    }
                },
                {
                    $unwind: {
                        path: "$applicant",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "camdetails",
                        localField: "lead._id",
                        foreignField: "leadId",
                        as: "cam"
                    }
                },
                {
                    $unwind: {
                        path: "$cam",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "aadhaardetails",
                        localField: "lead.aadhaar",
                        foreignField: "uniqueId",
                        as: "aadhaarDetails"
                    }
                },
                {
                    $unwind: {
                        path: "$aadhaarDetails",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "banks",
                        localField: "applicant._id",
                        foreignField: "borrowerId",
                        as: "bank"
                    }
                },
                {
                    $unwind: {
                        path: "$bank",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: "disbursals",
                        let: { pan: "$pan" },
                        pipeline: [
                            { $match: { isDisbursed: true } },
                            { $match: { $expr: { $eq: ["$pan", "$$pan"] } } },
                            { $sort: { disbursedAt: 1 } },
                            { $project: { _id: 0, disbursedAt: 1 } }
                        ],
                        as: "disbursedDates"
                    }
                },
                {
                    $addFields: {
                        status: {
                            $let: {
                                vars: {
                                    index: {
                                        $indexOfArray: ["$disbursedDates.disbursedAt", "$disbursedAt"]
                                    }
                                },
                                in: {
                                    $cond: {
                                        if: { $eq: ["$$index", 0] },
                                        then: "FRESH",
                                        else: { $concat: ["REPEAT-", { $toString: "$$index" }] }
                                    }
                                }
                            }
                        }
                    }
                },

                {
                    $set: {
                        successfulPayments: {
                            $slice: [
                                {
                                    $sortArray: {
                                        input: { $ifNull: ["$paymentData.successfulPayments", []] },
                                        sortBy: { paymentDate: -1 }
                                    }
                                },
                                10
                            ]
                        },
                        "Collection Status": {
                            $cond: {
                                if: { $and: [{ $eq: ["$close.isActive", false] }, { $eq: ["$close.isClosed", true] }] },
                                then: "Closed",
                                else: {
                                    $cond: {
                                        if: {
                                            $eq: [{ $size: { $ifNull: ["$paymentData.successfulPayments", []] } }, 0]
                                        },
                                        then: "Active",
                                        else: {
                                            $concat: [
                                                "part-",
                                                {
                                                    $toString: { $size: { $ifNull: ["$paymentData.successfulPayments", []] } }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,

                        "Loan No": "$loanNo",
                        Name: {
                            $trim: {
                                input: {
                                    $concat: [
                                        "$lead.fName",
                                        {
                                            $cond: {
                                                if: { $gt: [{ $strLenCP: { $ifNull: ["$lead.mName", ""] } }, 0] },
                                                then: { $concat: [" ", "$lead.mName"] },
                                                else: ""
                                            }
                                        },
                                        " ",
                                        "$lead.lName"
                                    ]
                                }
                            }
                        },

                        Status: "$status",
                        PAN: "$lead.pan",
                        Mobile: "$lead.mobile",
                        AlternateMobile: "$lead.alternateMobile",
                        "Personal Email": "$lead.personalEmail",
                        "Office Email": "$lead.officeEmail",
                        Pincode: "$aadhaarDetails.address.pc",
                        State: "$aadhaarDetails.address.state",
                        "Sanctioned Amount": "$cam.loanRecommended",
                        "PF Amount": "$cam.netAdminFeeAmount",
                        "PF": "$cam.adminFeePercentage",
                        "Disbursed Amount": "$cam.netDisbursalAmount",
                        "Tenure": "$cam.eligibleTenure",
                        ROI: "$cam.roi",
                        "Repayment Amount": "$cam.repaymentAmount",
                        "Bank Name": "$bank.bankName",
                        "IFSC": "$cam.ifscCode",
                        "Bank Name": "$cam.bankAccNo",
                        "Beneficiary Name": "$cam.beneficiaryName",
                        "Screened By": {
                            $trim: {
                                input: {
                                    $concat: [
                                        "$leadRecommendedBy.fName",
                                        " ",
                                        "$leadRecommendedBy.lName"
                                    ]
                                }
                            }
                        },
                        "Sanctioned By": {
                            $trim: {
                                input: {
                                    $concat: [
                                        "$approvedBy.fName",
                                        " ",
                                        "$approvedBy.lName"
                                    ]
                                }
                            }
                        },
                        "DOR": {
                            $dateToString: {
                                format: "%d %b %Y",
                                date: "$cam.repaymentDate"
                            }
                        },
                        "DOD": {
                            $dateToString: {
                                format: "%d %b %Y",
                                date: "$disbursedAt"
                            }
                        },
                        "Payment Date": {
                            $dateToString: {
                                format: "%d %b %Y",
                                date: {
                                    $arrayElemAt: [
                                        "$successfulPayments.paymentDate",
                                        0
                                    ]
                                }
                            }
                        },
                        "Paid Amount": {
                            $ifNull: [
                                "$paymentData.totalReceivedAmount",
                                0
                            ]
                        },
                        "Credited Bank": {
                            $ifNull: [
                                {
                                    $arrayElemAt: [
                                        "$successfulPayments.bankName",
                                        0
                                    ]
                                },
                                ""
                            ]
                        },
                        "Account Remarks": {
                            $ifNull: [
                                {
                                    $arrayElemAt: [
                                        "$successfulPayments.accountRemarks",
                                        0
                                    ]
                                },
                                ""
                            ]
                        },
                        Status: "$status"
                    }
                }
            ])


        if (!collectionReportsData.length) {
            console.log("No data found.")
            return []
        };

        return collectionReportsData;
    } catch (error) {
        console.error("Error generating report:", error);
    }
};
