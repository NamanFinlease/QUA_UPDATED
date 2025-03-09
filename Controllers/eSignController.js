import asyncHandler from "../middleware/asyncHandler.js";
import axios from "axios";
import Lead from "../models/Leads.js";
import Documents from "../models/Documents.js";
import { uploadDocs } from "../utils/docsUploadAndFetch.js";
import Application from "../models/Applications.js";
import Sanction from "../models/Sanction.js";
import Disbursal from "../models/Disbursal.js";
import { postLogs } from "./logs.js";
import LeadStatus from "../models/LeadStatus.js";

export const initiate = async (formData) => {
    // Step-1: Initiate E-sign
    const eSignStepOne = await axios.post(
        "https://sm-kyc-sync-prod.scoreme.in/kyc/external/eSignFileUpload",
        formData,
        {
            headers: {
                clientId: process.env.SCOREME_CLIENT_ID,
                clientSecret: process.env.SCOREME_CLIENT_SECRET,
                "Content-Type": "application/pdf",
            },
        }
    );
    return eSignStepOne.data;
};

export const eSignStepTwo = async (referenceId) => {
    // Step-2
    const eSignStepTwo = await axios.get(
        `https://sm-kyc-sync-prod.scoreme.in/kyc/external/getkycrequestresponse?referenceId=${referenceId}`,
        {
            headers: {
                clientId: process.env.SCOREME_CLIENT_ID,
                clientSecret: process.env.SCOREME_CLIENT_SECRET,
            },
        }
    );
    return eSignStepTwo.data;
};

export const eSignStepThree = async (leadId, fullName, aadhaar, url) => {
    // Step-3
    const eSignStepThree = await axios.post(
        "https://sm-kyc-sync-prod.scoreme.in/kyc/external/customersAadhaareSign",
        {
            task: "url",
            callbackUrl: "google.com",
            uid: `${aadhaar}`,
            inputFile: `${url}`,
            name: `${fullName}`,
            multiPages: "true",
            signaturePosition: "bottom-Left",
            pageNo: "all",
            signatureType: "aadhaaresign",
            xCoordinate: "10",
            yCoordinate: "10",
            height: "100",
            width: "40",
        },
        {
            headers: {
                clientId: process.env.SCOREME_CLIENT_ID,
                clientSecret: process.env.SCOREME_CLIENT_SECRET,
                "Content-Type": "application/json",
            },
        }
    );
    const lead = await Lead.findOneAndUpdate(
        { _id: leadId },
        { referenceId: eSignStepThree.data.data.referenceId },
        { new: true }
    );

    if (!lead) {
        res.status(404);
        throw new Error({ success: false, message: "Lead not found." });
    }
    return eSignStepThree.data;
};

export const eSignStepFour = async (referenceId) => {
    // Step-4
    const eSignStepFour = await axios.get(
        `https://sm-kyc-sync-prod.scoreme.in/kyc/external/getkycrequestresponse?referenceId=${referenceId}`,
        {
            headers: {
                clientId: process.env.SCOREME_CLIENT_ID,
                clientSecret: process.env.SCOREME_CLIENT_SECRET,
            },
        }
    );
    return eSignStepFour.data;
};

// @desc Esign webhook for Digitap to send us a response if doc is esigned
// @route POST /api/sanction/esign/success
// @access Public
export const eSignWebhook = asyncHandler(async (req, res) => {
    const data = req.body;
    if (data.data.dscData && Object.keys(data.data.dscData).length > 0) {
        const time = new Date();
        const response = await getDoc(data.referenceId, data, time);
        console.log('esign webhook ',response)
        if (!response.success) {
            res.status(400);
            throw new Error(response.message);
        }
        return res.status(200).json({
            success: true,
            message: "Document signed and saved successfully.",
        });
    }
    return res.json({ success: true });
});

export const getDoc = async (referenceId, data, time) => {
    try {
        const lead = await Lead.findOne({ referenceId: referenceId });
        const docs = await Documents.findOne({ _id: lead.documents });

        const eSignStepfive = await axios.get(data.data.result.esignedFile, {
            responseType: "arraybuffer", // Important to preserve the binary data
        });

        const application = await Application.findOne({ lead: lead._id });
        const sanction = await Sanction.findOneAndUpdate(
            { application: application._id },
            { eSigned: true, eSignPending: false },
            { new: true }
        );

        // Use the utility function to upload the PDF buffer
        const result = await uploadDocs(docs, null, null, {
            rawPdf: eSignStepfive.data,
            rawPdfKey: "sanctionLetter",
            rawPdfRemarks: sanction.loanNo,
        });

        console.log('upload docs 1')
        if (!result) {
            return { success: false, message: "Failed to upload PDF." };
        }
        console.log('upload docs 2')
        
        if (!sanction) {
            return { success: false, message: "Sanction Esign failed!!" };
        }
        console.log('upload docs 3')
        
        const disbursal = await Disbursal.findOneAndUpdate(
            { loanNo: sanction.loanNo },
            { sanctionESigned: true }
        );
        console.log('upload docs 4')
        
        if (!disbursal) {
            return { success: false, message: "Disbursal Esign failed!!" };
        }
        console.log('upload docs 5')
        logs = await postLogs(
            lead._id,
            `Sanction Letter eSigned on ${time}`,
            `${lead.fName}${lead.mName && ` ${lead.mName}`}${
                lead.lName && ` ${lead.lName}`
            }`,
            `Sanction Letter eSgined by ${lead.fName}${
                lead.mName && ` ${lead.mName}`
            }${lead.lName && ` ${lead.lName}`}`
        );

        // update leadStatus
        await LeadStatus.findByIdAndUpdate(lead._id, {
            stage : "SANCTION",
            subStage : "SANCTION LETTER E-SIGNED"
        })

        return {
            success: true,
            message: "File uploaded.",
        };
    } catch (error) {
        console.log(error.data);
    }
};
