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
import OTP from '../../models/User/model.otp.js';
import Close from '../../models/close.js';


const aadhaarOtp = asyncHandler(async (req, res) => {

    const { aadhaar } = req.params;
    const user = req.user
    // Validate Aaadhaar number (12 digits)
    if (!/^\d{12}$/.test(aadhaar)) {
        return res.status(400).json({
            success: false,
            message: "Aadhaar number must be a 12-digit number.",
        });
    }

    // check if aadhar is already registered then send OTP by SMS gateway
    const userDetails = await User.findById(user._id)

    if (!userDetails) {
        res.status(400)
        throw new Error("User not found.")
    }
    // console.log('userDetails in controller-->', userDetails)

    // if (userDetails) {
    //     if (userDetails && userDetails.mobile) {
    //         const mobile = userDetails.mobile
    //         const otp = generateRandomNumber();
    //         const result = await otpSent(mobile, otp);

    //         console.log('result aadhaar otp', result.data)

    //         if (result.data.ErrorMessage === "Success") {
    //             // Update or create the OTP record for the mobile number
    //             await OTP.findOneAndUpdate(
    //                 { mobile },
    //                 { otp, aadhaar },
    //                 { upsert: true, new: true }
    //             );

    //             return res.status(200).json({ success: true, isAlreadyRegisterdUser: true, mobileNumber: mobile, message: "OTP sent successfully to your register mobile number" });
    //         }

    //         return res
    //             .status(500)
    //             .json({ success: false, message: "Failed to send OTP" });

    //     }
    // }


    // Call the function to generate OTP using Aaadhaar number
    const response = await generateAadhaarOtp(aadhaar);
    // res.render('otpRequest',);

    if (!response || !response.data) {
        return res.status(400).json({ message: "Aadhar API issue" })

    }

    return res.status(200).json({
        success: true,
        message: "OTP sent successfully to your Adhaar linked mobile number",
        // isAlreadyRegisterdUser: false,
        // transactionId: response.data.model.transactionId,
        // fwdp: response.data.model.fwdp,
        // codeVerifier: response.data.model.codeVerifier,
    });
});

const saveAadhaarDetails = asyncHandler(async (req, res) => {
    const { otp, aadhaar_number, consent } = req.body;

    const user = req.user



    // Check if both OTP and request ID are provided
    if (!otp || !aadhaar_number || !consent) {
        res.status(400);
        throw new Error("Missing fields.");
    }

    const existingUser = await User.findById(user._id);
    if (!existingUser) {
        res.status(401)
        throw new Error("User is not registered.")
    }
    // Fetch Aaadhaar details using the provided OTP and request ID
    const response = await verifyAadhaarOtp(
        otp,
        aadhaar_number,
        consent,
    );



    // Check if the response status code is 422 which is for failed verification
    if (response.responseCode === "SRC001") {
        console.log('response data', response.data)

        const address = {
            house: response.data.house || "",
            street: response.data.street || "",
            landmark: response.data.landmark || "",
            dist: response.data.district || "",
            subDist: response.data.subDistrict || "",
            state: response.data.state || "",
            country: response.data.country || "",
            loc: response.data.locality || "",
            po: response.data.postOfficeName || "",
            pc: response.data.pincode || "",
            vtc: response.data.vtcName || "",

        }
        const details = {
            name: response.data.name || "",
            careOf: response.data.careOf || "",
            dob: response.data.dateOfBirth || "",
            gender: response.data.gender || "",
            documentType: response.data.documentType || "",
            mobile: response.data.mobile || "",
            email: response.data.email || "",
            maskedAdharNumber: response.data.maskAadhaarNumber || "",
            image: response.data.photoBase64 || "",
            link: response.data.xmlBase64 || "",
            address,
        };
        // const name = details.name.split(" ");
        // const aadhaarNumber = details.adharNumber.slice(-4);
        const uniqueId = `${aadhaar_number}`;




        // if (existingUser) {

        // const token = generateUserToken(res, UserData._id)
        // console.log("tokenn--->", token)
        // UserData.authToken = token
        // await UserData.save();
        // return res.status(200).json({
        //     success: true,
        //     token: token,
        // });
        // }
        const dateString = response.data.dateOfBirth; // DD-MM-YYYY
        const parts = dateString.split("-"); // Split the string by '-'
        const isoDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00.000Z`);

        console.log(isoDate); // Output: 1998-06-16T00:00:00.000Z
        response.data.dateOfBirth = isoDate

        // const userresponse = await User.findOne({
        //     // aadarNumber: response.adharNumber,
        //     // mobile: null,
        //     // "personalDetails.fullName": details.name,
        //     // "personalDetails.dob": isoDate,
        //     // "personalDetails.gender": details.gender,
        //     // registrationStatus: "AADHAR_VERIFIED",
        //     // previousJourney: "PAN_VERIFIED"
        // }
        // );


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

        await postUserLogs(user._id, `Aadhaar verified successfully`)

        // generate token 
        const token = generateUserToken(res, user._id)
        console.log("tokenn -->2", token)
        // userDetails.authToken = token
        // userDetails.isAadharVerify = true
        // await userDetails.save();

        const UserData = await User.findByIdAndUpdate(user._id,
            {
                registrationStatus: "AADHAR_VERIFIED",
                previousJourney: "PAN_VERIFIED",
                "personalDetails.fullName": details.name,
                "personalDetails.dob": isoDate,
                "personalDetails.gender": details.gender,
                aadarNumber: aadhaar_number,
                authToken: token,
                isAadharVerify: true

            },

            { new: true }
        );
        // Respond with a success message
        return res.status(200).json({
            success: true,
            token: token
        });
    }
    const code = parseInt(response.responseCode, 10);
    res.status(code);
    throw new Error(response.responseMessage);
});

const mobileGetOtp = asyncHandler(async (req, res) => {
    const { mobile } = req.params;
    // const details = req.body
    // console.log("details--->", details)
    // if (!details) {
    //     console.log("1")
    //     return res.status(400).json({ message: "Please provide details" })

    // }
    // if (!details.PAN || !details.fathersName) {
    //     console.log("2")
    //     return res.status(400).json({ message: "Please provide details" })

    // }
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    // Validate the PAN number
    // if (!panRegex.test(details.PAN)) {
    //     return res.status(400).json({ message: "Please provide valid PAN" })
    // }
    // const userId = req.user._id

    if (!mobile) {
        return res.status(400).json({ message: "Mobile number is required" });
    }

    const indianMobileNumberRegex = /^[6-9]\d{9}$/;
    if (!indianMobileNumberRegex.test(mobile)) {
        return res.status(400).json({ message: "Mobile number is not formated" });

    }

    // const otp = generateRandomNumber();
    // const result = await otpSent(mobile, otp);

    // console.log('result aadhaar otp', result.data)

    // if (result.data.ErrorMessage === "Success") {
    //     // Update or create the OTP record for the mobile number
    //     await OTP.findOneAndUpdate(
    //         { mobile },
    //         { otp, aadhaar: user?.aadhaar },
    //         { upsert: true, new: true }
    //     );

    //     return res.status(200).json({ success: true, mobileNumber: mobile, message: "OTP sent successfully to your register mobile number" });
    // }

    const user = await User.findOne({ mobile })
    // if (!user) {
    //     return res.status(400).json({ message: "User not found" });
    // } else {
    //     // const userDetails = await User.findOne({ aadarNumber: aadhaar })
    //     // console.log('userDetails in controller-->', userDetails)

    //     if (user) {
    //         if (user && user.mobile) {
    //             const mobile = user.mobile
    //             const otp = generateRandomNumber();
    //             const result = await otpSent(mobile, otp);

    //             console.log('result aadhaar otp', result.data)

    //             if (result.data.ErrorMessage === "Success") {
    //                 // Update or create the OTP record for the mobile number
    //                 await OTP.findOneAndUpdate(
    //                     { mobile },
    //                     { otp, aadhaar: user?.aadhaar },
    //                     { upsert: true, new: true }
    //                 );

    //                 return res.status(200).json({ success: true, mobileNumber: mobile, message: "OTP sent successfully to your register mobile number" });
    //             }

    //             return res
    //                 .status(500)
    //                 .json({ success: false, message: "Failed to send OTP" });

    //         }
    //     }
    // }
    // user.personalDetails.fathersName = details.fathersName
    // user.PAN = details.PAN
    // await user.save()

    const otp = generateRandomNumber();
    console.log("fdfdsgg---->", otp)
    const result = await otpSent(mobile, otp);

    console.log('otp result', result)

    if (result.data.ErrorMessage === "Success") {
        // Update or create the OTP record for the mobile number
        await OTP.findOneAndUpdate(
            { mobile },
            { otp, aadhar: user?.aadarNumber },
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

    const userDetails = await User.findOne({ mobile })
    if (userDetails) {
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
        { mobile },
        { registrationStatus: "MOBILE_VERIFIED", mobile: mobile, isMobileVerify: true },
        { new: true, upsert: true }
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

    console.log("pan 1")

    // Validate that aaadhaar is present in the leads
    if (!pan) {
        res.status(400);
        throw new Error({ success: false, message: "Pan number is required." });
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    console.log("pan 2")
    // Validate the PAN number
    if (!panRegex.test(pan)) {
        res.status(400);
        throw new Error({ success: false, message: "Invalid PAN!!!" });
    }
    console.log("pan 3")

    // Call the get panDetails Function
    const response = await panVerify(userId, pan);

    console.log("pan 4", response, pan)
    if (response.data.result_code !== 101) {
        res.status(400);
        throw new Error("3rd party API error!");
    }

    console.log("pan 5", response, pan)

    // update in user table 
    await User.findByIdAndUpdate(
        userId,
        { registrationStatus: "PAN_VERIFIED", previousJourney: "MOBILE_VERIFIED", PAN: pan, isPanVerify: true },
        { new: true }
    );
    console.log("pan 6", response, pan)

    await postUserLogs(userId, `User PAN Verified Successfully!`)

    // add pan details in panDetails table
    console.log("pan 7", response, pan)
    await PanDetails.findOneAndUpdate(
        {
            $or: [
                { "data.PAN": pan }, // Check if data.PAN matches
                { "data.pan": pan }, // Check if data.pan matches
            ],
        },
        { data: response.data.result }, // Update data
        { upsert: true, new: true } // Create a new record if not found
    );

    if (!response?.data?.result?.aadhaar_linked) {
        return res.status(400).json({
            message: "Your PAN is not linked to AADHAAR"
        });
    }


    // Now respond with status 200 with JSON success true
    return res.status(200).json({
        data: response.data.result,
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
    if (personalDetails.dob) {
        const dateString = personalDetails.dob;
        const isoDate = new Date(dateString);
        personalDetails.dob = isoDate
    }

    const userDetails = await User.findById(userId);

    if (!userDetails) {
        return res.status(404).json({ message: "User not found" });
    }
    personalDetails.fathersName = userDetails.personalDetails.fathersName

    let registrationStatus
    let previousJourney
    if (userDetails.registrationStatus == "AADHAR_VERIFIED") {
        registrationStatus = "PERSONAL_DETAILS",
            previousJourney = "AADHAR_VERIFIED"
    }

    if (userDetails.registrationStatus != "AADHAR_VERIFIED") {
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
            $match: { pan: user.PAN }
        },
        {
            $match: {
                "isActive": true,
                "isClosed": false
            }
        }
    ]
    let isRedirectToLoanList = false
    const result = await Close.aggregate(pipeline)
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
            $match: { pan: user.PAN, isDisbursed: true }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $lookup: {
                from: "collections",
                localField: "loanNo",
                foreignField: "loanNo",
                as: "collectionDetails"
            }
        },
        {
            $unwind: {
                path: "$collectionDetails",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "camdetails",
                localField: "leadNo",
                foreignField: "leadNo",
                as: "camDetails"
            }
        },
        {
            $unwind: {
                path: "$camDetails",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $match: {
                "camDetails.repaymentAmount": { $gt: 0 } // Filtering repaymentAmount > 0
            }
        },

        {
            $project: {
                loanNo: 1,
                leadNo: 1,
                isActive: 1,
                isClosed: 1,
                isDisbursed: 1,
                pan: 1,
                repaymentAmount: {
                    $ifNull: [
                        "$camDetails.repaymentAmount",
                        0
                    ]
                },
                outstandingAmount: {
                    $ifNull: [
                        "$collectionDetails.outstandingAmount",
                        0
                    ]
                },
                dpd: {
                    $ifNull: ["$collectionDetails.dpd", 0]
                },
                repaymentDate:
                    "$collectionDetails.repaymentDate"
            }
        }
    ]
    const loanList = await Close.aggregate(pipeline);
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