import Disbursal from "../../../models/Disbursal.js";
import CamDetails from "../../../models/CAM.js";
import Bank from "../../../models/ApplicantBankDetails.js";
import { formatFullName } from "../../nameFormatter.js";
import { getTodayRange } from "../../dataChange.js";

// Function to extract data and generate Excel
export const exportNewDisbursals = async () => {
    try {
        const { startOfDay, endOfDay } = getTodayRange();

        // Query the database
        const disbursals = await Disbursal.find({
            disbursalManagerId: null,
            isRecommended: { $ne: true },
            isApproved: { $ne: true },
            sanctionESigned: { $eq: true },
            updatedAt: { $gte: startOfDay, $lte: endOfDay },
        })
            .populate({
                path: "sanction",
                populate: [
                    {
                        path: "application",
                        populate: [
                            {
                                path: "applicant",
                            },
                            {
                                path: "lead",
                                populate: [
                                    {
                                        path: "recommendedBy",
                                        // path:"CamDetails"
                                    },
                                ],
                            },
                            {
                                path: "recommendedBy",
                            },
                        ],
                    },
                    {
                        path: "approvedBy",
                    },
                ],
            })
            .lean();

        if (disbursals.length === 0) {
            console.log("No data found for today.");
            return;
        }

        // Format data for Excel
        const data = (
            await Promise.all(
                disbursals.map(async (disburse) => {
                    const {
                        sanction,
                        sanction: {
                            application,
                            application: {
                                lead,
                                lead: {
                                    fName,
                                    mName,
                                    lName,
                                    createdAt: leadCreated,
                                    recommendedBy: leadRecommendedBy,
                                } = {},
                                recommendedBy: applicationRecommendedBy,
                            } = {},
                            approvedBy,
                        } = {},
                    } = disburse;
                    if (
                        !lead ||
                        [
                            "AVZPC6217D",
                            "IJXPD6084F",
                            "HKCPK6182A",
                            "DVWPG0881D",
                        ].includes(lead.pan)
                    )
                        return null;

                    const cam = await CamDetails.findOne({
                        leadId: lead._id.toString(),
                    });
                    const bank = await Bank.findOne({
                        borrowerId: disburse.sanction.application.applicant,
                    });

                    const createdDate = leadCreated.toLocaleString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                    });

                    const repaymentDate = cam?.repaymentDate.toLocaleString(
                        "en-US",
                        {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                            timeZone: "Asia/Kolkata",
                        }
                    );

                    return {
                        "Lead Created": createdDate || "N/A",
                        "Repayment Date": repaymentDate,
                        "Loan No": disburse.loanNo || "N/A",
                        Name: `${lead.fName || ""} ${lead.mName || ""} ${
                            lead.lName || ""
                        }`.trim(),
                        PAN: lead.pan || "N/A",
                        Aadhaar: lead.aadhaar
                            ? `'${String(lead.aadhaar)}`
                            : "N/A",
                        Mobile: lead.mobile,
                        "Alternate Mobile": lead.alternateMobile,
                        Email: lead.personalEmail,
                        "Office Email": lead.officeEmail,
                        "Sanctioned Amount": cam?.loanRecommended || 0,
                        ROI: cam?.roi,
                        Tenure: cam?.eligibleTenure,
                        "Interest Amount":
                            Number(cam?.repaymentAmount) -
                            Number(cam?.loanRecommended),
                        "Disbursal Amount": cam?.netDisbursalAmount || 0,
                        "Repayment Amount": cam?.repaymentAmount || 0,
                        PF: cam?.netAdminFeeAmount || 0,
                        "PF%": cam?.adminFeePercentage || 0,
                        "Beneficiary Bank Name": bank?.bankName || "N/A",
                        accountNo: bank?.bankAccNo || "N/A",
                        IFSC: bank?.ifscCode || "N/A",
                        Screener: formatFullName(
                            lead.recommendedBy.fName,
                            lead.recommendedBy.mName,
                            lead.recommendedBy.lName
                        ),
                        "Credit Manager": formatFullName(
                            application.recommendedBy.fName,
                            application.recommendedBy.mName,
                            application.recommendedBy.lName
                        ),
                        "Sanctioned By": formatFullName(
                            approvedBy.fName,
                            approvedBy.mName,
                            approvedBy.lName
                        ),
                        "Residence Address":
                            sanction.application.applicant.residence.address,
                        "Residence City":
                            sanction.application.applicant.residence.city,
                        "Residence State":
                            sanction.application.applicant.residence.state,
                        "Residence Pincode":
                            sanction.application.applicant.residence.pincode,
                        "Company Name":
                            sanction.application.applicant.employment
                                .companyName,
                        "Company Address":
                            sanction.application.applicant.employment
                                .companyAddress,
                        "Company State":
                            sanction.application.applicant.employment.state,
                        "Company City":
                            sanction.application.applicant.employment.city,
                        "Company Pincode":
                            sanction.application.applicant.employment.pincode,
                    };
                })
            )
        ).filter((entry) => entry !== null);

        return data;
    } catch (error) {
        console.error("Error generating Excel file:", error);
    }
};
