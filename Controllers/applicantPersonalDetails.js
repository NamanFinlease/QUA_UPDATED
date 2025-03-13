import asyncHandler from "../middleware/asyncHandler.js";
import Applicant from "../models/Applicant.js";
import Application from "../models/Applications.js";
import Bank from "../models/ApplicantBankDetails.js";
import Employee from "../models/Employees.js";
import Lead from "../models/Leads.js";
import { postLogs } from "./logs.js";
import { verifyBank } from "../utils/verifyBank.js";
import LoanApplication from "../models/User/model.loanApplication.js";
import PennyDrop from "../models/pennyDrop.js";

// @desc Post applicant details
// @access Private
export const applicantDetails = async (details = null, session) => {
    try {
        console.log(
            "&&&&&&&&&&&&&&&&&---details to make applicant---&&&&&&->",
            details
        );
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

        let updateData;
        const applicantDetails = await Applicant.findOne(filter);

        if (applicantDetails) {
            updateData = {
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
                residence:
                    details?.extraDetails?.residenceDetails ||
                    applicantDetails?.residence,
                incomeDetails:
                    details?.extraDetails?.incomeDetails ||
                    applicantDetails?.incomeDetails,
                employment: {
                    companyName:
                        details?.extraDetails?.employeDetails?.companyName ||
                        applicantDetails?.employment?.companyName,
                    companyAddress:
                        details?.extraDetails?.employeDetails?.officeAddrress ||
                        applicantDetails?.employment?.companyAddress,
                    state:
                        details?.extraDetails?.employeDetails?.state ||
                        applicantDetails?.employment?.state,
                    city:
                        details?.extraDetails?.employeDetails?.city ||
                        applicantDetails?.employment?.city,
                    pincode:
                        details?.extraDetails?.employeDetails?.pincode ||
                        applicantDetails?.employment?.pincode,
                    department:
                        details?.extraDetails?.employeDetails?.companyType ||
                        applicantDetails?.employment?.department,
                    designation:
                        details?.extraDetails?.employeDetails?.designation ||
                        applicantDetails?.employment?.designation,
                    employedSince:
                        details?.extraDetails?.employeDetails?.employedSince ||
                        applicantDetails?.employment?.employedSince,
                },
            };
        } else {
            updateData = {
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
                    companyName:
                        details?.extraDetails?.employeDetails?.companyName ||
                        "",
                    companyAddress:
                        details?.extraDetails?.employeDetails?.officeAddrress ||
                        "",
                    state: details?.extraDetails?.employeDetails?.state || "",
                    city: details?.extraDetails?.employeDetails?.city || "",
                    pincode:
                        details?.extraDetails?.employeDetails?.pincode || "",
                    department:
                        details?.extraDetails?.employeDetails?.companyType ||
                        "",
                    designation:
                        details?.extraDetails?.employeDetails?.designation ||
                        "",
                    employedSince:
                        details?.extraDetails?.employeDetails?.employedSince ||
                        null,
                },
            };
        }

        // Find the applicant by criteria and update if found, or create a new one
        const applicant = await Applicant.findOneAndUpdate(filter, updateData, {
            upsert: true,
            new: true,
            session,
        });
        console.log("details---->");

        let addBankDetails;
        let disbursalBankDetails = details?.extraDetails?.disbursalBankDetails;
        console.log("object", disbursalBankDetails);
        const isAlreadyBankAccount = await Bank.findOne({
            borrowerId: applicant._id,
        }).session(session);
        console.log("check bank account", isAlreadyBankAccount);
        if (isAlreadyBankAccount && disbursalBankDetails) {
            addBankDetails = await Bank.findOneAndUpdate(
                { borrowerId: applicant._id },
                {
                    beneficiaryName:
                        disbursalBankDetails?.beneficiaryName || "",
                    bankAccNo: disbursalBankDetails?.accountNumber || "",
                    accountType: disbursalBankDetails?.accountType || "",
                    ifscCode: disbursalBankDetails?.ifscCode || "",
                    bankName: disbursalBankDetails?.bankName || "",
                    branchName: disbursalBankDetails?.branchName || "",
                },
                { session, new: true }
            );
        } else if (isAlreadyBankAccount) {
            return applicant;
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
            await addBankDetails.save({ session });
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
// @desc Bank Verify and add the back.
// @route POST /api/verify/bank/pennyDrop/:bankAccount/:borrowerId
// @access Private
export const pennyDrop = asyncHandler(async (req, res) => {
    const { borrowerId, bankAccNo } = req.params;

    if(req.activeRole !== "creditManager" && req.activeRole !== "sanctionHead" && req.activeRole !== "disbursalHead"){
        res.status(400)
        throw new Error("You are not authorise for this action.")
    }

    const applicant = await Applicant.findById(borrowerId);

    if (!applicant) {
        res.status(404);
        throw new Error("No applicant found!!!");
    }
    const bank = await Bank.findOne({ bankAccNo, borrowerId });

    if (!bank) {
        res.status(404);
        throw new Error("No bank account found for this applicant!");
    }

    // if (bank) {
    //     res.status(400);
    //     throw new Error("This account number is already regested!!!");
    // }

    const response = await verifyBank(bankAccNo, bank.ifscCode);

    if (!response.success) {
        res.status(400);
        throw new Error(response.message);
    }

    const updatedBank = await Bank.findOneAndUpdate(
        { bankAccNo, borrowerId },
        { isPennyDropped: true },
        { new: true }
    );
    const pennydropData = await PennyDrop.findOneAndUpdate(
        { accountNo: bankAccNo },
        {
            $set: {
                name: response.data?.data?.name,
                accountNo: response.data?.data?.accountNumber,
                ifsc: response.data?.data?.ifsc,
                bankName: response.data?.data?.bankName,
                utr: response.data?.data?.utr,
                referenceId: response.data?.data?.referenceId,
                branch: response.data?.data?.branch,
            },
        },
        {
            new: true,
            upsert: true,
        }
    );
    console.log("bank verified", pennydropData);

    // const newBank = await Bank.create({
    //     borrowerId: id,
    //     beneficiaryName,
    //     bankName,
    //     bankAccNo,
    //     accountType,
    //     ifscCode,
    //     branchName,
    // });

    // if (newBank) {
    //     return res.json({
    //         success: true,
    //         message: "Bank verified and saved.",
    //     });
    // }
    res.json({ success: true, message: "Bank verified!!", pennydropData });
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
    if (updates.residence && Object.keys(updates.residence).length > 0) {
        Object.assign(applicant.residence, updates.residence);
    }

    // console.log('applicant 2')



    if (updates.employment && Object.keys(updates.employment).length > 0) {
        Object.assign(applicant.employment, updates.employment);
    }



    let refCheck = [];
    // Update reference if provided
    if (updates.reference && updates.reference.length > 0) {

        const newReferences = updates.reference;
        let existingReferences = applicant.reference || [];

        const newReferenceMobiles = new Set(newReferences.map((ref) => ref.mobile));

        // Fetch existing applicants & leads using reference mobiles
        const [applicantsWithSameReference, leadsWithSameMobile] = await Promise.all([
            Applicant.find({ "reference.mobile": { $in: Array.from(newReferenceMobiles) } }).lean(),
            Lead.find({
                $or: [
                    { mobile: { $in: Array.from(newReferenceMobiles) } },
                    { alternateMobile: { $in: Array.from(newReferenceMobiles) } },
                ],
            }).lean(),
        ]);

        // console.log('ref 3', applicantsWithSameReference, leadsWithSameMobile)

        // Check for duplicate references in other applicants
        const duplicateApplicantReferences = new Set();
        applicantsWithSameReference.forEach((app) => {

            app.reference.forEach((oldRef) => {
                if (newReferenceMobiles.has(oldRef.mobile) && app._id.toString() !== applicant._id.toString()) {
                    duplicateApplicantReferences.add(oldRef.mobile);
                    refCheck.push({
                        type: "Applicant",
                        applicant: `${app.personalDetails.fName} ${app.personalDetails.mName ?? ""} ${app.personalDetails.lName}`,
                        mobile: app.personalDetails.mobile,
                        companyName: app.employment.companyName,
                    });
                }
            });
        });

        // Check if reference matches any lead's mobile
        const duplicateLeadReferences = new Set();
        leadsWithSameMobile.forEach((lead) => {
            if (newReferenceMobiles.has(lead.mobile) || newReferenceMobiles.has(lead.alternateMobile)) {
                duplicateLeadReferences.add(lead.mobile);
                refCheck.push({
                    type: "Lead",
                    leadId: lead._id,
                    name: `${lead.fName} ${lead.mName ?? ""} ${lead.lName}`,
                    email: lead.personalEmail,
                    officeEmail: lead.officeEmail,
                    mobile: lead.mobile,
                    alternateMobile: lead.alternateMobile,
                });
            }
        });

        console.log('lead dup',duplicateLeadReferences,'lead dup',duplicateApplicantReferences,leadsWithSameMobile)

        // Replace existing references instead of adding new ones
        newReferences.forEach((newRef,index) => {
            if (!duplicateApplicantReferences.has(newRef.mobile) && !duplicateLeadReferences.has(newRef.mobile)) {

                if (existingReferences[index]) {
                    existingReferences[index] = newRef;
                } else if (existingReferences.length < 2) {
                    existingReferences.push(newRef);
                }
            }
        });
      // Ensure only 2 references are stored
        applicant.reference = existingReferences.slice(0, 2);

    }

    // console.log("applicant save", applicant);

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
