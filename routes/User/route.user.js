import express from "express";
import { aadhaarOtp, saveAadhaarDetails, personalInfo, currentResidence, addIncomeDetails, uploadProfile, getProfile, getProfileDetails, getDashboardDetails, checkLoanElegiblity, logout, getLoanList, sendEmailOTP, verifyEmailOTP ,addFormDetails } from "../../Controllers/User/controller.user.js";
import { verifyOtp, mobileGetOtp, verifyPan } from "../../Controllers/User/controller.user.js";
import { authMiddleware } from "../../middleware/User/authMiddleware.js";
import { calculateLoan, addEmploymentInfo, getApplicationStatus, getApplicationDetails, disbursalBankDetails, getDocumentStatus, getDocumentList, documentPreview, getJourney } from "../../Controllers/User/controller.loanApplication.js";
import { uploadDocuments } from "../../Controllers/User/docsUpload.js"
import upload from "../../config/multer.js";
import {
    getLoanNumber,
    payNow,
    callback
} from "../../Controllers/User/repayment.js";

const router = express.Router();

const uploadFields = upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "eAadhaar", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "residential", maxCount: 1 },
    { name: "electricityBill", maxCount: 1 },
    { name: "gasConnection", maxCount: 1 },
    { name: "bankStatement", maxCount: 10 },
    { name: "salarySlip", maxCount: 3 },
    { name: "others", maxCount: 10 },
    { name: "profilePicture", maxCount: 1 },
]);


// login with aadhar
router.route("/aadhaar-login/:aadhaar").get(aadhaarOtp);
router.post("/submit-aadhaar-otp", saveAadhaarDetails);

// Profile APIs    
router.patch("/personalInfo", authMiddleware, personalInfo);
router.patch("/currentResidence", authMiddleware, currentResidence);
router.patch("/addIncomeDetails", authMiddleware, addIncomeDetails);
router.patch("/uploadProfile", authMiddleware, uploadFields, uploadProfile);
router.patch("/addFormDetails" , authMiddleware , addFormDetails)

// Dashboard APIs
router.get("/getProfile", authMiddleware, getProfile);
router.get("/getProfileDetails", authMiddleware, getProfileDetails);
router.get("/getDashboardDetails", authMiddleware, getDashboardDetails);
router.get("/checkLoanElegblity", authMiddleware, checkLoanElegiblity);

// logout
router.post("/logout", logout)


// LoanApplication APIs
router.post("/applyLoan", authMiddleware, calculateLoan);
router.patch("/addEmploymentInfo", authMiddleware, addEmploymentInfo);
router.patch("/uploadDocuments", authMiddleware, uploadFields, uploadDocuments);
router.patch("/disbursalBankDetails", authMiddleware, disbursalBankDetails); // transaction
router.get("/getApplicationStatus", authMiddleware, getApplicationStatus);
router.get("/getApplicationDetails", authMiddleware, getApplicationDetails);
router.get("/getDocumentStatus", authMiddleware, getDocumentStatus)
router.get("/getDocumentList", authMiddleware, getDocumentList)
router.get("/documentPreview", authMiddleware, documentPreview)
router.get("/getJourney", authMiddleware, getJourney)


// verify
router.post("/mobile/get-otp/:mobile", authMiddleware, mobileGetOtp);
router.post("/mobile/verify-otp", verifyOtp);
router.post("/verifyPAN/:pan", authMiddleware, verifyPan);
router.post("/sendEmailOTP", authMiddleware, sendEmailOTP);
router.post("/verifyEmailOTP", authMiddleware, verifyEmailOTP);

// repayment 
router.get("/getLoanNumber/:pan", authMiddleware, getLoanNumber);
router.post("/payNow", authMiddleware, payNow)
router.post("/callback", callback) // transaction
router.get("/loanList", authMiddleware, getLoanList)


export default router;