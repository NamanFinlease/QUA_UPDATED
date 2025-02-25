import express from "express";
import {
    activeLeadsToVerify,
    getPendingPaymentVerification,
    getPendingPaymentVerificationList,
    rejectPaymentVerification,
    verifyPayment,
} from "../Controllers/account.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// router.route("/landingPageData").post(createLandingPageLead).get(protect, getAllLandingPageLeads);
router.route("/leads").post(protect, verifyPayment).get(protect, verifyPayment);  // Create/get marketing leads
router.route("/lead/:id").post(protect, verifyPayment);  // Allocate marketing lead
router.route("/allocated").get(protect, verifyPayment);  // Allocated marketing lead
router.route("/completed").get(protect, verifyPayment);  // Completed marketing lead

export default router;