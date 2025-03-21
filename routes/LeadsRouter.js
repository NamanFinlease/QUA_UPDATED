import express from "express";
import upload from "../config/multer.js";
import { bulkUpload } from "../Controllers/bulkUpload.js";
import {
    addDocs,
    getDocuments,
    getBankNames,
} from "../Controllers/docsUploadAndFetch.js";
import { onHold, unHold, getHold } from "../Controllers/holdUnhold.js";
import internalDedupe from "../Controllers/internalDedupe.js";
import {
    // createLead,
    getAllLeads,
    getLead,
    allocateLead,
    allocatedLeads,
    updateLead,
    recommendLead,
    createContactUs,
    getAllContactUsData,
    createLandingPageLead,
    getAllLandingPageLeads,
} from "../Controllers/leads.js";
import { viewLogs } from "../Controllers/logs.js";
import { rejected, getRejected } from "../Controllers/rejected.js";
import {
    totalRecords,
    totalRecordsForSupervisor,
} from "../Controllers/totalRecords.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Define the fields you want to upload
export const uploadFields = upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "eAadhaar", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "repaymentDocs", maxCount: 10 },
    { name: "bankStatement", maxCount: 10 }, // Allows up to 10 bank statements
    { name: "salarySlip", maxCount: 10 }, // Allows up to 10 salary slips
    { name: "others", maxCount: 10 },
]);

// Other routes
// router.route("/").post(createLead);
router.route("/").get(protect, getAllLeads);
router
    .route("/contactUs")
    .post(createContactUs)
    .get(protect, getAllContactUsData);
router
    .route("/landingPageData")
    .post(createLandingPageLead)
    .get(protect, getAllLandingPageLeads);
router.route("/bulk-upload").post(upload.single("csv"), bulkUpload);
router.get("/totalRecords", protect, totalRecords);
router.get("/totalRecordsForSupervisor", totalRecordsForSupervisor);
router.route("/allocated").get(protect, allocatedLeads);
router.get("/hold", protect, getHold);
router.get("/reject", protect, getRejected);
router.route("/:id").get(protect, getLead).patch(protect, allocateLead);
router.get("/old-history/:id", protect, internalDedupe);
router.patch("/hold/:id", protect, onHold);
router.patch("/unhold/:id", protect, unHold);
router.route("/update/:id").patch(protect, updateLead);
router.patch("/reject/:id", protect, rejected);
router.get("/viewlogs/:leadId", protect, viewLogs);
router.patch("/recommend/:id", protect, recommendLead); // transaction

router.get("/docs/banks", protect, getBankNames);
router
    .route("/docs/:id")
    .patch(protect, uploadFields, addDocs)
    .get(protect, getDocuments);

export default router;
