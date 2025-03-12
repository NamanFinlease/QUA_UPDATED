import Disbursal from "../../../models/Disbursal.js";
import CamDetails from "../../../models/CAM.js";
import Bank from "../../../models/ApplicantBankDetails.js";
import { formatFullName } from "../../nameFormatter.js";
import AadhaarDetails from "../../../models/AadhaarDetails.js";

export const exportDisbursedData = async () => {
    try {
        const disbursals = await Disbursal.find({
            isDisbursed: true,
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
            console.log("No data found.");
            return;
        }

        const data = (
            await Promise.all(
                disbursals.map(async (disbursed) => {
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
                    } = disbursed;
                    if (
                        !lead ||
                        [
                            "IUUpk1335L",
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
                    const aadhaarDetails = await AadhaarDetails.findOne({
                        uniqueId: lead.aadhaar,
                    });

                    // if(!aadhaarDetails){
                    //     return false
                    // }
                    const bank = await Bank.findOne({
                        borrowerId: disbursed.sanction.application.applicant,
                    });

                    const createdDate = leadCreated.toLocaleString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                    });

                    const disbursedDate = disbursed.disbursedAt.toLocaleString(
                        "en-US",
                        {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                            timeZone: "Asia/Kolkata",
                        }
                    );

                    // console.log('cam repay date',cam?.repaymentDate)
                    const repaymentDate = cam?.repaymentDate
                        ? cam?.repaymentDate.toLocaleString("en-US", {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                              timeZone: "Asia/Kolkata",
                          })
                        : null;

                    let data = {
                        "Lead Created": createdDate || "N/A",
                        "Disbursed Date": disbursedDate || "N/A",
                        "Repayment Date": repaymentDate,
                        "Loan No": disbursed.loanNo || "N/A",
                        Name: `${lead.fName || ""} ${lead.mName || ""} ${
                            lead.lName || ""
                        }`.trim(),
                        PAN: lead.pan || "N/A",
                        Aadhaar: lead.aadhaar
                            ? `${String(lead.aadhaar)}`
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
                        "Disbursed Amount": disbursed.amount || 0,
                        "Repayment Amount": cam?.repaymentAmount || 0,
                        PF: cam?.netAdminFeeAmount || 0,
                        "PF%": cam?.adminFeePercentage || 0,
                        "Beneficiary Bank Name": bank?.bankName || "N/A",
                        "Beneficiary Name": bank?.beneficiaryName || "N/A",
                        accountNo: bank?.bankAccNo || "N/A",
                        IFSC: bank?.ifscCode || "N/A",
                        "Disbursed Bank": disbursed.payableAccount || "N/A",
                        UTR: disbursed.utr
                            ? `${String(disbursed.utr)}`
                            : "N/A",
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
                            aadhaarDetails?.details?.address?.state ?? "",
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

                    // console.log('disbursed report bank',data)

                    return data;
                })
            )
        ).filter((entry) => entry !== null);

        return data;
    } catch (error) {
        console.error(
            "Error generating Excel file:",
            error
            // error.stack
        );
    }
};
