import asyncHandler from "../middleware/asyncHandler.js";
import Documents from "../models/Documents.js";
import Employee from "../models/Employees.js";
import Lead from "../models/Leads.js";
import FormData from "form-data";
import {
    getBanks,
    BSA,
    getBSAreport,
    saveAnalyzedBuffer,
} from "../utils/BSA.js";
import { postLogs } from "./logs.js";
import {
    uploadDocs,
    getDocs,
    getBSADocs,
} from "../utils/docsUploadAndFetch.js";
import mongoose from "mongoose";

// @desc Adding file documents to a lead
// @route PATCH /api/leads/docs/:id or /api/applications/docs/:id
// @access Private
export const addDocs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let employeeId;
    let bsaArray;

    const { accountNo, accountType, bankCode, remarks, bsaList } = req.body;

    let lead = await Lead.findById(id);
    if (!lead) {
        throw new Error("Lead not found");
    }
    if (lead.isRejected) {
        throw new Error("Lead already rejected"); // This error will be caught by the error handler
    }
    if (lead.isRecommended) {
        throw new Error("Lead already forwarded to Credit Manager"); // This error will be caught by the error handler
    }

    const docs = await Documents.findOne({ pan: lead.pan });

    if (req.activeRole === "screener" || req.activeRole === "creditManager") {
        employeeId = req.employee._id.toString();
    }

    if (!req.files) {
        res.status(400);
        throw new Error("No files uploaded");
    }

    if (req.activeRole === "screener") {
        console.log("bsaList", bsaList);

        bsaArray = bsaList ? bsaList.split(",") : null;
        // Validate Aadhaar document uploads, but only if they exist
        const aadhaarFrontUploaded =
            req.files.aadhaarFront && req.files.aadhaarFront.length > 0;
        const aadhaarBackUploaded =
            req.files.aadhaarBack && req.files.aadhaarBack.length > 0;
        const eAadhaarUploaded =
            req.files.eAadhaar && req.files.eAadhaar.length > 0;

        // Validation logic: Aadhaar files must follow either/or rule if uploaded
        if ((aadhaarFrontUploaded || aadhaarBackUploaded) && eAadhaarUploaded) {
            return res.status(400).json({
                message:
                    "You cannot upload both aadhaar documents and eAadhaar.",
            });
        }

        if (req.files?.bankStatement || bsaArray?.length > 0) {
            const buffers = [];
            const filenames = [];
            const bsaDocumentList = [];
            const statementIds = bsaArray
                ? bsaArray.map((id) => new mongoose.Types.ObjectId(id))
                : null;

            if (req.files?.bankStatement) {
                // Extract buffers and filenames
                req.files.bankStatement.forEach((file) => {
                    buffers.push(file.buffer);
                    filenames.push(file.originalname);
                });
            } else {
                let files = await Documents.aggregate([
                    {
                        $match: {
                            "document.multipleDocuments.bankStatement._id": {
                                $in: statementIds,
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0, // Exclude the main document _id if not needed
                            bankStatement: {
                                $filter: {
                                    input: "$document.multipleDocuments.bankStatement",
                                    as: "doc",
                                    cond: { $in: ["$$doc._id", statementIds] },
                                },
                            },
                        },
                    },
                ]);
                let docs = files[0].bankStatement;
                for (let doc of docs) {
                    bsaDocumentList.push(doc);
                    const extractedDoc = await getBSADocs(
                        "bankStatement",
                        doc.url
                    );

                    if (!extractedDoc.success) {
                        res.status(400);
                        return res.json(extractedDoc);
                    }

                    console.log("file", doc);
                    buffers.push(extractedDoc.buffer);
                }
            }

            // Prepare the 'data' object dynamically

            const data = {
                entityType: "Trust",
                bankCode: bankCode,
                accountType: accountType,
                accountNumber: accountNo,
                filePassword: {},
            };

            console.log("type of remarks", remarks.length > 0, remarks);

            // Check if remarks is a string or an array
            if (typeof remarks === "string" && !bsaArray) {
                // If remarks is a single string, assign it to all files
                filenames.forEach((fileName) => {
                    data.filePassword[fileName] = remarks;
                });
                console.log("String data: ", data);
            } else if (Array.isArray(remarks)) {
                // If remarks is an array, ensure the length matches the number of files
                if (remarks.length !== filenames.length) {
                    res.status(400);
                    throw new Error(
                        "The number of remarks must match the number of upload files."
                    );
                }

                // Assign each remark to the corresponding file
                filenames.forEach((fileName, index) => {
                    data.filePassword[fileName] = remarks[index];
                });
            } else if (bsaArray && bsaArray.length > 0) {
                for (let doc of bsaDocumentList) {
                    let key = doc.url.split("/")[2];
                    let baseName = key.split("-").slice(2).join("-");
                    console.log("bsa document list", baseName);
                    filenames.push(baseName);
                    data.filePassword[baseName] = doc.remarks;
                }
            } else {
                res.status(400);
                throw new Error("Remarks must be a string or an array.");
            }

            // prepare formData
            const formData = new FormData();
            buffers.forEach((buffer, index) => {
                const fileName = filenames[index];
                formData.append("file", buffer, fileName);
            });
            formData.append("data", JSON.stringify(data));

            const response = await BSA(formData, id);

            if (!response.success) {
                res.status(400);
                console.log("error res", response);
                throw new Error(response.message);
            }
            setTimeout(async () => {
                // console.log('responseeee',response)

                let bsaBuffer = await getBSAreport(
                    response.message.data.referenceId
                );
                let analiseBuffer = await saveAnalyzedBuffer(
                    response.message.data.referenceId,
                    bsaBuffer.excelUrl
                );
                console.log("buffer resssss", analiseBuffer);
            }, 70000);
        }

        // If only aadhaarFront and aadhaarBack are provided, or only eAadhaar or none, proceed
        if (
            aadhaarFrontUploaded ||
            (aadhaarBackUploaded && !eAadhaarUploaded) ||
            (eAadhaarUploaded &&
                !aadhaarFrontUploaded &&
                !aadhaarBackUploaded) ||
            (!aadhaarFrontUploaded && !aadhaarBackUploaded && !eAadhaarUploaded)
        ) {
            // Proceed with document upload
            const result = await uploadDocs(docs, req.files, remarks);
            if (!result) {
                res.status(400);
                throw new Error("Couldn't store documents.");
            }
        } else {
            return res.status(400).json({
                message:
                    "At least one of the Aadhaar documents or eAadhaar must be uploaded, or none.",
            });
        }
    } else {
        res.status(401);
        throw new Error("You can't upload documents.");
    }

    const employee = await Employee.findOne({ _id: employeeId });
    const logs = await postLogs(
        lead._id,
        bsaArray && bsaArray.length > 0
            ? "Document Sent for Analysis."
            : "ADDED DOCUMENTS",
        `${lead.fName}${lead.mName && ` ${lead.mName}`}${
            lead.lName && ` ${lead.lName}`
        }`,
        bsaArray && bsaArray.length > 0
            ? `Documents sent for analysis by ${employee.fName} ${employee.lName}`
            : `Added documents by ${employee.fName} ${employee.lName}`
    );
    let responseMsg =
        bsaArray && bsaArray.length > 0
            ? "File sent for analysis"
            : "file uploaded successfully";

    res.json({ message: responseMsg, logs });
});

// @desc Get the docs from a lead/application
// @route GET /api/leads/docs/:id or /api/applications/docs/:id
// @access Private
export const getDocuments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { docType } = req.query;
    const docId = req.query.docId;

    let lead = await Lead.findById(id);
    console.log(lead);

    if (!lead) {
        res.status(404);
        throw new Error("Lead not found!!!");
    }
    const docs = await Documents.findOne({ pan: lead.pan });
    console.log(docs);

    const result = await getDocs(docs, docType, docId);

    // Return the pre-signed URL for this specific document
    res.json({
        type: docType,
        url: result.preSignedUrl,
        mimeType: result.mimeType,
    });
});

export const getBankNames = asyncHandler(async (req, res) => {
    if (req.activeRole === "screener");
    {
        const response = await getBanks();
        return res.json(response.data);
    }
});
