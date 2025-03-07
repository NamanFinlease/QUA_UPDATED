import axios from "axios";
import Lead from "../models/Leads.js";
import { uploadDocs } from "./docsUploadAndFetch.js";
import Documents from "../models/Documents.js";

export const getBanks = async () => {
    try {
        // Make the API request
        const response = await axios.get(
            "https://sm-bsa.scoreme.in/bsa/external/getBankNames",
            {
                headers: {
                    ClientId: process.env.SCOREME_CLIENT_ID,
                    ClientSecret: process.env.SCOREME_CLIENT_SECRET,
                },
            }
        );
        if (response.data.responseCode !== "SRC001") {
            return { message: "Failed to fetch bank names" };
        }
        return response.data;
    } catch (error) {
        console.error("Error fetching bank names:", error);
        return { message: `${error}` };
    }
};

// Step 1: Upload Bank Statement
export const BSA = async (formData, id) => {
    try {
        // console.log(formData);
        const response = await axios.post(
            "https://sm-bsa.scoreme.in/bsa/external/uploadbankstatement/sgb",
            formData,
            {
                headers: {
                    ClientId: process.env.SCOREME_CLIENT_ID,
                    ClientSecret: process.env.SCOREME_CLIENT_SECRET,
                    // ...formData.getHeaders(), // Proper headers for FormData
                },
            }
        );

        if (response.data.responseCode === "SRS016") {
            await Lead.findOneAndUpdate(
                { _id: id },
                { $set: { bsaRefId: response.data.data.referenceId } },
                { new: true }
            );
            return { success: true, message: response.data };
        }
        return {
            success: false,
            message: response.data.responseMessage,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

// Step 2: Get BSA Report
export const getBSAreport = async (referenceId) => {

    try {
        const lead = await Lead.findOne({ bsaRefId: referenceId });
        const response = await axios.get(
            `https://sm-bsa.scoreme.in/bsa/external/getbsareport/?referenceId=${referenceId}`,
            {
                headers: {
                    ClientId: process.env.SCOREME_CLIENT_ID,
                    ClientSecret: process.env.SCOREME_CLIENT_SECRET,
                },
            }
        );

        if (response.data.responseCode === "SRC001") {
            return {
                success: true,
                message: response.data.responseMessage,
                jsonUrl: response.data.data.jsonUrl,
                excelUrl: response.data.data.excelUrl,
            };
        }
        return {
            success: false,
            message: response.data.responseMessage,
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

// Step 3: Merge BSA Reports
// export const mergeBSAReports = async (referenceIds) => {
//     try {
//         const response = await axios.post(
//             "https://sm-bsa.scoreme.in/bsa/external/mergebankstatement",

//             {
//                 referenceIds: referenceIds,
//             },
//             {
//                 headers: {
//                     ClientId: process.env.SCOREME_CLIENT_ID,
//                     ClientSecret: process.env.SCOREME_CLIENT_SECRET,
//                     "Content-Type": "application.json",
//                 },
//             }
//         );
//         if (response.data.responseCode === "SRS016") {
//             return {
//                 success: true,
//                 message: response.data.responseMessage,
//                 mergereferenceId: response.data.data.referenceId,
//             };
//         }
//         return {
//             success: false,
//             message: response.data.responseMessage,
//         };
//     } catch (error) {
//         return { success: false, message: error.message };
//     }
// };

// Step - 4 Getting the Excel buffer
export const getFileBuffer = async (url) => {
    try {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            headers: {
                ClientId: process.env.SCOREME_CLIENT_ID,
                ClientSecret: process.env.SCOREME_CLIENT_SECRET,
            },
        });
        return response.data;
    } catch (error) {
        return { success: false, message: error.message };
    }
};


export const saveAnalyzedBuffer = async(referenceId,url) => {

    console.log('analise buffer',referenceId,url)
    // if (data.data && data.responseCode === "SRC001") {
        const lead = await Lead.findOne({ bsaRefId: referenceId });
        const docs = await Documents.findOne({ _id: lead.documents });

        const fileResponse = await getFileBuffer(url);

        const docsResult = await uploadDocs(docs, null, null, {
            rawFile: fileResponse,
            rawFileKey: "statementAnalyser",
            rawFileRemarks: `${lead.leadNo}`,
        });

        if (!docsResult.success) {
            return {
                success: false,
                message: "Buffer couldn't be saved.",
            }
        }
        return {
            success: true,
            message: "Document signed and saved successfully.",
        };
    // }
}



