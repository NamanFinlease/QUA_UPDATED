import asyncHandler from "../middleware/asyncHandler.js";
import axios from "axios";
import Lead from "../models/Leads.js";
import Documents from "../models/Documents.js";
import { uploadDocs } from "../utils/docsUploadAndFetch.js";
import { getFileBuffer } from "../utils/BSA.js";
import { postLogs } from "./logs.js";

// @desc BSA webhook for ScoreMe to send us a response if bank statement is analysed
// @route POST /api/bank/bsa/success
// @access Public
export const bsaWebhook = asyncHandler(async (req, res) => {
    const data = req.body;
    if (data.data && data.responseCode === "SRC001") {
        const lead = await Lead.findOne({ bsaRefId: data.data.referenceId });
        const docs = await Documents.findOne({ _id: lead.documents });

        const fileResponse = await getFileBuffer(data.data.excelUrl);

        const docsResult = await uploadDocs(docs, null, null, {
            rawFile: fileResponse,
            rawFileKey: "statementAnalyser",
            rawFileRemarks: `${lead.leadNo}`,
        });

        if (!docsResult.success) {
            res.status(400);
            throw new Error("Couldn't save the document!!");
        }
        return res.status(200).json({
            success: true,
            message: "Document signed and saved successfully.",
        });
    }
    return res.json({ success: true });
});
