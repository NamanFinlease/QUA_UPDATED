import asyncHandler from '../../middleware/asyncHandler.js';
import User from '../../models/User/model.user.js';
import LoanApplication from '../../models/User/model.loanApplication.js';
import Documents from '../../models/Documents.js';
import Lead from '../../models/Leads.js'
import LeadStatus from '../../models/LeadStatus.js'
import { nextSequence } from "../../utils/nextSequence.js";
import { postLogs } from "../../Controllers/logs.js"
import checkUploadedDocuments from "../../utils/User/isDocumentUploaded.js"
import splitName from "../../utils/splitName.js"
import { postUserLogs } from './controller.userLogs.js';
import { getDocs } from '../../utils/User/docsUploadAndFetch.js';
import Closed from '../../models/Closed.js';
import { sessionAsyncHandler } from '../../middleware/sessionAsyncHandler.js'
import LandingPageLead from '../../models/LandingPageLead.js';
import Employee from '../../models/Employees.js';
import Close from '../../models/close.js';



const calculateLoan = asyncHandler(async (req, res) => {
    const loanDetails = req.body;
    const { principal, totalPayble, roi, tenure } = loanDetails;

    if (
        principal <= 0 ||
        totalPayble <= 0 ||
        roi <= 0 ||
        tenure <= 0
    ) {
        return res.status(400).json({ message: "Invalid input" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    if (!user.isCompleteRegistration) {
        return res.status(400).json({ message: "firstly please complete your registration" })
    }

    let loanApplication
    // check in closed if any loan have been pending yet
    const pipeline = [
        {
            $match: { 
                pan: user.PAN,
                isActive:true,
                isClosed:false,
             }
        },
        
    ]
    const result = await Close.aggregate(pipeline)
    if (result.length > 0) {
        return res.status(400).json({ message: `You have already ${countPreviousActiveLoan} active loan` })

    }

    let previousLoanApplication = await LoanApplication.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (previousLoanApplication) {
        if (previousLoanApplication?.applicationStatus === "LEAD_CREATED" || previousLoanApplication?.applicationStatus === "APPROVED") {
            return res.status(400).json({ message: "You cant edit this because Lead has been sent to Screener" })
        }

        if (previousLoanApplication?.applicationStatus === 'PENDING') {
            previousLoanApplication.loanDetails = loanDetails;
            previousLoanApplication.isLoanCalculated = true
            await previousLoanApplication.save();
            loanApplication = previousLoanApplication
            return res.status(200).json({ message: "Loan Application updated successfully" });
        }
        if (previousLoanApplication?.applicationStatus === 'REJECTED') {
            if (previousLoanApplication?.expiryDate > new Date()) {
                const diffInMs = previousLoanApplication?.expiryDate - new Date();
                const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                return res.status(400).json({ message: `You can apply loan after ${diffInDays} days , because your previous loan application have been rejected` })
            }
            else {
                loanApplication = await LoanApplication.create({
                    userId: user._id,
                    PAN: user.PAN,
                    isLoanCalculated: true,
                    loanDetails
                });
            }
        }
        if (previousLoanApplication?.applicationStatus === 'CLOSED') {
            loanApplication = await LoanApplication.create({
                userId: user._id,
                PAN: user.PAN,
                isLoanCalculated: true,
                loanDetails
            });
        }
    }

    else {
        loanApplication = await LoanApplication.create({
            userId: user._id,
            PAN: user.PAN,
            isLoanCalculated: true,
            loanDetails
        });

    }

    return res.status(200).json({ message: "Loan Application created successfully", loanApplication: loanApplication.loanDetails });

});

const addEmploymentInfo = asyncHandler(async (req, res) => {
    const employeInfo = req.body;
    const userId = req.user._id;
    if (!employeInfo || !userId) {
        return res.status(400).json({ message: "Invalid input" });
    }

    if (employeInfo.employedSince) {
        const dateString = employeInfo.employedSince;
        const isoDate = new Date(dateString);
        employeInfo.employedSince = isoDate
    }


    // Validation for employment information
    const requiredFields = [
        "workFrom",
        "officeEmail",
        "companyName",
        "companyType",
        "designation",
        "officeAddrress",
        "city",
        "state",
        "pincode"
    ];

    const missingFields = requiredFields.filter((field) => !employeInfo[field] || employeInfo[field].trim() === "");

    if (missingFields.length > 0) {
        return res.status(400).json({
            message: "Missing or empty required fields",
            missingFields,
        });
    }

    const loanDetails = await LoanApplication.findOne(
        { userId: userId },
    ).sort({ createdAt: -1 });

    if (!loanDetails) {
        return res.status(400).json({ message: "Loan Application not found" })
    }
    if (loanDetails.applicationStatus === "LEAD_CREATED") {
        return res.status(400).json({ message: "You cant edit this because Lead has been sent to Screener" })
    }

    let progressStatus
    let previousJourney
    if (loanDetails.progressStatus == "CALCULATED") {
        progressStatus = "EMPLOYMENT_DETAILS_SAVED",
            previousJourney = "CALCULATED"
    }

    if (loanDetails.progressStatus != "CALCULATED") {
        progressStatus = loanDetails.progressStatus,
            previousJourney = loanDetails.previousJourney
    }


    const addEmploymentInfo = await LoanApplication.findOneAndUpdate(
        { userId: userId },
        {
            $set: {
                employeeDetails: employeInfo,
                progressStatus: progressStatus,
                previousJourney: previousJourney,
                isEmploymentDetailsSaved: true
            }
        },

        {
            new: true,
            sort: { createdAt: -1 }

        }
    );

    if (!addEmploymentInfo) {
        return res.status(400).json({ message: "Employment Info not added" });
    }
    await postUserLogs(userId, `User add employment info`)
    return res.status(200).json({ message: "Employment Info added successfully", EmploymentInfo: addEmploymentInfo.employeeDetails });
});

const disbursalBankDetails = sessionAsyncHandler(async (req, res, session) => {

    console.log("bank details 1")
    const bankDetails = req.body;
    const userId = req.user._id;
    if (!bankDetails || !userId) {
        return res.status(400).json({ message: "Invalid input" });
    }
    console.log("bank details 2")


    const loanDetails = await LoanApplication.findOne(
        { userId: userId }
    ).sort({ createdAt: -1 }).session(session);

    console.log("bank details 3")
    if (!loanDetails) {
        return res.status(400).json({ message: "Loan Application not found" })
    }
    console.log("bank details 4")

    if (loanDetails.applicationStatus === "LEAD_CREATED") {
        return res.status(400).json({ message: "You cant edit this because Lead has been sent to Screener" })
    }

    console.log("bank details 5")
    let progressStatus
    let previousJourney
    if (loanDetails.progressStatus == "DOCUMENTS_SAVED") {
        progressStatus = "COMPLETED",
            previousJourney = "DISBURSAL_DETAILS_SAVED"
    }

    console.log("bank details 6")
    if (loanDetails.progressStatus != "DOCUMENTS_SAVED") {
        progressStatus = loanDetails.progressStatus,
            previousJourney = loanDetails.previousJourney
    }
    console.log("bank details 7")


    const updatedLoanDetails = await LoanApplication.findOneAndUpdate(
        { _id: loanDetails._id },
        {
            $set: {
                disbursalBankDetails: bankDetails,
                progressStatus: progressStatus,
                previousJourney: previousJourney,
                isDisbursalDetailsSaved: true,
                // applicationStatus: "LEAD_CREATED"

            }
        },

        {
            new: true,
            session

        }
    );
    console.log("bank details 8")

    if (!updatedLoanDetails) {
        return res.status(400).json({ message: "Bank Details not added" });
    }
    console.log("bank details 9")
    await postUserLogs(userId, `User add bank  disbursal details`, session)
    console.log("bank details 10")

    const userDetails = await User.findById(userId).session(session);
    if (!userDetails) {
        return res.status(400).json({ message: "User not found" });
    }
    console.log("bank details 11")
    let docs;
    let pan = userDetails.PAN
    const existingDoc = await Documents.findOne({ pan: userDetails.PAN }).session(session);;
    console.log("bank details 12")
    if (existingDoc) {
        docs = existingDoc;
    } else {
        docs = new Documents({ pan });
        await docs.save({ session });
    }
    console.log("bank details 13")

    const isDocumentUploaded = checkUploadedDocuments(docs.document)
    console.log("bank details 14")
    console.log("document checker -->", isDocumentUploaded)
    if (!isDocumentUploaded.isComplete) {
        return res.status(400).json({ message: "Please upload all documents", missingDocument: isDocumentUploaded.missingDocuments })
    }
    console.log("bank details 15")



    // pass extraObject In Lead
    const personalDetails = userDetails.personalDetails
    const employeDetails = updatedLoanDetails.employeeDetails
    const disbursalBankDetails = updatedLoanDetails.disbursalBankDetails
    // console.log(" loan details ----->", updatedLoanDetails)
    // console.log(" disbursal bank details ---->", updatedLoanDetails.disbursalBankDetails)
    const residenceDetails = userDetails.residenceDetails
    const incomeDetails = userDetails.incomeDetails


    console.log("bank details 16")


    // logic of creating lead

    const { fName, mName, lName } = splitName(userDetails.personalDetails.fullName)

    console.log("bank details 17")

    const leadNo = await nextSequence("leadNo", "QUALED", 10);

    console.log("bank details 17", new Date(userDetails.personalDetails.dob))
    const leadStatus = new LeadStatus({
        pan,
        leadNo,
        isInProcess: true,
    });
    await leadStatus.save({ session });


    // const [day, month, year] = userDetails.personalDetails.dob.split('-');
    // console.log("bank details 18", day, month, year)
    // // const dob = new Date(`${year}-${month}-${day}`);
    // const dob = new Date(userDetails.personalDetails.dob);
    // console.log("bank details 19", dob)
    let extraDetails = {
        personalDetails,
        employeDetails,
        residenceDetails,
        incomeDetails,
        disbursalBankDetails,
    }
    console.log("extraDetails---> before create lead", extraDetails)
    const newLead = new Lead({
        userId,
        fName: fName,
        mName: mName,
        lName: lName,
        gender: userDetails.personalDetails.gender,
        dob: userDetails.personalDetails?.dob,
        leadNo,
        aadhaar: userDetails.aadarNumber,
        pan: userDetails.PAN,
        documents: docs._id.toString(),
        mobile: String(userDetails.mobile),
        alternateMobile: userDetails.alternateMobile ? String(userDetails.alternateMobile) : "",
        personalEmail: userDetails.personalDetails.personalEmail ? userDetails.personalDetails.personalEmail : "",
        officeEmail: loanDetails.employeeDetails.officeEmail ? loanDetails.employeeDetails.officeEmail : "",
        loanAmount: loanDetails.loanDetails.principal,
        salary: userDetails.incomeDetails.monthlyIncome,
        pinCode: userDetails.residenceDetails.pincode,
        state: userDetails.residenceDetails.state,
        city: userDetails.residenceDetails.city,
        source: req?.platformType || "website",
        leadStatus: leadStatus._id,
        isAadhaarVerified: true,
        isAadhaarDetailsSaved: true,
        isPanVerified: true,
        isEmailVerified: true,
        isMobileVerified: true,
        loanApplicationId: loanDetails._id,
        mothersName: userDetails.personalDetails.mothersName ? userDetails.personalDetails.mothersName : "",
        fathersName: userDetails.personalDetails.fathersName ? userDetails.personalDetails.fathersName : "",
        workingSince: userDetails.incomeDetails.workingSince ? userDetails.incomeDetails.workingSince : "",
        extraDetails
    });

    await newLead.save({ session })

    console.log("newLead created--->", newLead)

    let remarks = [];
    if (newLead) {
        updatedLoanDetails.applicationStatus = "LEAD_CREATED"

        // auto reject lead by employeeType , payment cash or other , sallary less then 30k 


        if (userDetails.incomeDetails.employementType === "SELF EMPLOYED") {
            newLead.isRejected = true;
            newLead.isRejectedBySystem = true
            updatedLoanDetails.applicationStatus = "REJECTED",
                updatedLoanDetails.sanction = "REJECTED"
            updatedLoanDetails.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            remarks.push("User is SELF EMPLOYED");
        }

        if (userDetails.incomeDetails.incomeMode === "CASH" || userDetails.incomeDetails.incomeMode === "OTHERS") {
            newLead.isRejected = true;
            newLead.isRejectedBySystem = true
            updatedLoanDetails.applicationStatus = "REJECTED",
                updatedLoanDetails.sanction = "REJECTED"
            updatedLoanDetails.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            remarks.push(`User income mode is ${userDetails.incomeDetails.incomeMode}`);
        }

        if (!userDetails.IsOldUser && userDetails.incomeDetails.monthlyIncome < 35000) {
            newLead.isRejected = true;
            newLead.isRejectedBySystem = true
            updatedLoanDetails.applicationStatus = "REJECTED",
                updatedLoanDetails.sanction = "REJECTED"
            updatedLoanDetails.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            remarks.push(`User monthly income is ${userDetails.incomeDetails.monthlyIncome}`);
        }

        if (remarks.length > 0) {
            newLead.remarks = remarks.join(" | ");
        }

        updatedLoanDetails.leadNo = newLead.leadNo;
        updatedLoanDetails.leadId = newLead._id;
        await updatedLoanDetails.save({ session });
        await newLead.save({ session });
    }


    // viewLeadsLog(req, res, status || '', borrower || '', leadRemarks = '');
    const logs = await postLogs(
        newLead._id,
        "NEW LEAD",
        `${newLead.fName}${newLead.mName && ` ${newLead.mName}`}${newLead.lName && ` ${newLead.lName}`
        }`,
        "New lead created",
        "",
        session
    );
    if (newLead.isRejected) {
        await postLogs(
            newLead._id,
            "LEAD AUTO REJECTED",
            `${newLead.fName}${newLead.mName && ` ${newLead.mName}`}${newLead.lName && ` ${newLead.lName}`
            }`,
            `${remarks.join(" | ")}`,
            "",
            session
        );
    }

    // add marketing Logic
    const marketingLead = await LandingPageLead.findOne({
        pan: pan,
        isComplete: false,
        isRejected: false,
        screenerId: { $exists: true, $ne: null }
    }).session(session)
    if (marketingLead) {
        marketingLead.isComplete = true
        newLead.screenerId = marketingLead.screenerId
        newLead.source = "marketing"
        await marketingLead.save({ session });
        await newLead.save({ session });

        const employee = await Employee.findById(marketingLead?.screenerId).session(session)
        if (!employee) {
            throw new Error("Employee not found")
        }
        // create post log
        await postLogs(
            newLead._id,
            "LEAD IN PROCESS",
            `${newLead.fName} ${newLead.mName ?? ""} ${newLead.lName}`,
            `Marketing Lead auto allocated to ${employee.fName} ${employee.lName}`,
            "",
            session
        );

    }
    updatedLoanDetails.loanUnderProcess = "SUCCESS"
    await updatedLoanDetails.save({ session });


    return res.status(200).json({ message: "Loan Applied successfully!", newLead, logs });
});

const getApplicationStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const user = await User.findById(userId)
    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    const loanDetails = await LoanApplication.findOne({ userId: userId }).sort({ createdAt: -1 });
    if (!loanDetails) {
        return res.status(400).json({ message: "Loan Application not found" });
    }

    return res.status(200).json({ message: "Loan Application found", applicationStatus: loanDetails.applicationStatus, progressStatus: loanDetails.progressStatus });
});

const getApplicationDetails = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { applicationStatus } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "Invalid input" });
    }

    let loanApplicationDetails
    const datas = await LoanApplication.findOne({ userId })
        .sort({ createdAt: -1 }) // Sort in descending order (latest first)
        .skip(1) // Skip the latest document
        .limit(1);
    if (datas) {
        loanApplicationDetails = datas
    }
    if (!datas) {
        loanApplicationDetails = await LoanApplication.findOne({ userId })
            .sort({ createdAt: -1 }) // Sort in descending order (latest first)
    }
    console.log("loanApplication--0->", loanApplicationDetails)

    if (!loanApplicationDetails) {
        return res.status(200).json({ message: "Loan Application not found" });
    }

    let data;

    if (applicationStatus == "loanDetails") {
        data = loanApplicationDetails.loanDetails
        return res.status(200).json({ message: "sucessfully fetched", data });
    }

    if (applicationStatus == "employeeDetails") {
        data = loanApplicationDetails.employeeDetails
        return res.status(200).json({ message: "sucessfully fetched", data });
    }

    if (applicationStatus == "disbursalBankDetails") {
        data = loanApplicationDetails.disbursalBankDetails
        return res.status(200).json({ message: "sucessfully fetched", data });
    }

    data = loanApplicationDetails
    return res.status(200).json({ message: "sucessfully fetched", data });

});

const getDocumentStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const userDetails = await User.findById(userId);
    const pan = userDetails.PAN;
    const data = await Documents.findOne({ pan: pan });

    // implementing aggregation pipeline

    // const pipeline = [
    //     {
    //       $match: {
    //         pan: pan
    //       }
    //     },
    //     {
    //       $project: {
    //         multipleDocumentsStatus: {
    //           $map: {
    //             input: {
    //               $objectToArray:
    //                 "$document.multipleDocuments"
    //             },
    //             as: "doc",
    //             in: {
    //               type: "$$doc.k",
    //               status: {
    //                 $cond: {
    //                   if: {
    //                     $gt: [
    //                       {
    //                         $size: "$$doc.v"
    //                       },
    //                       0
    //                     ]
    //                   },
    //                   then: "Uploaded",
    //                   else: "Not Uploaded"
    //                 }
    //               }
    //             }
    //           }
    //         },
    //         singleDocumentsStatus: {
    //           $map: {
    //             input: "$document.singleDocuments",
    //             as: "doc",
    //             in: {
    //               type: "$$doc.type",
    //               status: "Uploaded"
    //             }
    //           }
    //         }
    //       }
    //     }
    //   ]

    // const reults = await Documents.aggregate(pipeline); 

    const multipleDocs = data.document.multipleDocuments;
    const singleDocs = data.document.singleDocuments;

    // Check multiple documents
    const multipleDocumentsStatus = {};
    for (const [key, value] of Object.entries(multipleDocs)) {
        multipleDocumentsStatus[key] = value.length > 0 ? 'Uploaded' : 'Not Uploaded';
    }

    // Check single documents
    const singleDocumentsStatus = singleDocs.map(doc => ({
        type: doc.type,
        status: 'Uploaded',
    }));

    const response = {
        multipleDocumentsStatus,
        singleDocumentsStatus,
    };

    return res.status(200).json(response);

})



const getDocumentList = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Fetch user details to get PAN
    const userDetails = await User.findById(userId);
    if (!userDetails || !userDetails.PAN) {
        return res.status(404).json({ message: "User or PAN not found" });
    }

    // Find the documents by PAN
    const result = await Documents.findOne(
        { pan: userDetails.PAN },
        {
            "document.singleDocuments": 1,
            "document.multipleDocuments": 1,
        }
    );

    if (result) {
        // Process `singleDocuments`
        const singleDocuments = result.document.singleDocuments.map(doc => ({
            id: doc._id || null,
            name: doc.name,
            type: doc.type || null,
            url: doc.url || null,
            remarks: doc.remarks || null
        }));

        // Process `multipleDocuments` and limit to max 3 per type
        const multipleDocuments = [];
        const multipleDocs = result.document.multipleDocuments;

        for (const [key, docsArray] of Object.entries(multipleDocs)) {
            docsArray.slice(0, 3).forEach(doc => { // Take only the first 3 documents of each type
                multipleDocuments.push({
                    id: doc._id || null,
                    name: doc.name,
                    type: key, // Use the key (e.g., bankStatement, salarySlip) as the type
                    url: doc.url || null,
                    remarks: doc.remarks || null
                });
            });
        }

        // Combine both lists into one array
        const allDocuments = [...multipleDocuments, ...singleDocuments];

        return res.status(200).json({ documents: allDocuments });
    }

    // Return an empty array if no documents match the given PAN
    return res.status(200).json({ documents: [] });
});


const documentPreview = asyncHandler(async (req, res) => {

    const { docType } = req.query;
    const docId = req.query.docId;

    let userDetails = await User.findById(req.user._id);


    if (!userDetails) {
        res.status(404);
        throw new Error("Lead not found!!!");
    }
    const docs = await Documents.findOne({ pan: userDetails.PAN });
    console.log(docs);

    const result = await getDocs(docs, docType, docId);

    // Return the pre-signed URL for this specific document
    res.json({
        type: docType,
        url: result.preSignedUrl,
        mimeType: result.mimeType,
    });

})

const getJourney = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const loanDetails = await LoanApplication.findOne({ userId: userId }).sort({ createdAt: -1 });
    console.log("loanDetails--->", loanDetails)
    if (!loanDetails) {
        return res.status(400).json({ message: "Loan Application not found" });
    }
    const journey = await LoanApplication.findById(loanDetails._id);
    console.log("journey--->", journey)
    if (!journey) {
        return res.status(400).json({ message: "Loan Application not found" });
    }

    let data = {
        loanUnderProcess: journey.loanUnderProcess,
        sanction: journey.sanction,
        disbursed: journey.disbursed
    }
    return res.status(200).json({ message: "Loan Application journey found", journey: data })
});


export { calculateLoan, addEmploymentInfo, getApplicationStatus, getApplicationDetails, disbursalBankDetails, getDocumentStatus, getDocumentList, documentPreview, getJourney }