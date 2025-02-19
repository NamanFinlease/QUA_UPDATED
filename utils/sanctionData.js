import Sanction from "../models/Sanction.js";
import CamDetails from "../models/CAM.js";
import { dateFormatter, dateStripper } from "./dateFormatter.js";

export const getSanctionData = async (id) => {
    // Fetch Sanction and CAM details
    const sanction = await Sanction.findById(id).populate({
        path: "application",
        populate: [{ path: "applicant" }],
    });

    if (!sanction) {
        application = await Application.findById(id).populate("applicant");
        const camDetails = await CamDetails.findOne({
            leadId: application.lead,
        });

        // Stripping the time from the date to compare
        const sanctionDate = dateStripper(new Date());
        const disbursalDate = dateStripper(camDetails?.disbursalDate);

        // Date validation
        if (
            (application.sanctionDate &&
                application.sanctionDate > disbursalDate) || // Strip time from `sanctionDate`
            sanctionDate > disbursalDate
        ) {
            throw new Error(
                "Disbursal Date cannot be in the past. It must be the present date or future date!"
            );
        }

        // Create a response object with all common fields
        const response = {
            sanctionDate: sanctionDate,
            title: "Mr./Ms.",
            fullname: `${application.applicant.personalDetails.fName}${
                application.applicant.personalDetails.mName &&
                ` ${application.applicant.personalDetails.mName}`
            }${
                application.applicant.personalDetails.lName &&
                ` ${application.applicant.personalDetails.lName}`
            }`,
            loanNo: `${sanction.loanNo}`,
            pan: `${sanction.application.applicant.personalDetails.pan}`,
            residenceAddress: `${application.applicant.residence.address}, ${application.applicant.residence.city}`,
            stateCountry: `${application.applicant.residence.state}, India - ${application.applicant.residence.pincode}`,
            mobile: `${application.applicant.personalDetails.mobile}`,
            loanAmount: `${new Intl.NumberFormat().format(
                camDetails?.loanRecommended
            )}`,
            roi: `${camDetails?.roi}`,
            disbursalDate: dateFormatter(camDetails?.disbursalDate),
            repaymentAmount: `${new Intl.NumberFormat().format(
                camDetails?.repaymentAmount
            )}`,
            tenure: `${camDetails?.eligibleTenure}`,
            repaymentDate: dateFormatter(camDetails?.repaymentDate),
            penalInterest: Number(camDetails?.roi) * 2,
            processingFee: `${new Intl.NumberFormat().format(
                camDetails?.netAdminFeeAmount
            )}`,
            // repaymentCheques: `${camDetails?.repaymentCheques || "-"}`,
            // bankName: `${bankName || "-"}`,
            bouncedCharges: "1000",
            // annualPercentageRate: `${
            //     camDetails?.annualPercentageRate || "0"
            // }`,
        };

        return { application, camDetails, response };
    }

    const camDetails = await CamDetails.findOne({
        leadId: sanction.application.lead,
    });

    if (!sanction) {
        throw new Error("Sanction not found");
    }

    // Stripping the time from the date to compare
    const sanctionDate = dateStripper(new Date());
    const disbursalDate = dateStripper(camDetails?.disbursalDate);

    // Date validation
    if (
        (sanction.sanctionDate && sanction.sanctionDate > disbursalDate) || // Strip time from `sanctionDate`
        sanctionDate > disbursalDate
    ) {
        throw new Error(
            "Disbursal Date cannot be in the past. It must be the present date or future date!"
        );
    }

    // Create a response object with all common fields
    const response = {
        sanctionDate: sanctionDate,
        title: "Mr./Ms.",
        fullname: `${sanction.application.applicant.personalDetails.fName}${
            sanction.application.applicant.personalDetails.mName &&
            ` ${sanction.application.applicant.personalDetails.mName}`
        }${
            sanction.application.applicant.personalDetails.lName &&
            ` ${sanction.application.applicant.personalDetails.lName}`
        }`,
        loanNo: `${sanction.loanNo}`,
        pan: `${sanction.application.applicant.personalDetails.pan}`,
        residenceAddress: `${sanction.application.applicant.residence.address}, ${sanction.application.applicant.residence.city}`,
        stateCountry: `${sanction.application.applicant.residence.state}, India - ${sanction.application.applicant.residence.pincode}`,
        mobile: `${sanction.application.applicant.personalDetails.mobile}`,
        loanAmount: `${new Intl.NumberFormat().format(
            camDetails?.loanRecommended
        )}`,
        roi: `${camDetails?.roi}`,
        disbursalDate: dateFormatter(camDetails?.disbursalDate),
        repaymentAmount: `${new Intl.NumberFormat().format(
            camDetails?.repaymentAmount
        )}`,
        tenure: `${camDetails?.eligibleTenure}`,
        repaymentDate: dateFormatter(camDetails?.repaymentDate),
        penalInterest: Number(camDetails?.roi) * 2,
        processingFee: `${new Intl.NumberFormat().format(
            camDetails?.netAdminFeeAmount
        )}`,
        // repaymentCheques: `${camDetails?.repaymentCheques || "-"}`,
        // bankName: `${bankName || "-"}`,
        bouncedCharges: "1000",
        annualPercentage: `${
            ((Number(camDetails?.roi) / 100) *
                Number(camDetails?.eligibleTenure) +
                Number(camDetails?.adminFeePercentage) / 100) *
            (365 / Number(camDetails?.eligibleTenure)) *
            100
        }%`,
    };

    return { sanction, camDetails, response };
};
