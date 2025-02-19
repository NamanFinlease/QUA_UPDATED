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

// router.route("/active/verify").get(protect, activeLeadsToVerify);
router.route("/payment/verify/:loanNo").patch(protect, verifyPayment); // transaction
router
    .route("/active/verify/reject/:loanNo")
    .patch(protect, rejectPaymentVerification);

router.get("/pendingPaymentVerification/:loanNo" , protect , getPendingPaymentVerification) // for a particular loan
router.get("/pendingPaymentVerificationList", protect, getPendingPaymentVerificationList) // for pending verification bucket
router.post("/rejectPayment",protect, rejectPaymentVerification)

export default router;
