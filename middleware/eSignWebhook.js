import moment from "moment";
import Lead from "../models/Leads";

export const eSignWebhook = async (req, res, next) => {
    const data = req.body;
    const time = moment().format("DD/MM/YYYY HH:mm:ss")

    if (data.responseCode === "EUN951") {
        const lead = await Lead.findOne({ referenceId: data.referenceId });
        logs = await postLogs(
            lead._id,
            `ESIGN FAILED BY THE CUSTOMER ${time}`,
            `${lead.fName}${lead.mName && ` ${lead.mName}`}${
                lead.lName && ` ${lead.lName}`
            }`,
            `Esign failed because UID or name did not match`
        );
    }

    // Check if the document is signed
    if (data["signers-info"].status !== "SIGNED") {
        return res.status(400).json({ error: "Document not signed!" });
    }

    // Store the transaction ID in the request for further use
    req.transactionId = data["signers-info"].transactionId; // Add relevant data to req

    // Pass control to the next middleware/handler
    next();
};
