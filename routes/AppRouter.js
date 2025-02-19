import express from "express";
import {
    aadhaarOtp,
    saveAadhaarDetails,
    getPanDetails,
    savePanDetails,
} from "../Controllers/appController.js";

const router = express.Router();

router.route("/verify/pan").post(getPanDetails);
router.route("/verify/aadhaar").get(aadhaarOtp);
router.route("/verify/submit-aadhaar-otp").post(saveAadhaarDetails);

export default router;
