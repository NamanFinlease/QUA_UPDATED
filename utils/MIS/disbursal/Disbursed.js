import Disbursal from "../../../models/Disbursal.js";
import CamDetails from "../../../models/CAM.js";
import Bank from "../../../models/ApplicantBankDetails.js";
import { formatFullName } from "../../nameFormatter.js";
import AadhaarDetails from "../../../models/AadhaarDetails.js";
import moment from "moment-timezone"


// export const exportDisbursedData = async () => {

//     const formatDate = date => date ? moment(date).tz("Asia/Kolkata").format("DD MMM YYYY") : "N/A";

//     console.log('report ',moment().format("DD/MM/YYYY HH:mm:ss"))
//     try {
//         const disbursals = await Disbursal.find({
//             isDisbursed: true,
//         })
//             .populate({
//                 path: "sanction",
//                 populate: [
//                     {
//                         path: "application",
//                         populate: [
//                             {
//                                 path: "applicant",
//                             },
//                             {
//                                 path: "lead",
//                                 populate: [
//                                     {
//                                         path: "recommendedBy",
//                                         // path:"CamDetails"
//                                     },
//                                 ],
//                             },
//                             {
//                                 path: "recommendedBy",
//                             },
//                         ],
//                     },
//                     {
//                         path: "approvedBy",
//                     },
//                 ],
//             })
//             .lean();

//             console.log('report 1',disbursals.length,moment().format("DD/MM/YYYY HH:mm:ss"))
            
//             if (disbursals.length === 0) {
//                 console.log("No data found.");
//                 return;
//             }
//             console.log('report 2')

//         const leadIds = disbursals.map(d => d.sanction.application?.lead?._id);
//         const aadhaarNumbers = disbursals.map(d => d.sanction.application?.lead?.aadhaar);
//         const loanNumbers = disbursals.map(d => d.loanNo);

//         console.log('report 3',moment().format("DD/MM/YYYY HH:mm:ss"))
//         const [cams, aadhaars, banks, disbursedDates] = await Promise.all([
//             CamDetails.find({ leadId: { $in: leadIds } }).lean(),
//             AadhaarDetails.find({ uniqueId: { $in: aadhaarNumbers } }).lean(),
//             Bank.find({ borrowerId: { $in: disbursals.map(d => d.sanction.application.applicant) } }).lean(),
//             Disbursal.find({ loanNo: { $in: loanNumbers }, isDisbursed: true }, { loanNo: 1, disbursedAt: 1 }).lean(),
//         ]);
        
//         console.log('report 4',moment().format("DD/MM/YYYY HH:mm:ss"))
//         // Create lookup maps for fast access
//         const camMap = Object.fromEntries(cams.map(cam => [cam.leadId, cam]));
//         const aadhaarMap = Object.fromEntries(aadhaars.map(a => [a.uniqueId, a]));
//         const bankMap = Object.fromEntries(banks.map(b => [b.borrowerId, b]));

//         const disbursedData = disbursals.map(disbursed => {
//             const { sanction, loanNo, amount, utr, payableAccount, disbursedAt } = disbursed;
//             const application = sanction?.application;
//             const lead = application?.lead;
//             const applicant = application?.applicant;
//             const approvedBy = sanction?.approvedBy;

//             if (!lead || ["IUUpk1335L", "AVZPC6217D", "IJXPD6084F", "HKCPK6182A", "DVWPG0881D"].includes(lead.pan)) {
//                 return null;
//             }

//             const cam = camMap[lead._id?.toString()];
//             const aadhaarDetails = aadhaarMap[lead.aadhaar];
//             const bank = bankMap[applicant?._id];

//             // Determine loan status (FRESH / REPEAT)
//             const loanDisbursalDates = disbursedDates
//                 .filter(d => d.loanNo === loanNo)
//                 .sort((a, b) => new Date(a.disbursedAt) - new Date(b.disbursedAt));
//             const status = loanDisbursalDates.length === 1 ? "FRESH" :
//                 `REPEAT-${loanDisbursalDates.findIndex(d => d.disbursedAt.toISOString() === disbursedAt.toISOString())}`;

//                 // Format dates
            
//             const createdDate = formatDate(lead?.createdAt);
//             const disbursedDate = formatDate(disbursedAt);
//             const repaymentDate = formatDate(cam?.repaymentDate);

//             let data = {
//                 "Lead Created": createdDate || "N/A",
//                 "Disbursed Date": disbursedDate || "N/A",
//                 "Repayment Date": repaymentDate,
//                 "Loan No": disbursed.loanNo || "N/A",
//                 Name: `${lead.fName || ""} ${lead.mName || ""} ${lead.lName || ""
//                     }`.trim(),
//                 PAN: lead.pan || "N/A",
//                 Aadhaar: lead.aadhaar
//                     ? `${String(lead.aadhaar)}`
//                     : "N/A",
//                 Mobile: lead.mobile,
//                 "Alternate Mobile": lead.alternateMobile,
//                 Email: lead.personalEmail,
//                 "Office Email": lead.officeEmail,
//                 "Sanctioned Amount": cam?.loanRecommended || 0,
//                 ROI: cam?.roi,
//                 Tenure: cam?.eligibleTenure,
//                 Status: status,
//                 "Interest Amount":
//                     Number(cam?.repaymentAmount) -
//                     Number(cam?.loanRecommended),
//                 "Disbursed Amount": disbursed.amount || 0,
//                 "Repayment Amount": cam?.repaymentAmount || 0,
//                 PF: cam?.netAdminFeeAmount || 0,
//                 "PF%": cam?.adminFeePercentage || 0,
//                 "Beneficiary Bank Name": bank?.bankName || "N/A",
//                 "Beneficiary Name": bank?.beneficiaryName || "N/A",
//                 accountNo: bank?.bankAccNo || "N/A",
//                 IFSC: bank?.ifscCode || "N/A",
//                 "Disbursed Bank": disbursed.payableAccount || "N/A",
//                 UTR: disbursed.utr
//                     ? `${String(disbursed.utr)}`
//                     : "N/A",
//                 Screener: formatFullName(
//                     lead.recommendedBy.fName,
//                     lead.recommendedBy.mName,
//                     lead.recommendedBy.lName
//                 ),
//                 "Credit Manager": formatFullName(
//                     application.recommendedBy.fName,
//                     application.recommendedBy.mName,
//                     application.recommendedBy.lName
//                 ),
//                 "Sanctioned By": formatFullName(
//                     approvedBy.fName,
//                     approvedBy.mName,
//                     approvedBy.lName
//                 ),
//                 "Residence Address":
//                     sanction.application.applicant.residence.address,
//                 "Residence City":
//                     sanction.application.applicant.residence.city,
//                 "Residence State":
//                     aadhaarDetails?.details?.address?.state ?? "",
//                 "Residence Pincode":
//                     sanction.application.applicant.residence.pincode,
//                 "Company Name":
//                     sanction.application.applicant.employment
//                         .companyName,
//                 "Company Address":
//                     sanction.application.applicant.employment
//                         .companyAddress,
//                 "Company State":
//                     sanction.application.applicant.employment.state,
//                 "Company City":
//                     sanction.application.applicant.employment.city,
//                 "Company Pincode":
//                     sanction.application.applicant.employment.pincode,
//             };

//             // console.log('disbursed report bank',data)

//             return data;

//         }).filter(entry => entry !== null);

//         return disbursedData

       
//     } catch (error) {
//         console.error(
//             "Error generating Excel file:",
//             error
//             // error.stack
//         );
//     }
// };



export const exportDisbursedData = async () => {
    try {
        const formatDate = (date) =>
            date ? moment(date).tz("Asia/Kolkata").format("DD MMM YYYY") : "N/A";

        console.log("Start Time:", moment().format("DD/MM/YYYY HH:mm:ss"));

        // Fetch disbursed records with necessary fields
        const disbursals = await Disbursal.find(
            { isDisbursed: true },
            { loanNo: 1, amount: 1,pan:1, utr: 1, payableAccount: 1, disbursedAt: 1, sanction: 1 }
        )
            .populate({
                path: "sanction",
                select: "application approvedBy",
                populate: [
                    {
                        path: "application",
                        select: "applicant lead recommendedBy",
                        populate: [
                            {
                                path: "lead",
                                select: "fName mName lName pan aadhaar mobile alternateMobile personalEmail officeEmail recommendedBy createdAt",
                                populate: { path: "recommendedBy", select: "fName mName lName" },
                            },
                            {
                                path: "recommendedBy", // <-- Explicitly populating application.recommendedBy
                                select: "fName mName lName",
                            },
                            {
                                path: "applicant", // <-- Explicitly populating application.applicant
                                select: "residence employment",
                            },
                        ],
                    },
                    {
                        path: "approvedBy",
                        select: "fName mName lName",
                    },
                ],
            })
            .lean();

        console.log("Fetched Disbursals:", disbursals.length, moment().format("DD/MM/YYYY HH:mm:ss"));

        if (!disbursals.length) return console.log("No data found.");

        // Extract necessary IDs for batch queries
        const leadIds = disbursals.map((d) => d.sanction?.application?.lead?._id).filter(Boolean);
        const aadhaarNumbers = disbursals.map((d) => d.sanction?.application?.lead?.aadhaar).filter(Boolean);
        const borrowerIds = disbursals.map((d) => d.sanction?.application?.applicant).filter(Boolean);
        const loanNumbers = disbursals.map((d) => d.loanNo).filter(Boolean);

        // Fetch related data in parallel
        const [cams, aadhaars, banks, disbursedDates] = await Promise.all([
            CamDetails.find({ leadId: { $in: leadIds } }, "leadId loanRecommended roi eligibleTenure repaymentAmount netAdminFeeAmount adminFeePercentage repaymentDate").lean(),
            AadhaarDetails.find({ uniqueId: { $in: aadhaarNumbers } }, "uniqueId details.address.state").lean(),
            Bank.find({ borrowerId: { $in: borrowerIds } }, "borrowerId bankName beneficiaryName bankAccNo ifscCode").lean(),
            Disbursal.find({ loanNo: { $in: loanNumbers }, isDisbursed: true }, "loanNo disbursedAt pan").lean(),
        ]);

        console.log("Fetched Related Data:", moment().format("DD/MM/YYYY HH:mm:ss"));

        // Create lookup maps for fast access
        const camMap = Object.fromEntries(cams.map((cam) => [cam.leadId.toString(), cam]));
        const aadhaarMap = Object.fromEntries(aadhaars.map((a) => [a.uniqueId, a]));
        const bankMap = Object.fromEntries(banks.map((b) => [b.borrowerId.toString(), b]));
        const disbursedMap = disbursedDates.reduce((acc, d) => {
            // console.log('print d',d)
            acc[d.pan] = acc[d.pan] || [];
            acc[d.pan].push(d);
            return acc;
        }, {});

        // Process and map data efficiently
        const disbursedData = disbursals.map((disbursed) => {
            // console.log('disbursed',disbursed)
            const { sanction, loanNo, amount,pan, utr, payableAccount, disbursedAt } = disbursed;
            const application = sanction?.application;
            const lead = application?.lead;
            const applicant = application?.applicant;
            const approvedBy = sanction?.approvedBy;

            if (!lead || ["IUUPK1335L", "AVZPC6217D", "IJXPD6084F", "HKCPK6182A", "DVWPG0881D"].includes(lead.pan)) {
                return null;
            }

            const cam = camMap[lead._id?.toString()];
            const aadhaarDetails = aadhaarMap[lead.aadhaar];
            const bank = bankMap[applicant?._id?.toString()];

            // Determine loan status
            const loanDisbursalDates = (disbursedMap[pan] || []).sort(
                (a, b) => new Date(a.disbursedAt) - new Date(b.disbursedAt)
            );
            if(disbursed.pan === "AOWPK2925C"){

                console.log('loan disburse dates',application,aadhaarDetails)
            }
            const status =
            loanDisbursalDates.findIndex((d) => d.disbursedAt.toISOString() === disbursedAt.toISOString()) === 0
                    ? "FRESH"
                    : `REPEAT-${loanDisbursalDates.findIndex((d) => d.disbursedAt.toISOString() === disbursedAt.toISOString())}`;

            // Prepare structured data
            return {
                "Lead Created": formatDate(lead.createdAt),
                "Disbursed Date": formatDate(disbursedAt),
                "Repayment Date": formatDate(cam?.repaymentDate),
                "Loan No": loanNo || "",
                Name: [lead.fName, lead.mName, lead.lName].filter(Boolean).join(" "),
                PAN: lead.pan || "",
                Aadhaar: lead.aadhaar ? `${String(lead.aadhaar)}` : "",
                Mobile: lead.mobile,
                "Alternate Mobile": lead.alternateMobile,
                Email: lead.personalEmail,
                "Office Email": lead.officeEmail,
                "Sanctioned Amount": cam?.loanRecommended || 0,
                ROI: cam?.roi,
                Tenure: cam?.eligibleTenure,
                Status: status,
                "Interest Amount": cam?.repaymentAmount ? cam.repaymentAmount - cam.loanRecommended : 0,
                "Disbursed Amount": amount || 0,
                "Repayment Amount": cam?.repaymentAmount || 0,
                PF: cam?.netAdminFeeAmount || 0,
                "PF%": cam?.adminFeePercentage || 0,
                "Beneficiary Bank Name": bank?.bankName || "",
                "Beneficiary Name": bank?.beneficiaryName || "",
                accountNo: bank?.bankAccNo || "",
                IFSC: bank?.ifscCode || "",
                "Disbursed Bank": payableAccount || "",
                UTR: utr ? `${String(utr)}` : "",
                Screener: formatFullName(lead?.recommendedBy?.fName, lead?.recommendedBy?.mName, lead?.recommendedBy?.lName),
                "Credit Manager": formatFullName(application?.recommendedBy?.fName, application?.recommendedBy?.mName, application?.recommendedBy?.lName),
                "Sanctioned By": formatFullName(approvedBy?.fName, approvedBy?.mName, approvedBy?.lName),
                "Residence Address": applicant?.residence?.address || "",
                "Residence City": applicant?.residence?.city || "",
                "Residence State": aadhaarDetails?.details?.address?.state || "",
                "Residence Pincode": applicant?.residence?.pincode || "",
                "Company Name": applicant?.employment?.companyName || "",
                "Company Address": applicant?.employment?.companyAddress || "",
                "Company State": applicant?.employment?.state || "",
                "Company City": applicant?.employment?.city || "",
                "Company Pincode": applicant?.employment?.pincode || "",
            };
        }).filter(Boolean);

        console.log("Processing Complete:", moment().format("DD/MM/YYYY HH:mm:ss"));

        return disbursedData;
    } catch (error) {
        console.error("Error generating report:", error);
    }
};



