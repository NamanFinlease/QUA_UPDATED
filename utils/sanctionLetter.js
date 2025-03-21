import handlebars from "handlebars";
import * as fs from "fs";
import path from "path";
import { dateFormatter } from "./dateFormatter.js";
import { fileURLToPath } from "url";
import moment from "moment-timezone";

export function sanctionLetter(
    sanctionDate,
    title,
    fullname,
    loanNo,
    pan,
    mobile,
    residenceAddress,
    stateCountry,
    camDetails
) {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const filePath = path.join(__dirname, "../config/sanction.html");
        const source = fs.readFileSync(filePath, "utf-8").toString();
        const template = handlebars.compile(source);

        let localDisbursedDate = moment
            .tz(camDetails?.disbursalDate, "UTC")
            .tz("Asia/Kolkata")
            .format("DD-MM-YYYY");

        let localRepaymentDate = moment
            .tz(camDetails?.repaymentDate, "UTC")
            .tz("Asia/Kolkata")
            .format("DD-MM-YYYY");

        let replacements = {
            sanctionDate: `${sanctionDate}`,
            title: `${title}`,
            fullname: `${fullname}`,
            loanNo: `${loanNo}`,
            pan: `${pan}`,
            residenceAddress: `${residenceAddress}`,
            stateCountry: `${stateCountry}`,
            mobile: `${mobile}`,
            loanAmount: `${new Intl.NumberFormat().format(
                camDetails?.loanRecommended
            )}`,
            roi: `${camDetails?.roi}`,
            disbursalDate: localDisbursedDate,
            repaymentAmount: `${new Intl.NumberFormat().format(
                camDetails?.repaymentAmount
            )}`,
            tenure: `${camDetails?.eligibleTenure}`,
            totalInterest: `${new Intl.NumberFormat().format(
                Number(camDetails?.repaymentAmount) -
                    Number(camDetails?.loanRecommended)
            )}`,
            repaymentDate: localRepaymentDate,
            penalInterest: 2,
            processingFee: `${new Intl.NumberFormat().format(
                camDetails?.netAdminFeeAmount
            )}`,

            disbursalAmount: `${new Intl.NumberFormat().format(
                camDetails?.netDisbursalAmount
            )}`,
            // repaymentCheques: `${camDetails?.details.repaymentCheques || "-"}`,
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

        let htmlToSend = template(replacements);

        // footer =
        //     "https://publicramlella.s3.ap-south-1.amazonaws.com/public_assets/Footer.jpg";
        // header =
        //     "https://publicramlella.s3.ap-south-1.amazonaws.com/public_assets/Header.jpg";
        return htmlToSend;
    } catch (error) {
        return {
            success: false,
            message: `"Error in adding the template" ${error.message}`,
        };
    }
}
