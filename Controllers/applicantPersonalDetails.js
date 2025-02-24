import asyncHandler from "../middleware/asyncHandler.js";
import Applicant from "../models/Applicant.js";
import Application from "../models/Applications.js";
import Bank from "../models/ApplicantBankDetails.js";
import Employee from "../models/Employees.js";
import Lead from "../models/Leads.js";
import { postLogs } from "./logs.js";
import { verifyBank } from "../utils/verifyBank.js";

// @desc Post applicant details
// @access Private
export const applicantDetails = async (details = null, session) => {
    try {
        console.log("&&&&&&&&&&&&&&&&&---details to make applicant---&&&&&&->", details)
        if (!details) {
            throw new Error("Details are required");
        }

        // Define the criteria to find an existing applicant
        const filter = {
            $and: [
                { "personalDetails.pan": details.pan }, // Check if PAN matches
                { "personalDetails.aadhaar": details.aadhaar }, // Check if Aadhaar matches
            ],
        };

        // Define the data to update if the applicant exists, or to create if not
        // yhi se hi lead se data pass  krna h yha 


        const updateData = {
            personalDetails: {
                fName: details.fName,
                mName: details.mName,
                lName: details.lName,
                gender: details.gender,
                dob: details.dob,
                mobile: details.mobile,
                alternateMobile: details.alternateMobile,
                personalEmail: details.personalEmail,
                officeEmail: details.officeEmail,
                screenedBy: details.screenedBy,
                pan: details.pan,
                aadhaar: details.aadhaar,
            },
            residence: details?.extraDetails?.residenceDetails || {},
            incomeDetails: details?.extraDetails?.incomeDetails || {},
            employment: {
                companyName: details?.extraDetails?.employeDetails?.companyName || "",
                companyAddress: details?.extraDetails?.employeDetails?.officeAddrress || "",
                state: details?.extraDetails?.employeDetails?.state || "",
                city: details?.extraDetails?.employeDetails?.city || "",
                pincode: details?.extraDetails?.employeDetails?.pincode || "",
                department: details?.extraDetails?.employeDetails?.companyType || "",
                designation: details?.extraDetails?.employeDetails?.designation || "",
                employedSince: details?.extraDetails?.employeDetails?.employedSince || null
            },
        };

        // Find the applicant by criteria and update if found, or create a new one
        const applicant = await Applicant.findOneAndUpdate(filter, updateData, {
            upsert: true,
            new: true,
            session
        });
        console.log("details---->")

        let addBankDetails
        let disbursalBankDetails = details?.extraDetails?.disbursalBankDetails
        const isAlreadyBankAccount = await Bank.findOne({ borrowerId: applicant._id }).session(session)
        if (isAlreadyBankAccount) {
            addBankDetails = await Bank.findOneAndUpdate(
                { borrowerId: applicant._id },
                {
                    beneficiaryName: disbursalBankDetails?.beneficiaryName || "",
                    bankAccNo: disbursalBankDetails?.accountNumber || "",
                    accountType: disbursalBankDetails?.accountType || "",
                    ifscCode: disbursalBankDetails?.ifscCode || "",
                    bankName: disbursalBankDetails?.bankName || "",
                    branchName: disbursalBankDetails?.branchName || "",
                },
                { session, new: true }
            );
        } else {
            addBankDetails = new Bank({
                borrowerId: applicant._id,
                beneficiaryName: disbursalBankDetails?.beneficiaryName || "",
                bankAccNo: disbursalBankDetails?.accountNumber || "",
                accountType: disbursalBankDetails?.accountType || "",
                ifscCode: disbursalBankDetails?.ifscCode || "",
                bankName: disbursalBankDetails?.bankName || "",
                branchName: disbursalBankDetails?.branchName || "",
            });
            addBankDetails.save({ session })
        }



        return applicant;
    } catch (error) {
        throw new Error(error.message);
    }
};


// @desc Bank Verify and add the back.
// @route POST /api/verify/bank
// @access Private
export const bankVerification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        beneficiaryName,
        bankAccNo,
        accountType,
        ifscCode,
        bankName,
        branchName,
    } = req.body;

    const applicant = await Applicant.findById(id);
    const bank = await Bank.findOne({ bankAccNo: bankAccNo });

    if (!applicant) {
        res.status(404);
        throw new Error("No applicant found!!!");
    }

    if (bank) {
        res.status(400);
        throw new Error("This account number is already regested!!!");
    }

    const response = await verifyBank(bankAccNo, ifscCode);

    if (!response.success) {
        res.status(400);
        throw new Error(response.message);
    }

    const newBank = await Bank.create({
        borrowerId: id,
        beneficiaryName,
        bankName,
        bankAccNo,
        accountType,
        ifscCode,
        branchName,
    });

    if (newBank) {
        return res.json({
            success: true,
            message: "Bank verified and saved.",
        });
    }
    res.json({ success: false, message: "Bank couldn't be verified!!" });
});

// @desc Update applicant details
// @route PATCH /api/applicant/:id
// @access Private
export const updateApplicantDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Check if the application is present
    const application = await Application.findOne({ _id: id }).populate({
        path: "lead",
        populate: { path: "documents" },
    });

    // Check if credit Manager matches the one in the application document
    if (
        application.creditManagerId.toString() !== req.employee._id.toString()
    ) {
        res.status(403);
        throw new Error("Unauthorized: You can not update this application!!");
    }

    // Find the current applicant
    const applicant = await Applicant.findOne({ _id: application.applicant });

    if (!applicant) {
        res.status(404);
        throw new Error("Applicant not found!");
    }

    // Update residence if provided
    if (updates.residence) {
        applicant.residence = {
            ...applicant.residence, // Retain existing data
            ...updates.residence, // Merge with new data
        };
    }

    // Update employment if provided
    if (updates.employment) {
        applicant.employment = {
            ...applicant.employment, // Retain existing data
            ...updates.employment, // Merge with new data
        };
    }

    // Fetch all applicants and leads
    const allApplicants = await Applicant.find({});
    const allLeads = await Lead.find({});

    let refCheck = [];
    // Update reference if provided
    if (updates.reference && updates.reference.length > 0) {
        updates.reference.forEach((newRef) => {
            // Find all applicants who have used the same reference (mobile number)
            const applicantsWithSameReference = allApplicants.filter(
                (applicants) =>
                    applicants.reference.some(
                        (oldRef) => oldRef.mobile === newRef.mobile
                    )
            );
            if (applicantsWithSameReference.length > 0) {
                // Add all applicants who used the same reference to refCheck
                applicantsWithSameReference.forEach((applicants) => {
                    refCheck.push({
                        type: "Applicant",
                        applicant: `${applicants.personalDetails.fName}${applicants.personalDetails.mName ??
                            ` ${applicants.personalDetails.mName} ${applicants.personalDetails.lName}`
                            }`,
                        mobile: `${applicants.personalDetails.mobile}`,
                        companyName: `${applicants.employment.companyName}`,
                    });
                });
            }

            // Check if the reference mobile was ever a lead
            const leadWithSameMobile = allLeads.filter(
                (lead) =>
                    lead.mobile === newRef.mobile ||
                    lead.alternateMobile === newRef.mobile
            );

            if (leadWithSameMobile.length > 0) {
                // Add all leads with the same mobile to refCheck
                leadWithSameMobile.forEach((lead) => {
                    refCheck.push({
                        type: "Lead",
                        leadId: lead._id,
                        name: `${lead.fName}${lead.mName && ` ${lead.mName}`} ${lead.lName
                            }`,
                        email: lead.personalEmail,
                        officeEmail: lead.officeEmail,
                        mobile: lead.mobile,
                        alternateMobile: lead.alternateMobile,
                    });
                });
            }
            applicant.reference.push(newRef);
        });
    }

    // Save the updated applicant
    await applicant.save();

    const employee = await Employee.findOne({
        _id: req.employee._id.toString(),
    });
    const logs = await postLogs(
        application.lead._id,
        "APPLICANT PERSONAL DETAILS UPDATED",
        `${application.lead.fName} ${application.lead.mName ?? ""} ${application.lead.lName
        }`,
        `Applicant personal details updated by ${employee.fName} ${employee.lName}`
    );

    // Send the updated personal details as a JSON response
    return res.json({ refCheck, logs });
});

// @desc Update Applicant Bank Details
// @route PATCH /api/applicant/bankDetails/:id
// @access Private
export const updateApplicantBankDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        beneficiaryName,
        bankAccNo,
        accountType,
        ifscCode,
        bankName,
        branchName,
    } = req.body;

    const applicant = await Applicant.findById(id);
    if (!applicant) {
        res.status(404);
        throw new Error("No applicant found!!!");
    }

    const verify = await verifyBank(bankAccNo, ifscCode);

    if (!verify.success) {
        res.status(400);
        throw new Error(verify.message);
    }

    // Check if there's already existing bank details for this applicant
    const bankDetails = await Bank.findOneAndUpdate(
        { borrowerId: id },
        {
            $set: {
                beneficiaryName: beneficiaryName,
                bankAccNo: bankAccNo,
                accountType: accountType,
                ifscCode: ifscCode,
                bankName: bankName,
                branchName: branchName,
            },
        },
        {
            new: true, // Return the updated document
        }
    );

    if (!bankDetails) {
        res.status(400);
        throw new Error("Unable to add or update bank details");
    }

    res.status(200).json({ success: true, messag: "Bank details updated" });
});

// @desc Get applicant Bank Details
// @route GET /api/applicant/bankDetails/:id
// @access Private
export const getApplicantBankDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const bank = await Bank.findOne({ borrowerId: id });

    if (!bank) {
        return res.json({ message: "No bank found!!" });
    }
    res.json(bank);
});

// @desc Get Applicant Personal details
// @route GET /api/applicant/:id
// @access Private
export const getApplicantDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const applicant = await Applicant.findById(id);
    if (!applicant) {
        res.status(404);
        throw new Error("No applicant found!!");
    }

    res.json(applicant);
});
