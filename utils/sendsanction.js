import axios from "axios";
import { htmlToPdf } from "./htmlToPdf.js";
import { formatFullName } from "./nameFormatter.js";
import FormData from "form-data";
import { sanctionLetter } from "./sanctionLetter.js";
import {
    initiate,
    eSignStepTwo,
    eSignStepThree,
    eSignStepFour,
} from "../Controllers/eSignController.js";

export const generateSanctionLetter = async (
    subject,
    sanctionDate,
    title,
    loanNo,
    fullname,
    mobile,
    residenceAddress,
    stateCountry,
    camDetails,
    lead,
    docs
) => {
    try {
        const htmlToSend = sanctionLetter(
            sanctionDate,
            title,
            fullname,
            loanNo,
            lead.pan,
            mobile,
            residenceAddress,
            stateCountry,
            camDetails
        );

        // Convert the HTML to PDF
        const result = await htmlToPdf(docs, htmlToSend, "sanctionLetter");

        // Create form-data and append the PDF buffer
        const formData = new FormData();
        formData.append("files", Buffer.from(result.pdfBuffer), {
            filename: `sanction_${fullname}.pdf`,
            contentType: "application/pdf",
        });

        const stepOne = await initiate(formData);
        const stepTwo = await eSignStepTwo(stepOne.data.referenceId);
        const fullName = formatFullName(lead.fName, lead.mName, lead.lName);
        const stepThree = await eSignStepThree(
            lead._id.toString(),
            `${fullName}`,
            lead.aadhaar,
            stepTwo.data.file.directURL
        );
        const stepFour = await eSignStepFour(stepThree.data.referenceId);

        // const letter = new FormData();
        // letter.append("from", "credit@qualoan.com");
        // letter.append("to", `${lead.personalEmail}`);
        // letter.append("subject", `${subject}`);
        // letter.append(
        //     "html",
        //     `<p>
        //         Please verify and E-sign the sanction letter to
        //         acknowledge.${" "}
        //             ${stepFour.data.result.url}
        //     </p>`
        // );

        // Setup the options for the ZeptoMail API
        // const options = {
        //     method: "POST",
        //     url: "https://api.mailgun.net/v3/qualoan.com/messages",
        //     data: letter,
        //     headers: {
        //         accept: "application/json",
        //         authorization: `Basic ${process.env.MAILGUN_AUTH}`,
        //         ...formData.getHeaders(),
        //     },
        // };

        // Make the request to the ZeptoMail API
        // const response = await axios(options);
        // if (
        //     response.data.id !== "" ||
        //     response.data.id !== null ||
        //     response.data.id !== undefined
        // ) {
        //     return {
        //         success: true,
        //         message: "Sanction letter sent successfully",
        //     };
        // }

        // Setup the options for the ZeptoMail API
        const options = {
            method: "POST",
            url: "https://api.zeptomail.in/v1.1/email",
            headers: {
                accept: "application/json",
                authorization: `${process.env.ZOHO_APIKEY}`,
                "cache-control": "no-cache",
                "content-type": "application/json",
            },
            data: JSON.stringify({
                from: { address: "credit@qualoan.com" },
                to: [
                    {
                        email_address: {
                            address: lead.personalEmail,
                            name: fullname,
                        },
                    },
                ],
                subject: subject,
                htmlbody: `<p>
                        Please verify and E-sign the sanction letter to
                        acknowledge.${" "}
                            ${stepFour.data.result.url}
                    </p>`,
                // htmlbody: htmlToSend,
            }),
        };

        // Make the request to the ZeptoMail API
        const response = await axios(options);
        if (response.data.message === "OK") {
            return {
                success: true,
                message: "Sanction letter sent successfully",
            };
        }

        return {
            success: false,
            message: "Failed to send email",
        };
    } catch (error) {
        return {
            success: false,
            message: `"Error in ZeptoMail API" ${error.message}`,
        };
    }
};
