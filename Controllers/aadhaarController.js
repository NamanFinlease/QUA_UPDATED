import AadhaarDetails from "../models/AadhaarDetails.js";
import asyncHandler from "../middleware/asyncHandler.js";
import Disbursal from "../models/Disbursal.js";
import Lead from "../models/Leads.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import sendEmail from "../utils/sendEmail.js";
import FormData from "form-data";
import { generateAadhaarOtp, verifyAadhaarOtp } from "../utils/aadhaar.js";
import { aadhaarKyc } from "../utils/smsGateway.js";
import { postLogs } from "./logs.js";

// @desc Generate Aadhaar OTP.
// @route GET /api/verify/aadhaar/:id
// @access Private
export const generateAadhaarLink = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const lead = await Lead.findById(id);
    const { personalEmail, fName, mName, lName } = lead;
    const token = jwt.sign({ id }, process.env.AADHAAR_LINK_SECRET, {
        expiresIn: "5m",
    });
    req.session.token = token;

    const customerName = `${fName}${mName && ` ${mName}`} ${lName}`;
    const link = `https://api.qualoan.com/verify-aadhaar/${id}`;
    // const link = `http://localhost:8080/verify-aadhaar/${id}`;
    // const result = await aadhaarKyc(lead.mobile, lead.fName, lead.lName, link);

    const formData = new FormData();
    formData.append("from", "info@qualoan.com");
    formData.append("to", `${personalEmail}`);
    formData.append("subject", "Aadhaar Verification");
    formData.append(
        "html",
        `<p>To verify your aadhaar click on <strong>${link}</strong>.</p>`
    );

    const result = await sendEmail(formData);
    console.log(result);
    // if (result.message !== "OK") {
    //     return res
    //         .status(500)
    //         .json({ success: false, message: "Failed to send Link" });
    // }
    await postLogs(
        id,
        "AADHAAR LINK SENT TO THE CUSTOMER",
        `${lead.fName}${lead.mName && ` ${lead.mName}`}${
            lead.lName && ` ${lead.lName}`
        }`,
        "Aadhaar Link sent to the customer"
    );
    return res.json({
        success: true,
        message: "Link sent successfully on mobile and email.",
    });

    // if (result.data.ErrorMessage === "Success") {
    //     console.log("Link sent on mobile!!");
    //     await sendEmail(
    //         personalEmail,
    //         customerName,
    //         `Aadhaar verification`,
    //         link
    //     );
    //     await postLogs(
    //         id,
    //         "AADHAAR LINK SENT TO THE CUSTOMER",
    //         `${lead.fName}${lead.mName && ` ${lead.mName}`}${
    //             lead.lName && ` ${lead.lName}`
    //         }`,
    //         "Aadhaar Link sent to the customer"
    //     );
    //     return res.json({
    //         success: true,
    //         message: "Link sent successfully on mobile and email.",
    //     });
    // }
    // return res
    //     .status(500)
    //     .json({ success: false, message: "Failed to send Link" });
});

// @desc Generate Aadhaar OTP.
// @route POST /api/verify/aadhaar/:id
// @access Private
export const aadhaarOtp = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const lead = await Lead.findById(id);
    const aadhaar = lead?.aadhaar;

    // Validate Aaadhaar number (12 digits)
    if (!/^\d{12}$/.test(aadhaar)) {
        return res.status(400).json({
            success: false,
            message: "Aaadhaar number must be a 12-digit number.",
        });
    }

    // Call the function to generate OTP using Aaadhaar number
    const response = await generateAadhaarOtp(aadhaar);
    // res.render('otpRequest',);

    await postLogs(
        id,
        "AADHAAR OTP SENT TO THE CUSTOMER",
        `${lead.fName}${lead.mName && ` ${lead.mName}`}${
            lead.lName && ` ${lead.lName}`
        }`,
        "Aadhaar otp sent to the customer"
    );

    res.json({
        success: true,
        transactionId: response.data.model.transactionId,
        fwdp: response.data.model.fwdp,
        codeVerifier: response.data.model.codeVerifier,
    });
});

// @desc Verify Aadhaar OTP to fetch Aadhaar details
// @route PATCH /api/verify/aaadhaar-otp/:id
// @access Private
export const saveAadhaarDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { otp, transactionId, fwdp, codeVerifier } = req.body;

    // Check if both OTP and request ID are provided
    if (!otp || !transactionId || !fwdp || !codeVerifier) {
        res.status(400);
        throw new Error("Missing fields.");
    }

    const lead = await Lead.findOne({ _id: id });

    // Fetch Aaadhaar details using the provided OTP and request ID
    const response = await verifyAadhaarOtp(
        otp,
        transactionId,
        fwdp,
        codeVerifier
    );

    // Check if the response status code is 422 which is for failed verification
    if (response.code === "200") {
        const details = response.model;
        // const name = details.name.split(" ");
        // const aadhaarNumber = details.adharNumber.slice(-4);
        // const uniqueId = `${name[0].toLowerCase()}${aadhaarNumber}`;

        const existingAadhaar = await AadhaarDetails.findOne({
            "details.adharNumber": details.adharNumber,
        });

        if (existingAadhaar) {
            await Lead.findByIdAndUpdate(
                id,
                { isAadhaarDetailsSaved: true },
                { new: true }
            );
            return res.json({
                success: true,
                details,
            });
        }

        // Save Aaadhaar details in AadharDetails model
        await AadhaarDetails.create({
            details,
        });
        await Lead.findByIdAndUpdate(
            id,
            { isAadhaarDetailsSaved: true },
            { new: true }
        );

        await postLogs(
            id,
            "AADHAAR OTP SUBMITTED BY THE CUSTOMER",
            `${lead.fName}${lead.mName && ` ${lead.mName}`}${
                lead.lName && ` ${lead.lName}`
            }`,
            "Aadhaar otp submitted by the customer"
        );

        // Respond with a success message
        return res.json({
            success: true,
            details,
        });
    }
    const code = parseInt(response.code, 10);
    res.status(code);
    throw new Error(response.msg);
});

// @desc Generate Aadhaar OTP.
// @route GET /api/verify/verifyAadhaar/:id
// @access Private
export const checkAadhaarDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const lead = await Lead.findById(id);
    const { aadhaar } = lead;
    const uniqueId = `${aadhaar}`;
    const data = await AadhaarDetails.findOne({
        "uniqueId": aadhaar,
    });

    res.json({
        success: true,
        data,
    });
});

// @desc Verify Aadhaar OTP to fetch Aadhaar details
// @route PATCH /api/verify/verify/:id
// @access Private
export const verifyAadhaar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const lead = await Lead.findByIdAndUpdate(
        id,
        { isAadhaarVerified: true },
        { new: true }
    ).populate("screenerId");

    if (!lead) {
        res.status(400);
        throw new Error("Couldn't verify Aadhaar");
    }

    await postLogs(
        id,
        `AADHAR VERIFIED BY ${lead.screenerId.fName}${
            lead.screenerId.lName && ` ${lead.screenerId.lName}`
        }`,
        `${lead.fName}${lead.mName && ` ${lead.mName}`}${
            lead.lName && ` ${lead.lName}`
        }`,
        `Aadhaar verified by ${lead.screenerId.fName}${
            lead.screenerId.mName && ` ${lead.screenerId.mName}`
        }${lead.screenerId.lName && ` ${lead.screenerId.lName}`}`
    );
    return res.json({
        success: true,
    });
});
