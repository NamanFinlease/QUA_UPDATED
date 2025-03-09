import {
    uploadFilesToS3,
    deleteFilesFromS3,
    generatePresignedUrl,
    generatePresignedUrlProfile,
    getBSADocBuffer
} from "../config/uploadFilesToS3.js";
import getMimeTypeForDocType from "../utils/getMimeTypeForDocType.js";
import Documents from "../models/Documents.js";
import axios from "axios";

export const uploadDocs = async (docs, files, remarks, options = {}) => {
    const {
        isBuffer = false,
        buffer,
        fieldName = "",
        rawFile = null,
        rawFileKey = "",
        rawFileRemarks = "",
    } = options;

    console.log('upload sanction check 1', options)

    // Prepare an array to store all upload promises
    // const uploadPromises = [];
    const singleDocUpdates = [];
    const multipleDocUpdates = {
        repaymentDocs: [],
        bankStatement: [],
        salarySlip: [],
        sanctionLetter: [],
        statementAnalyser: [],
        others: [],
    };
    console.log('upload sanction check 2', rawFile, rawFileKey)

    if (rawFile && rawFileKey) {
        console.log('upload sanction check 3')
        const name = `${rawFileKey}-${rawFileRemarks}`;
        let key;
        if (rawFileKey === "statementAnalyser") {
            key = `${docs.pan}/${rawFileKey}/${name}.xlsx`;
        } else {
            key = `${docs.pan}/${rawFileKey}/${name}.pdf`;
        }
        const res = await uploadFilesToS3(rawFile, key);
        multipleDocUpdates[rawFileKey].push({
            name: name,
            url: res.Key,
            remarks: rawFileRemarks,
        });
    }
    console.log('upload sanction check 4', fieldName)
    if (isBuffer && fieldName) {
        // Handle buffer
        const key = `${docs.pan}/${fieldName}-${Date.now()}.pdf`;

        // Check if the document type already exists in the lead's document.singleDocument array
        const existingDocIndex = docs.document.singleDocuments.findIndex(
            (doc) => doc.type === fieldName
        );

        console.log('upload sanction check 5')
        if (existingDocIndex !== -1) {
            // Delete the old file and upload the new file
            const oldFileKey =
                docs.document.singleDocuments[existingDocIndex].url;
            if (oldFileKey) {
                await deleteFilesFromS3(oldFileKey);
            }
            console.log('upload sanction check 6')
            // Upload the new file
            const res = await uploadFilesToS3(buffer, key);
            console.log('upload sanction check 7', res)
            docs.document.singleDocuments[existingDocIndex].url = res.Key;
        } else {
            console.log('upload sanction check 7.1',)
            // If document type does not exist, add it to the singleDocuments array
            const res = await uploadFilesToS3(buffer, key);
            singleDocUpdates.push({
                name: fieldName,
                type: fieldName,
                url: res.Key,
            });
        }
    } else {
        // Loop through each field in files and upload each file
        for (const fieldName in files) {
            const fileArray = files[fieldName];
            const isSingleType = [
                "aadhaarFront",
                "aadhaarBack",
                "eAadhaar",
                "panCard",
                "cibilReport",
            ].includes(fieldName);

            if (isSingleType) {
                const file = fileArray[0]; // Get the first file for each field
                const key = `${docs.pan}/${fieldName}-${Date.now()}-${file.originalname
                    }`; // Construct a unique S3 key
                // Check if the document type already exists in the lead's document array
                const existingDocIndex =
                    docs.document.singleDocuments.findIndex(
                        (doc) => doc.type === fieldName
                    );

                if (existingDocIndex !== -1) {
                    // Old file URL stored in document
                    const oldFileKey =
                        docs.document.singleDocuments[existingDocIndex].url;
                    if (oldFileKey) {
                        await deleteFilesFromS3(oldFileKey);
                    }
                    const res = await uploadFilesToS3(file.buffer, key);
                    // Update the existing document's URL
                    docs.document.singleDocuments[existingDocIndex].url =
                        res.Key;

                    docs.document.singleDocuments[existingDocIndex].remarks =
                        remarks;
                } else {
                    // If document type does not exist, add it to the singleDocuments array
                    const res = await uploadFilesToS3(file.buffer, key);
                    singleDocUpdates.push({
                        name: fieldName,
                        type: fieldName,
                        url: res.Key,
                        remarks,
                    });
                }
            } else {
                // For multipleDocuments, upload each file sequentially to maintain order
                for (const [index, file] of fileArray.entries()) {
                    // Get the current count of documents for this field in the database
                    const existingDocsCount =
                        docs.document.multipleDocuments[fieldName]?.length || 0;

                    const name = `${fieldName}_${existingDocsCount + index + 1
                        }`;
                    const key = `${docs.pan
                        }/${fieldName}/${fieldName}-${Date.now()}-${file.originalname
                        }`;
                    const fileRemark = Array.isArray(remarks)
                        ? remarks[index]
                        : remarks; // Get corresponding remark for each file

                    const res = await uploadFilesToS3(file.buffer, key);
                    multipleDocUpdates[fieldName].push({
                        name: name,
                        url: res.Key,
                        remarks: fileRemark,
                    });
                }
            }
        }
    }

    console.log('upload sanction check 8',)
    // Add single document updates to the lead document
    if (singleDocUpdates.length > 0) {
        docs.document.singleDocuments.push(...singleDocUpdates);
    }

    // Add multiple document updates to the lead document
    for (const [field, document] of Object.entries(multipleDocUpdates)) {
        if (document.length > 0) {
            docs.document.multipleDocuments[field].push(...document);
        }
    }
    console.log('upload sanction check 8',)

    // Use findByIdAndUpdate to only update the document field
    const updatedDocs = await Documents.findByIdAndUpdate(
        docs._id,
        { document: docs.document },
        { new: true, runValidators: false } // Disable validation for other fields
    );
    console.log('upload sanction check 9',)

    if (!updatedDocs) {
        return { success: false };
    }
    console.log('upload sanction check 10',)
    return { success: true };
};

export const getBSADocs = async (docType, url, key) => {

    try {

        const mimeType = getMimeTypeForDocType(url, docType);

        // Generate a pre-signed URL for this specific document
        // const preSignedUrl = generatePresignedUrl(url, mimeType);
        const buffer = await getBSADocBuffer(process.env.AWS_BUCKET_NAME, url)

        console.log('buffer', buffer)


        // const rawData = await axios.get(preSignedUrl)
        // let buffer =  Buffer.from(rawData.data)

        return { success: true, buffer }
    } catch (error) {
        console.log('error', error)
        return { success: false, message: "error in getting buffer" }

    }



}

export const getDocs = async (docs, docType, docId) => {
    // Find the specific document based on docType
    let document;
    const isSingleType = [
        "aadhaarFront",
        "aadhaarBack",
        "eAadhaar",
        "panCard",
        "cibilReport",
        "sanctionLetter",
        "profileImage",
    ].includes(docType);

    console.log("docss---->", docs)
    if (isSingleType) {
        document = docs.document.singleDocuments.find(
            (doc) => doc.type === docType
        );
    }
    // if(docType ==="profileImage"){
    //     document = docs
    // }

    else {
        document = docs.document.multipleDocuments[docType]?.find(
            (doc) => doc._id.toString() === docId
        );
    }

    if (!document) {
        throw new Error(`Document of type ${docType} not found`);
    }

    const mimeType = getMimeTypeForDocType(document.url, docType);


    // Generate a pre-signed URL for this specific document

    const preSignedUrl = generatePresignedUrl(document.url, mimeType);


    return { preSignedUrl, mimeType };
};


export const getProfileDocs = async (docs, docType, docId) => {
    // Find the specific document based on docType
    let document;
    const isSingleType = [
        "aadhaarFront",
        "aadhaarBack",
        "eAadhaar",
        "panCard",
        "cibilReport",
        "sanctionLetter",
        "profileImage",
    ].includes(docType);

    console.log("docss---->", docs)
    if (isSingleType) {
        if (docType === "profileImage") {
            document = docs
        }
        else {
            document = docs.document.singleDocuments.find(
                (doc) => doc.type === docType
            );
        }

    } else {
        document = docs.document.multipleDocuments[docType]?.find(
            (doc) => doc._id.toString() === docId
        );
    }

    if (!document) {
        throw new Error(`Document of type ${docType} not found`);
    }

    const mimeType = getMimeTypeForDocType(document, docType);
    console.log("mime type--->", mimeType)

    // Generate a pre-signed URL for this specific document
    console.log("document---->", document)
    const preSignedUrl = generatePresignedUrlProfile(document, mimeType);


    return { preSignedUrl, mimeType };
};
