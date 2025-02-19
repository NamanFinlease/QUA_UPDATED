import asyncHandler from "../../middleware/asyncHandler.js";
import Documents from "../../models/Documents.js";
import { uploadDocs } from "../../utils/User/docsUploadAndFetch.js";
import User from "../../models/User/model.user.js"
import LoanApplication from "../../models/User/model.loanApplication.js";
import { postUserLogs } from "./controller.userLogs.js";    

export const uploadDocuments = asyncHandler(async (req, res) => {
    const userId = req.user._id

    const user = await User.findById(userId)
    if (!user) {
        return res.status(400).json({ message: "User not Found" })
    }
    const pan = user.PAN;
    const remarks = req.body.remarks;


    if (!req.files) {
        return res.status(400).json({ message: "No files uploaded" });
    }

    if (!pan) {
        return res.status(400).json({ message: "PAN is required" });
    }

    // Check if a document entry exists for the given PAN
    let docs = await Documents.findOne({ pan });
    if (!docs) {
        // Create a new document entry if it doesn't exist
        docs = await Documents.create({
            pan,
            document: { singleDocuments: [], multipleDocuments: {} },
        });
    }

    // Upload and update the documents
    const result = await uploadDocs(docs, req.files, remarks);

    if (!result.success) {
        return res.status(400).json({ message: "Failed to store documents." });
    }

    const loanDetails = await LoanApplication.findOne(
        { userId: userId, applicationStatus: "PENDING" }
    )

    if (!loanDetails) {
        return res.status(400).json({ message: "Loan Application not found" })
    }

    let progressStatus
    let previousJourney

    if (loanDetails.progressStatus == "EMPLOYMENT_DETAILS_SAVED") {
        progressStatus = "BANK_STATEMENT_FETCHED",
            previousJourney = "EMPLOYMENT_DETAILS_SAVED"
    }
    if (loanDetails.progressStatus == "BANK_STATEMENT_FETCHED") {
        progressStatus = "DOCUMENTS_SAVED",
            previousJourney = "BANK_STATEMENT_FETCHED"
    }
    if (loanDetails.progressStatus != "EMPLOYMENT_DETAILS_SAVED" && loanDetails.progressStatus != "BANK_STATEMENT_FETCHED") {
        progressStatus = loanDetails.progressStatus,
            previousJourney = loanDetails.previousJourney
    }

    if (req.files.bankStatement) {

        if (loanDetails.progressStatus == "EMPLOYMENT_DETAILS_SAVED") {
            progressStatus = "BANK_STATEMENT_FETCHED",
                previousJourney = "EMPLOYMENT_DETAILS_SAVED"
        }

        if (loanDetails.progressStatus != "EMPLOYMENT_DETAILS_SAVED" && loanDetails.progressStatus != "BANK_STATEMENT_FETCHED") {
            progressStatus = loanDetails.progressStatus,
                previousJourney = loanDetails.previousJourney
        }
    }


    if(req.files.bankStatement){
        const addDocs = await LoanApplication.findOneAndUpdate(
            { userId: userId, applicationStatus: "PENDING" },
            {
                $set: {
                    progressStatus: progressStatus,
                    previousJourney: previousJourney,
                    isBankStatementUploaded : true 
                }
            },
    
            {
                new: true,
                sort: { createdAt: -1 }
    
            }
        );
    
        if (!addDocs) {
            return res.status(400).json({ message: "Loan Application not updated" })
        }
        await postUserLogs(userId, `User upload ${Object.keys(req.files)[0]}`)
    
        return res.status(200).json({ message: "Documents uploaded successfully", status: addDocs.progressStatus });

    }
    const addDocs = await LoanApplication.findOneAndUpdate(
        { userId: userId, applicationStatus: "PENDING" },
        {
            $set: {
                progressStatus: progressStatus,
                previousJourney: previousJourney,
                isDocumentUploaded : true 
            }
        },

        {
            new: true,
            sort: { createdAt: -1 }

        }
    );

    if (!addDocs) {
        return res.status(400).json({ message: "Loan Application not updated" })
    }
    await postUserLogs(userId, `User upload ${Object.keys(req.files)[0]}`)

    return res.status(200).json({ message: "Documents uploaded successfully", status: addDocs.progressStatus });
});
