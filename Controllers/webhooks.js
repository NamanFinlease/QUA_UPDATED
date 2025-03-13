import asyncHandler from "../middleware/asyncHandler.js";
import axios from "axios";
import Lead from "../models/Leads.js";
import Documents from "../models/Documents.js";
import { uploadDocs } from "../utils/docsUploadAndFetch.js";
import { getFileBuffer } from "../utils/BSA.js";
import { postLogs } from "./logs.js";
import moment from "moment";

// @desc BSA webhook for ScoreMe to send us a response if bank statement is analysed
// @route POST /api/bank/bsa/success
// @access Public
export const bsaWebhook = asyncHandler(async (req, res) => {
    const data = req.body;
    const time = moment().format("DD/MM/YYYY HH:mm:ss");
    let lead;
    if (data.data && data.responseCode === "SRC001") {
        lead = await Lead.findOne({ bsaRefId: data.data.referenceId });
        const docs = await Documents.findOne({ _id: lead.documents });

        const fileResponse = await getFileBuffer(data.data.excelUrl);

        const docsResult = await uploadDocs(docs, null, null, {
            rawFile: fileResponse,
            rawFileKey: "statementAnalyser",
            rawFileRemarks: `${lead.leadNo}`,
        });

        if (!docsResult.success) {
            const logs = await postLogs(
                lead._id,
                `Failed to analyse bankstatement.`,
                `${lead.fName}${lead.mName && ` ${lead.mName}`}${
                    lead.lName && ` ${lead.lName}`
                }`,
                `Documents sent for analysis by ${employee?.fName} ${employee?.lName}`
            );
            res.status(400);
            throw new Error("Couldn't save the document!!");
        }
        const logs = await postLogs(
            lead._id,
            `Bankstatement analyzed and saved successfully.`,
            `${lead.fName}${lead.mName && ` ${lead.mName}`}${
                lead.lName && ` ${lead.lName}`
            }`,
            `Documents sent for analysis by ${employee?.fName} ${employee?.lName}`
        );
        return res.status(200).json({
            success: true,
            message: "Bankstatement analyzed and saved successfully.",
        });
    }
    const logs = await postLogs(
        lead._id,
        `Failed to analyse.`,
        `${lead.fName}${lead.mName && ` ${lead.mName}`}${
            lead.lName && ` ${lead.lName}`
        }`,
        `Documents sent for analysis by ${employee?.fName} ${employee?.lName}`
    );
    return res.json({ success: false });
});
