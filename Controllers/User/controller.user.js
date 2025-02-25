import User from '../../models/User/model.user.js';
import AadhaarDetails from '../../models/AadhaarDetails.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { generateAadhaarOtp, verifyAadhaarOtp } from '../../utils/aadhaar.js';
import { generateUserToken } from '../../utils/generateToken.js';
import generateRandomNumber from '../../utils/generateRandomNumbers.js';
import { panVerify } from "../../utils/pan.js";
import { otpSent } from '../../utils/smsGateway.js';
import { uploadFilesToS3Profile, deleteFilesFromS3Profile } from '../../config/uploadFilesToS3.js';
import LoanApplication from '../../models/User/model.loanApplication.js';
import PanDetails from '../../models/PanDetails.js';
import { postUserLogs } from './controller.userLogs.js';
import Closed from '../../models/Closed.js';
import OTP from '../../models/User/model.Otp.js';


const aadhaarOtp = asyncHandler(async (req, res) => {

    const { aadhaar } = req.params;
    // Validate Aaadhaar number (12 digits)
    if (!/^\d{12}$/.test(aadhaar)) {
        return res.status(400).json({
            success: false,
            message: "Aaadhaar number must be a 12-digit number.",
        });
    }

    // check if aadhar is already registered then send OTP by SMS gateway
    const userDetails = await User.findOne({ aadarNumber: aadhaar })
    console.log('userDetails in controller-->', userDetails)
    if (userDetails) {
        if (userDetails && userDetails.mobile) {
            const mobile = userDetails.mobile
            const otp = generateRandomNumber();
            const result = await otpSent(mobile, otp);

            console.log('result aadhaar otp', result.data)

            if (result.data.ErrorMessage === "Success") {
                // Update or create the OTP record for the mobile number
                await OTP.findOneAndUpdate(
                    { mobile },
                    { otp, aadhaar },
                    { upsert: true, new: true }
                );

                return res.status(200).json({ success: true, isAlreadyRegisterdUser: true, mobileNumber: mobile, message: "OTP sent successfully to your register mobile number" });
            }

            return res
                .status(500)
                .json({ success: false, message: "Failed to send OTP" });

        }
    }


    // Call the function to generate OTP using Aaadhaar number
    const response = await generateAadhaarOtp(aadhaar);
    // res.render('otpRequest',);

    if (!response || !response.data || !response.data.model) {
        return res.status(400).json({ message: "Aadhar API issue" })

    }

    return res.status(200).json({
        success: true,
        message: "OTP sent successfully to your Adhaar linked mobile number",
        isAlreadyRegisterdUser: false,
        transactionId: response.data.model.transactionId,
        fwdp: response.data.model.fwdp,
        codeVerifier: response.data.model.codeVerifier,
    });
});

const saveAadhaarDetails = asyncHandler(async (req, res) => {
    const { otp, transactionId, fwdp, codeVerifier } = req.body;

    // Check if both OTP and request ID are provided
    if (!otp || !transactionId || !fwdp || !codeVerifier) {
        res.status(400);
        throw new Error("Missing fields.");
    }

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
        const uniqueId = `${details.adharNumber}`;


        const existingAadhaar = await User.findOne({
            aadarNumber: details.adharNumber,
        });

        if (existingAadhaar) {
            const UserData = await User.findOneAndUpdate({ aadarNumber: details.adharNumber },
                { registrationStatus: "AADHAR_VERIFIED" },
                { new: true }
            );
            const token = generateUserToken(res, UserData._id)
            console.log("tokenn--->", token)
            UserData.authToken = token
            await UserData.save();
            return res.status(200).json({
                success: true,
                token: token,
            });
        }
        const dateString = details.dob; // DD-MM-YYYY
        const parts = dateString.split("-"); // Split the string by '-'
        const isoDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`);

        console.log(isoDate); // Output: 1998-06-16T00:00:00.000Z
        details.dob = isoDate

        const userDetails = await User.create({
            aadarNumber: details.adharNumber,
            mobile: null,
            "personalDetails.fullName": details.name,
            "personalDetails.dob": isoDate,
            "personalDetails.gender": details.gender,
            registrationStatus: "AADHAR_VERIFIED",
        }
        );

        console.log("")

        // Save Aaadhaar details in AadharDetails model
        const aadhaarDetails = await AadhaarDetails.findOne({ uniqueId });
        if (!aadhaarDetails) {
            await AadhaarDetails.create({
                uniqueId,
                details
            });
        }
        else {
            aadhaarDetails.details = details
            await aadhaarDetails.save();
        }

        await postUserLogs(userDetails._id, `User Register Successfully! with aadhaar`)

        // generate token 
        const token = generateUserToken(res, userDetails._id)
        console.log("tokenn -->2", token)
        userDetails.authToken = token
        userDetails.isAadharVerify = true
        await userDetails.save();
        // Respond with a success message
        return res.status(200).json({
            success: true,
            token: token
        });
    }
    const code = parseInt(response.code, 10);
    res.status(code);
    throw new Error(response.msg);
});

const mobileGetOtp = asyncHandler(async (req, res) => {
    const { mobile } = req.params;
    const userId = req.user._id

    if (!mobile) {
        return res.status(400).json({ message: "Mobile number is required" });
    }

    const indianMobileNumberRegex = /^[6-9]\d{9}$/;
    if (!indianMobileNumberRegex.test(mobile)) {
        return res.status(400).json({ message: "Mobile number is not formated" });

    }

    const user = await User.findById(userId)
    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    const otp = generateRandomNumber();
    console.log("fdfdsgg---->", otp)
    const result = await otpSent(mobile, otp);

    if (result.data.ErrorMessage === "Success") {
        // Update or create the OTP record for the mobile number
        await OTP.findOneAndUpdate(
            { mobile },
            { otp, aadhar: user.aadarNumber },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, message: "OTP sent successfully!!" });
    }

    return res
        .status(500)
        .json({ success: false, message: "Failed to send OTP" });
});

const verifyOtp = asyncHandler(async (req, res) => {
    const { mobile, otp, isAlreadyRegisterdUser } = req.body;

    // Check if both mobile and OTP are provided
    if (!mobile && !otp) {
        return res.status(400).json({
            success: false,
            message: "Mobile number and OTP are required.",
        });
    }

    // Find the OTP record in the database
    const otpRecord = await OTP.findOne({ mobile: mobile });

    // Check if the record exists
    if (!otpRecord) {
        return res.status(404).json({
            success: false,
            message:
                "No OTP found for this mobile number. Please request a new OTP.",
        });
    }

    // Verify if the provided OTP matches the stored OTP
    if (otpRecord.otp !== otp) {
        return res.status(401).json({
            success: false,
            message: "Invalid OTP. Please try again.",
        });
    }

    const otpAge = Date.now() - new Date(otpRecord.updatedAt).getTime();
    if (otpAge > 10 * 60 * 1000) {
        return res.status(400).json({
            success: false,
            message: "OTP has expired. Please request a new OTP.",
        });
    }

    otpRecord.otp = "";
    await otpRecord.save(); // Save the updated OTP record

    if (isAlreadyRegisterdUser) {
        const userDetails = await User.findOne({ mobile: mobile })
        console.log(userDetails, "userDetails")
        const token = generateUserToken(res, userDetails._id)
        console.log(token, "token")
        userDetails.authToken = token
        userDetails.isMobileVerify = true
        await userDetails.save()
        // Respond with a success message
        return res.status(200).json({
            success: true,
            message: "User login sucessfully!",
            token: token
        });
    }

    // update in user model
    const result = await User.findOneAndUpdate(
        { aadarNumber: otpRecord.aadhar },
        { registrationStatus: "MOBILE_VERIFIED", mobile: mobile, previousJourney: "AADHAR_VERIFIED", isMobileVerify: true },
        { new: true }
    );
    await postUserLogs(result._id, `User Mobile Verified Successfully!`)
    console.log(result, "result")


    if (!result) {
        return res.status(400).json({
            success: false,
            message: "OTP not verified",
        });
    }

    // OTP matches, verification successful
    return res.status(200).json({
        success: true,
        message: "OTP verified successfully!",
    });
});

const verifyPan = asyncHandler(async (req, res) => {

    const { pan } = req.params;
    const userId = req.user._id

    // Validate that aaadhaar is present in the leads
    if (!pan) {
        res.status(400);
        throw new Error({ success: false, message: "Pan number is required." });
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    // Validate the PAN number
    if (!panRegex.test(pan)) {
        res.status(400);
        throw new Error({ success: false, message: "Invalid PAN!!!" });
    }

    // Call the get panDetails Function
    const response = await panVerify(userId, pan);

    if (response.result_code !== 101) {
        res.status(400);
        throw new Error("Error with Digitap!");
    }


    // update in user table 
    await User.findByIdAndUpdate(
        userId,
        { registrationStatus: "PAN_VERIFIED", previousJourney: "MOBILE_VERIFIED", PAN: pan, isPanVerify: true },
        { new: true }
    );

    await postUserLogs(userId, `User PAN Verified Successfully!`)

    // add pan details in panDetails table
    await PanDetails.findOneAndUpdate(
        {
            $or: [
                { "data.PAN": pan }, // Check if data.PAN matches
                { "data.pan": pan }, // Check if data.pan matches
            ],
        },
        { data: response.result }, // Update data
        { upsert: true, new: true } // Create a new record if not found
    );

    if (!response?.result?.aadhaar_linked) {
        return res.status(400).json({
            message: "Your PAN is not linked to AADHAAR"
        });
    }


    // Now respond with status 200 with JSON success true
    return res.status(200).json({
        data: response.result,
    });

})

const personalInfo = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const personalDetails = req.body;
    if (!personalDetails) {
        return res.status(400).json({ message: "Personal details are required" });
    }
    if (personalDetails.personalEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(personalDetails.personalEmail)) {
            return res.status(400).json({ message: "Email should be in correct format" });
        }
    }

    const userDetails = await User.findById(userId);

    if (!userDetails) {
        return res.status(404).json({ message: "User not found" });
    }

    let registrationStatus
    let previousJourney
    if (userDetails.registrationStatus == "PAN_VERIFIED") {
        registrationStatus = "PERSONAL_DETAILS",
            previousJourney = "PAN_VERIFIED"
    }

    if (userDetails.registrationStatus != "PAN_VERIFIED") {
        registrationStatus = userDetails.registrationStatus,
            previousJourney = userDetails.previousJourney
    }

    userDetails.personalDetails = personalDetails
    userDetails.registrationStatus = registrationStatus
    userDetails.previousJourney = previousJourney
    userDetails.isPersonalDetails = true
    await userDetails.save();

    await postUserLogs(userId, `User Personal Details Updated Successfully!`)
    return res.status(200).json({ message: "Personal details updated successfully", user: userDetails.personalDetails });

});

const currentResidence = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const residenceDetails = req.body;
    if (!residenceDetails) {
        return res.status(400).json({ message: "Please Provide Details which are  required" })
    }

    const userDetails = await User.findById(userId);

    if (!userDetails) {
        return res.status(404).json({ message: "User not found" });
    }

    let registrationStatus
    let previousJourney
    if (userDetails.registrationStatus == "PERSONAL_DETAILS") {
        registrationStatus = "CURRENT_RESIDENCE",
            previousJourney = "PERSONAL_DETAILS"
    }

    if (userDetails.registrationStatus != "PERSONAL_DETAILS") {
        registrationStatus = userDetails.registrationStatus,
            previousJourney = userDetails.previousJourney
    }


    if (residenceDetails.residingSince) {
        const dateString = residenceDetails.residingSince;
        const isoDate = new Date(dateString);
        residenceDetails.residingSince = isoDate
    }

    userDetails.residenceDetails = residenceDetails
    userDetails.registrationStatus = registrationStatus
    userDetails.previousJourney = previousJourney
    userDetails.isCurrentResidence = true
    await userDetails.save();
    await postUserLogs(userId, `User Current Residence Details Updated Successfully!`)

    res.status(200).json({ message: "Personal details updated successfully", residenceDetails: userDetails.residenceDetails });

})

const addIncomeDetails = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const incomeDetails = req.body;
    if (!incomeDetails) {
        return res.status(400).json({ message: "Please Provide Details which are  required" })
    }

    if (incomeDetails.nextSalaryDate) {
        const dateString = incomeDetails.nextSalaryDate;
        const isoDate = new Date(dateString);
        incomeDetails.nextSalaryDate = isoDate
    }
    if (incomeDetails.workingSince) {
        const dateString = incomeDetails.workingSince;
        const isoDate = new Date(dateString);
        incomeDetails.workingSince = isoDate
    }


    const userDetails = await User.findById(userId);

    if (!userDetails) {
        return res.status(404).json({ message: "User not found" });
    }



    let registrationStatus
    let previousJourney
    if (userDetails.registrationStatus == "CURRENT_RESIDENCE") {
        registrationStatus = "INCOME_DETAILS",
            previousJourney = "CURRENT_RESIDENCE"
    }

    if (userDetails.registrationStatus != "CURRENT_RESIDENCE") {
        registrationStatus = userDetails.registrationStatus,
            previousJourney = userDetails.previousJourney
    }

    userDetails.incomeDetails = incomeDetails
    userDetails.registrationStatus = registrationStatus
    userDetails.previousJourney = previousJourney
    userDetails.isIncomeDetails = true
    await userDetails.save();
    await postUserLogs(userId, `User Income Details Updated Successfully!`)
    res.status(200).json({ message: "Income details updated successfully", incomeDetails: userDetails.incomeDetails });
})

const uploadProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!req.files || !req.files.profilePicture) {
        return res.status(400).json({ message: "No profile picture uploaded" });
    }

    const profilePictureFile = req.files.profilePicture[0];

    // Check if the file is an image
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const fileMimeType = profilePictureFile.mimetype;

    if (!allowedMimeTypes.includes(fileMimeType)) {
        return res.status(400).json({ message: "Uploaded file is not an image. Please upload an image file." });
    }

    const fileBuffer = profilePictureFile.buffer;
    const fileName = `users/${userId}/profile-picture-${Date.now()}.${profilePictureFile.mimetype.split("/")[1]}`;

    const user = await User.findById(userId);

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }


    // If the user already has a profile picture, delete the old one from S3
    if (user.profileImage) {
        const oldKey = user.profileImage.split("/").slice(-1)[0];
        console.log("oldKey", oldKey);
        await deleteFilesFromS3Profile(`users/${userId}/${oldKey}`);
    }

    // Upload the new profile picture to S3
    const uploadResult = await uploadFilesToS3Profile(fileBuffer, fileName);


    let registrationStatus
    let previousJourney
    let isCompleteRegistration
    if (user.registrationStatus == "INCOME_DETAILS") {
        registrationStatus = "COMPLETE_DETAILS",
            previousJourney = "UPLOAD_PROFILE",
            isCompleteRegistration = true
    }

    if (user.registrationStatus != "INCOME_DETAILS") {
        registrationStatus = user.registrationStatus,
            previousJourney = user.previousJourney,
            isCompleteRegistration = user.isCompleteRegistration
    }


    const updatedUser = await
        User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    profileImage: uploadResult.Location,
                    isCompleteRegistration: true,
                    registrationStatus: registrationStatus,
                    previousJourney: previousJourney,
                    isProfileImage: true
                }
            },
            { new: true }
        );

    if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
    }

    // Return the response
    return res.status(200).json({
        message: "Profile picture uploaded successfully",
        profileImageUrl: user.profileImage,
    });
});

const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    // console.log("user----->" , user.profileImage)

    // const preSignedUrl = await getProfileDocs(user.profileImage, "profileImage", "")
    // console.log("preSignedUrl--->", preSignedUrl)
    const data = {
        profileImage: user.profileImage,
        name: user.personalDetails.fullName
    }

    res.status(200).json({
        success: true,
        data

    })
})

const getProfileDetails = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { detailsType } = req.query
    console.log(detailsType)
    console.log("congratulation-->")
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    if (detailsType === "personalDetails") {
        console.log("First 1-->")
        return res.status(200).json({
            success: true,
            mobile: user.mobile,
            fullName: user?.personalDetails?.fullName,
        })
    }

    const data = {
        mobile: user.mobile,
        PAN: user.PAN,
        aadhaarNumber: user.aadarNumber,
        personalDetails: user.personalDetails,
        residence: user.residenceDetails,
        incomeDetails: user.incomeDetails,
        profileImage: user.profileImage,

    }
    console.log(data, "data")
    return res.status(200).json({
        success: true,
        data
    })
})

const getDashboardDetails = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    // If the registration is complete, fetch the loan application status
    const loanApplication = await LoanApplication.findOne({ userId }).sort({ createdAt: -1 })

    const pipeline = [
        {
            $match: {
                pan: user.PAN
            }
        },
        {
            $match: {
                data: {
                    $elemMatch: {
                        isActive: true,
                        isClosed: false
                    }
                }
            }
        }
    ]
    let isRedirectToLoanList = false
    const result = await Closed.aggregate(pipeline)
    console.log('result', result)
    const countPreviousActiveLoan = result.length
    console.log("countPreviousActiveLoan--->", countPreviousActiveLoan)
    if (countPreviousActiveLoan > 0) {
        isRedirectToLoanList = true
    }


    // If the registration is incomplete, return the registration status
    if (!user.isCompleteRegistration) {
        console.log("!isComplete", isRedirectToLoanList)
        return res.status(200).json({
            success: true,
            message: "Registration incomplete",
            registrationStatus: user.registrationStatus,
            isAadharVerify: user.isAadharVerify,
            isMobileVerify: user.isMobileVerify,
            isPanVerify: user.isPanVerify,
            isProfileImage: user.isProfileImage,
            isPersonalDetails: user.isPersonalDetails,
            isCurrentResidence: user.isCurrentResidence,
            isIncomeDetails: user.isIncomeDetails,
            isFormFilled: user.isFormFilled,
            isRegistering: true,
            isLoanApplied: false,
            isRedirectToLoanList: isRedirectToLoanList
        });
    }


    if (!loanApplication) {
        console.log("!loanApplication", isRedirectToLoanList)
        return res.status(200).json({
            success: false,
            message: "Registration completed",
            registrationStatus: user.registrationStatus,
            isAadharVerify: user.isAadharVerify,
            isMobileVerify: user.isMobileVerify,
            isPanVerify: user.isPanVerify,
            isProfileImage: user.isProfileImage,
            isPersonalDetails: user.isPersonalDetails,
            isCurrentResidence: user.isCurrentResidence,
            isIncomeDetails: user.isIncomeDetails,
            isAadharVerify: user.isAadharVerify,
            isMobileVerify: user.isMobileVerify,
            isPanVerify: user.isPanVerify,
            isProfileImage: user.isProfileImage,
            isPersonalDetails: user.isPersonalDetails,
            isCurrentResidence: user.isCurrentResidence,
            isIncomeDetails: user.isIncomeDetails,
            isAadharVerify: user.isAadharVerify,
            isMobileVerify: user.isMobileVerify,
            isPanVerify: user.isPanVerify,
            isProfileImage: user.isProfileImage,
            isPersonalDetails: user.isPersonalDetails,
            isCurrentResidence: user.isCurrentResidence,
            isIncomeDetails: user.isIncomeDetails,
            isBankStatementUploaded: false,
            isFormFilled: true,
            isRegistering: false,
            isLoanApplied: false,
            isRedirectToLoanList: isRedirectToLoanList
        });
    }

    if (loanApplication.applicationStatus === "CLOSED") {
        console.log("loanApplication.applicationStatus === CLOSED", isRedirectToLoanList)
        return res.status(200).json({
            success: true,
            message: "Application status fetched successfully",
            applicationStatus: loanApplication.applicationStatus,
            progressStatus: loanApplication.progressStatus,
            isLoanCalculated: false,
            isEmploymentDetailsSaved: false,
            isDisbursalDetailsSaved: false,
            isDocumentUploaded: false,
            isAadharVerify: user.isAadharVerify,
            isMobileVerify: user.isMobileVerify,
            isPanVerify: user.isPanVerify,
            isProfileImage: user.isProfileImage,
            isPersonalDetails: user.isPersonalDetails,
            isCurrentResidence: user.isCurrentResidence,
            isIncomeDetails: user.isIncomeDetails,
            isBankStatementUploaded: false,
            isFormFilled: true,
            isRegistering: false,
            isLoanApplied: false,
            isRedirectToLoanList: isRedirectToLoanList
        })

    }
    if (loanApplication.applicationStatus === "REJECTED") {
        return res.status(200).json({
            success: true,
            message: "Application status fetched successfully",
            applicationStatus: loanApplication.applicationStatus,
            progressStatus: loanApplication.progressStatus,
            isLoanCalculated: loanApplication?.isLoanCalculated ?? true,
            isEmploymentDetailsSaved: loanApplication.isEmploymentDetailsSaved,
            isDisbursalDetailsSaved: loanApplication.isDisbursalDetailsSaved,
            isDocumentUploaded: loanApplication.isDocumentUploaded,
            isAadharVerify: user.isAadharVerify,
            isMobileVerify: user.isMobileVerify,
            isPanVerify: user.isPanVerify,
            isProfileImage: user.isProfileImage,
            isPersonalDetails: user.isPersonalDetails,
            isCurrentResidence: user.isCurrentResidence,
            isIncomeDetails: user.isIncomeDetails,
            isBankStatementUploaded: loanApplication.isBankStatementUploaded,
            isFormFilled: true,
            isRegistering: false,
            isLoanApplied: true,
            isRedirectToLoanList: isRedirectToLoanList,
        });
    }


    let isLoanApplied = false
    if (loanApplication.applicationStatus === 'LEAD_CREATED') {
        isLoanApplied = true
    }
    // Return the application status and progress phase
    return res.status(200).json({
        success: true,
        message: "Application status fetched successfully",
        applicationStatus: loanApplication.applicationStatus,
        progressStatus: loanApplication.progressStatus,
        isLoanCalculated: loanApplication?.isLoanCalculated ?? true,
        isEmploymentDetailsSaved: loanApplication.isEmploymentDetailsSaved,
        isDisbursalDetailsSaved: loanApplication.isDisbursalDetailsSaved,
        isDocumentUploaded: loanApplication.isDocumentUploaded,
        isAadharVerify: user.isAadharVerify,
        isMobileVerify: user.isMobileVerify,
        isPanVerify: user.isPanVerify,
        isProfileImage: user.isProfileImage,
        isPersonalDetails: user.isPersonalDetails,
        isCurrentResidence: user.isCurrentResidence,
        isIncomeDetails: user.isIncomeDetails,
        isBankStatementUploaded: loanApplication.isBankStatementUploaded,
        isFormFilled: true,
        isRegistering: false,
        isLoanApplied: isLoanApplied,
        isRedirectToLoanList: isRedirectToLoanList,
    });
});

const checkLoanElegiblity = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (!user.isCompleteRegistration) {
        return res.status(200).json({ message: "Please Complete Profile First", isEligible: user.isCompleteRegistration });
    }

    const alredyApplied = await LoanApplication.findOne({ userId }).sort({ createdAt: -1 });
    if (alredyApplied && alredyApplied.status === "PENDING") {
        return res.status(200).json({ message: "You have already applied for loan", isEligible: false });
    }

    await postUserLogs(userId, `User check loan elegiblity`)
    return res.status(200).json({ message: "You are eligible for loan", isEligible: true });

})

const logout = asyncHandler(async (req, res) => {

    // const user = await User.findById(req.user._id);
    // if (!user) {
    //     return res.status(404).json({ message: "User not found" });
    // }
    // user.authToken = "";
    // await user.save()

    res.cookie('user_jwt', '', {
        httpOnly: true,
        expires: new Date(0)
    })

    res.status(200).json({ message: 'Logged out successfully' })
})

const getLoanList = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    const pipeline = [
        {
            $match: {
                pan: user.PAN
            }
        },
        {
            $set: {
                data: {
                    $sortArray: {
                        input: "$data",
                        sortBy: { createdAt: -1 }
                    }
                }
            }
        },
        {
            $unwind: "$data"
        },
        {
            $lookup: {
                from: "collections",
                localField: "data.loanNo",
                foreignField: "loanNo",
                as: "collectionDetails"
            }
        },
        {
            $unwind: "$collectionDetails"
        },
        {
            $lookup: {
                from: "camdetails",
                localField: "collectionDetails.leadNo",
                foreignField: "leadNo",
                as: "camDetails"
            }
        },
        {
            $unwind: "$camDetails"
        },
        {
            $project: {
                loanNo: "$data.loanNo",
                isActive: "$data.isActive",
                isClosed: "$data.isClosed",
                isDisbursed: "$data.isDisbursed",
                pan: 1,
                repaymentAmount:
                    "$camDetails.repaymentAmount",
                outstandingAmount:
                    "$collectionDetails.outstandingAmount",
                dpd: "$collectionDetails.dpd",
                repaymentDate:
                    "$collectionDetails.repaymentDate"
            }
        }
    ]
    const loanList = await Closed.aggregate(pipeline);
    return res.status(200).json({ message: "Loan List get sucessfully", loanList })
})


const sendEmailOTP = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { email } = req.body;
    const userDetails = await User.findById(userId);
    if (!userDetails) {
        return res.status(404).json({ message: "User not found" })
    }
    let fullName = `${userDetails?.personalDetails?.fullName}`

    const OTP = generateRandomNumber()
    userDetails.emailOTP = OTP
    userDetails.email = email
    await userDetails.save()
    let subject = `Verify Email OTP`
    // Setup the options for the ZeptoMail API
    const options = {
        method: "POST",
        url: "https://api.zeptomail.in/v1.1/email",
        headers: {
            accept: "application/json",
            authorization: `${process.env.ZOHO_APIKEY}`,
            "cache-control": "no-cache",
            "content-type": "application/json",
        },
        data: JSON.stringify({
            from: { address: "credit@qualoan.com" },
            to: [
                {
                    email_address: {
                        address: email,
                        name: fullName,
                    },
                },
            ],
            subject: subject,
            htmlbody: `<p>
                    Please verify your Email.
                    your OTP is .${OTP}
                </p>`,
            // htmlbody: htmlToSend,
        }),
    };

    // Make the request to the ZeptoMail API
    const response = await axios(options);
    console.log('responseeeee', response)
    if (response.data.message === "OK") {
        return {
            success: true,
            message: "Email send successfully",
        };
    }

})

const verifyEmailOTP = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { otp } = req.body;
    const userDetails = await User.findById(userId);
    if (!userDetails) {
        return res.status(404).json({ message: "User not found" })
    }
    if (userDetails.emailOTP !== otp) {
        return res.status(400).json({ message: "Invalid OTP" })
    }
    const otpAge = Date.now() - new Date(userDetails.updatedAt).getTime();
    if (otpAge > 10 * 60 * 1000) {
        return res.status(400).json({
            success: false,
            message: "OTP has expired. Please request a new OTP.",
        });
    }
    userDetails.isEmailVerify = true
    userDetails.emailOTP = null
    await userDetails.save()
    return res.status(200).json({ message: "Email verified successfully" })
})

const addFormDetails = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const formDetails = req.body;
    console.log('formDetails', formDetails)
    if (!formDetails.pan || !formDetails.fathersName) {
        return res.status(400).json({ message: "Please provide PAN and fathersName both the fields are required." })
    }
    const userDetails = await User.findById(userId);
    if (!userDetails) {
        return res.status(400).json({ message: "User not found" })
    }
    userDetails.PAN = formDetails?.pan || ""
    userDetails.personalDetails.fathersName = formDetails?.fathersName || ""
    userDetails.isFormFilled = true
    await userDetails.save()
    return res.status(200).json({ message: "Form details added successfully" })
})

export { aadhaarOtp, saveAadhaarDetails, mobileGetOtp, verifyPan, getProfile, personalInfo, currentResidence, addIncomeDetails, uploadProfile, getProfileDetails, getDashboardDetails, checkLoanElegiblity, verifyOtp, logout, getLoanList, sendEmailOTP, verifyEmailOTP, addFormDetails }