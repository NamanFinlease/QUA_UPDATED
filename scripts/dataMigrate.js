
//---------------------------------------------- optimisation way ------------------------------------
import mongoose from 'mongoose';
import User from '../models/User/model.user.js';
import Applicant from '../models/Applicant.js';
import Lead from '../models/Leads.js';
import LoanApplication from '../models/User/model.loanApplication.js';
import CamDetails from '../models/CAM.js';
import Bank from '../models/ApplicantBankDetails.js';
import { Loan } from './collection.js';
import fs from "fs"
import Disbursal from '../models/Disbursal.js';
import Closed from '../models/Closed.js';
import Payment from '../models/Payment.js';
import Collection from '../models/Collection.js';
import moment from 'moment';
import { calculateReceivedPayment } from '../utils/calculateReceivedPayment.js';
import OTP from '../models/User/model.Otp.js'

// Configuration
const BATCH_SIZE = 200;
// const MONGO_URI = 'mongodb+srv://ajay:zdYryDsVh90hIhMc@crmproject.4u20b.mongodb.net/QUAloanUpdatedDB?retryWrites=true&w=majority&appName=CRMProject';
const MONGO_URI = 'mongodb+srv://manish:OnlyoneLoan%40007@cluster0.vxzgi.mongodb.net/uveshTesting3?retryWrites=true&w=majority&appName=Cluster0';
const INDEXES = {
  User: [{ pan: 1 }, { aadarNumber: 1 }],
  Lead: [{ pan: 1 }, { createdAt: -1 }],
  Applicant: [{ 'personalDetails.pan': 1 }]
};

// Progress tracking
const progress = {
  users: { total: 0, processed: 0, errors: 0 },
  otp: { total: 0, processed: 0, errors: 0 },
  loans: { total: 0, processed: 0, errors: 0 },
  camDetails: { total: 0, processed: 0, errors: 0 },
  payments: { total: 0, processed: 0, errors: 0 },
  collections: { total: 0, processed: 0, errors: 0 }
};

// Helpers
async function withRetry(fn, retries = 3) {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
}

function logProgress(type) {
  const { total, processed, errors } = progress[type];
  const percent = ((processed / total) * 100 || 0).toFixed(1);
  console.log(`[${type}] ${processed}/${total} (${percent}%) | Errors: ${errors}`);
}

// Migration Functions
async function createIndexes() {
  console.log('Creating indexes...');
  await Promise.all(
    Object.entries(INDEXES).map(([modelName, indexes]) =>
      mongoose.model(modelName).createIndexes(indexes)
    )
  );
}

async function migrateUsers() {
  console.log('Starting user migration...');
  const applicants = await Applicant.find().lean();
  progress.users.total = applicants.length;

  // Pre-fetch all CamDetails and group by PAN
  const allCamDetails = await CamDetails.find().lean();
  const leads = await Lead.find().lean();

  // Create mapping: PAN -> [leadIds]
  const panToLeadIds = new Map();
  leads.forEach(lead => {
    if (!panToLeadIds.has(lead.pan)) {
      panToLeadIds.set(lead.pan, []);
    }
    panToLeadIds.get(lead.pan).push(lead._id.toString());
  });

  // Create mapping: leadId -> camDetails
  const camDetailsMap = new Map();
  allCamDetails.forEach(cam => {
    camDetailsMap.set(cam.leadId.toString(), cam);
  });

  const userOperations = [];
  for (const applicant of applicants) {
    try {
      const applicantPan = applicant.personalDetails.pan;

      // 1. Get all lead IDs for this PAN
      const leadIds = panToLeadIds.get(applicantPan) || [];

      // 2. Get all camDetails for these lead IDs
      const camDetails = leadIds
        .map(leadId => camDetailsMap.get(leadId))
        .filter(Boolean);

      // 3. Find latest camDetail
      const latestCamDetail = camDetails.sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];

      // Proceed with user data creation
      const personalDetails = {
        fullName: `${applicant.personalDetails.fName} ${applicant.personalDetails.mName} ${applicant.personalDetails.lName}`
          .replace(/\s+/g, ' ').trim(),
        gender: applicant.personalDetails.gender,
        dob: applicant.personalDetails.dob.toISOString().split('T')[0],
        personalEmail: applicant.personalDetails.personalEmail
      };

      const userData = {
        aadarNumber: applicant?.personalDetails?.aadhaar ?? "",
        PAN: applicant?.personalDetails?.pan ?? "",
        mobile: applicant?.personalDetails?.mobile ?? "",
        personalDetails,
        residenceDetails: {
          address: applicant?.residence?.address ?? "",
          city: applicant?.residence?.city ?? "",
          state: applicant?.residence?.state ?? "",
          pincode: applicant?.residence?.pincode ?? "",
          residingSince: applicant?.residence?.residingSince ?? "",
          residenceType: "OTHERS"
        },
        incomeDetails: {
          employementType: "SALARIED",
          monthlyIncome: latestCamDetail?.details?.averageSalary ?
            Number(latestCamDetail.details.averageSalary) : 0,
          obligations: latestCamDetail?.details?.obligations ?
            Number(latestCamDetail.details.obligations) : 0,
          nextSalaryDate: latestCamDetail?.details?.salaryDate1 ?
            new Date(latestCamDetail.details.salaryDate1) : null,
          incomeMode: "BANK"
        },
        profileImage: "",
        isAadharVerify: true,
        isMobileVerify: true,
        isPanVerify: true,
        isProfileImage: true,
        isPersonalDetails: true,
        isCurrentResidence: true,
        isIncomeDetails: true,
        isEmailVerify: true,
        registrationStatus: "COMPLETE_DETAILS",
        previousJourney: "COMPLETE_DETAILS",
        isCompleteRegistration: true,
        IsOldUser: true,
        authToken: ""
      };

      userOperations.push({
        updateOne: {
          filter: { aadarNumber: applicant.personalDetails.aadhaar },
          update: { $set: userData },
          upsert: true
        }
      });

      if (userOperations.length % BATCH_SIZE === 0) {
        await User.bulkWrite(userOperations);
        progress.users.processed += BATCH_SIZE;
        userOperations.length = 0;
        logProgress('users');
      }
    } catch (error) {
      progress.users.errors++;
      console.error(`Error processing applicant ${applicant._id}:`, error.message);
    }
  }

  if (userOperations.length > 0) {
    await User.bulkWrite(userOperations);
    progress.users.processed += userOperations.length;
  }
  logProgress('users');
}

async function migrateOTP() {

  console.log('Starting OTP migration...');
  const user = await User.find().lean();
  progress.otp.total = user.length;

  const otpOperations = [];
  for (const users of user) {
    try {

      const otpData = {
        otp: "",
        aadhar: users?.aadarNumber ?? "",
        mobile: users?.mobile ?? ""
      };

      otpOperations.push({
        updateOne: {
          filter: { aadhar: users.aadarNumber },
          update: { $setOnInsert: otpData },
          upsert: true
        }
      });

      if (otpOperations.length % BATCH_SIZE === 0) {
        await OTP.bulkWrite(otpOperations);
        progress.otp.processed += BATCH_SIZE;
        otpOperations.length = 0;
        logProgress('otp');
      }
    } catch (error) {
      progress.otp.errors++;
      console.error(`Error processing applicant ${users._id}:`, error.message);
    }
  }

  if (otpOperations.length > 0) {
    await OTP.bulkWrite(otpOperations);
    progress.otp.processed += otpOperations.length;
  }
  logProgress('otp');

}

async function migrateLoanApplications() {
  console.log('Starting loan application migration...');

  const [applicants, banks, camDetails, allLeads] = await Promise.all([
    Applicant.find().lean(),
    Bank.find().lean(),
    CamDetails.find().lean(),
    Lead.find().lean()
  ]);

  progress.loans.total = applicants.length;
  const bankMap = new Map(banks.map(b => [b.borrowerId.toString(), b]));

  // Create mapping of CamDetails by leadId (handling multiple camDetails per leadId)
  const camMap = new Map();
  camDetails.forEach(c => {
    const leadId = c.leadId.toString();
    if (!camMap.has(leadId)) {
      camMap.set(leadId, []);
    }
    camMap.get(leadId).push(c);
  });

  // Create PAN to Leads mapping
  const leadsByPan = new Map();
  allLeads.forEach(lead => {
    if (!leadsByPan.has(lead.pan)) {
      leadsByPan.set(lead.pan, []);
    }
    leadsByPan.get(lead.pan).push(lead._id.toString());
  });

  const loanOperations = [];
  for (const applicant of applicants) {
    try {
      const user = await User.findOne({ PAN: applicant.personalDetails.pan }).lean();
      if (!user) {
        console.error(`No user found for PAN: ${applicant.personalDetails.pan}`);
        progress.loans.errors++;
        continue;
      }

      const bankDetails = bankMap.get(applicant._id.toString());
      const leadIds = leadsByPan.get(applicant.personalDetails.pan) || [];
      if (leadIds.length === 0) {
        console.error(`No lead found for PAN: ${applicant.personalDetails.pan}`);
        progress.loans.errors++;
        continue;
      }

      // Process each lead and its associated CAM details
      for (const leadId of leadIds) {
        const camDetailsList = camMap.get(leadId) || [];
        if (camDetailsList.length === 0) {
          console.error(`No CAM details found for leadId: ${leadId}`);
          progress.loans.errors++;
          continue;
        }

        for (const camDetail of camDetailsList) {
          const loanApp = {
            userId: user?._id ?? "",
            employeeDetails: applicant?.employment ? {
              workFrom: "OFFICE",
              officeEmail: applicant?.personalDetails?.officeEmail ?? "",
              companyName: applicant?.employment?.companyName ?? "",
              companyType: "PRIVATE",
              designation: applicant?.employment?.designation ?? "",
              officeAddrress: applicant?.employment?.companyAddress ?? "",
              city: applicant?.employment?.city ?? "",
              state: applicant?.employment?.state ?? "",
              pincode: applicant?.employment?.pincode ?? "",
              landmark: ""
            } : null,
            disbursalBankDetails: bankDetails ? {
              accountNumber: bankDetails?.bankAccNo ?? "",
              ifscCode: bankDetails?.ifscCode ?? "",
              bankName: bankDetails?.bankName ?? "",
              accountType: bankDetails?.accountType.toUpperCase() ?? "",
              branchName: bankDetails?.branchName ?? "",
              beneficiaryName: bankDetails?.beneficiaryName ?? ""
            } : null,
            loanDetails: {
              principal: Number(camDetail?.details?.loanAmount ?? 0),
              totalPayble: Number(camDetail?.details?.repaymentAmount ?? 0),
              roi: parseFloat(camDetail?.details?.roi ?? 0),
              tenure: Number(camDetail?.details?.eligibleTenure ?? 0),
              loanPurpose: "OTHERS"
            },
            PAN: applicant?.personalDetails?.pan ?? "",
            progressStatus: "COMPLETED",
            previousJourney: "COMPLETED",
            applicationStatus: "PENDING",
            isLoanCalculated: true,
            isEmploymentDetailsSaved: true,
            isDisbursalDetailsSaved: true,
            isDocumentUploaded: true,
          };

          loanOperations.push({ insertOne: { document: loanApp } });

          if (loanOperations.length % BATCH_SIZE === 0) {
            console.log(`Executing bulkWrite with ${loanOperations.length} loan applications.`);
            await LoanApplication.bulkWrite(loanOperations);
            progress.loans.processed += BATCH_SIZE;
            loanOperations.length = 0;
            logProgress('loans');
          }
        }
      }
    } catch (error) {
      progress.loans.errors++;
      console.error(`Error processing applicant ${applicant._id}:`, error.message);
    }
  }

  if (loanOperations.length > 0) {
    await LoanApplication.bulkWrite(loanOperations);
    progress.loans.processed += loanOperations.length;
  }
  logProgress('loans');
}


async function migrateCamDetails() {
  console.log('Starting CAM Details migration...');
  const documents = await CamDetails.find().lean();
  progress.camDetails.total = documents.length;

  const updateOperations = [];
  for (const doc of documents) {
    try {
      if (!doc.leadId) continue;

      // Fetch lead document using leadId
      const lead = await Lead.findById(doc.leadId).lean();
      if (!lead) {
        console.warn(`No lead found for leadId: ${cam.leadId}`);
        progress.errors++;
        continue;
      }
      const updatedDoc = {
        pan: lead?.pan ?? "",
        leadNo: lead?.leadNo ?? "",
        cibilScore: Number(doc.details.cibilScore) || 0,
        loanAmount: doc.details.loanAmount || 0,
        salaryDate1: doc.details.salaryDate1 ? new Date(doc.details.salaryDate1) : null,
        salaryAmount1: doc.details.salaryAmount1 || 0,
        salaryDate2: doc.details.salaryDate2 ? new Date(doc.details.salaryDate2) : null,
        salaryAmount2: doc.details.salaryAmount2 || 0,
        salaryDate3: doc.details.salaryDate3 ? new Date(doc.details.salaryDate3) : null,
        salaryAmount3: doc.details.salaryAmount3 || 0,
        nextPayDate: doc.details.nextPayDate ? new Date(doc.details.nextPayDate) : null,
        averageSalary: parseFloat(doc.details.averageSalary) || 0,
        actualNetSalary: Number(doc.details.actualNetSalary) || 0,
        creditBureauScore: Number(doc.details.creditBureauScore) || 0,
        customerType: doc.details.customerType || 'NEW',
        dedupeCheck: doc.details.dedupeCheck === 'NO' ? 'No' : 'Yes',
        obligations: doc.details.obligations || 0,
        salaryToIncomeRatio: Number(doc.details.salaryToIncomeRatio) || 0,
        eligibleLoan: doc.details.eligibleLoan || 0,
        netDisbursalAmount: doc.details.netDisbursalAmount || 0,
        loanRecommended: doc.details.loanRecommended || 0,
        disbursalDate: doc.details.disbursalDate ? new Date(doc.details.disbursalDate) : null,
        finalSalaryToIncomeRatioPercentage: Number(doc.details.finalsalaryToIncomeRatioPercentage) || 0,
        repaymentDate: doc.details.repaymentDate ? new Date(doc.details.repaymentDate) : null,
        adminFeePercentage: doc.details.adminFeePercentage || '0',
        totalAdminFeeAmount: doc.details.totalAdminFeeAmount || 0,
        roi: doc.details.roi || 0,
        netAdminFeeAmount: doc.details.netAdminFeeAmount || 0,
        eligibleTenure: doc.details.eligibleTenure || 0,
        repaymentAmount: doc.details.repaymentAmount || 0,
        customerCategory: doc.details.customerCategory || '',
        eligiblesalaryToIncomeRatioPercentage: doc.details.eligiblesalaryToIncomeRatioPercentage || '0%',
        remarks: '',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };

      updateOperations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updatedDoc },
        },
      });

      if (updateOperations.length >= BATCH_SIZE) {
        await CamDetails.bulkWrite(updateOperations);
        progress.camDetails.processed += updateOperations.length;
        updateOperations.length = 0;
        logProgress('camDetails');
      }
    } catch (error) {
      progress.camDetails.errors++;
      console.error(`Error processing CAM Detail ${doc._id}:`, error.message);
    }
  }

  if (updateOperations.length > 0) {
    await CamDetails.bulkWrite(updateOperations);
    progress.camDetails.processed += updateOperations.length;
  }
  logProgress('camDetails');
}





// create Payment Collection-------------------------------
async function createPaymentCollection() {
  console.log('Starting Creating Payments...');
  const documents = await Loan.find().lean();
  // console.log('payments documents',documents)


  // fs.writeFileSync('scripts/closed.json', JSON.stringify(closed, null, 2));

  let paymentFile = []


  progress.payments.total = documents.length;

  const updateOperations = [];
  for (const doc of documents) {
    try {
      if (!doc.LAN) continue;

      // Fetch lead document using leadId

      const disbursal = await Disbursal.aggregate([
        {
          $match: { loanNo: doc.LAN }
        },

        {
          $lookup: {
            from: "sanctions",
            localField: "sanction",
            foreignField: "_id",
            as: "sanctionData"
          }
        },
        {
          $unwind: {
            path: "$sanctionData",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "applications",
            localField: "sanctionData.application",
            foreignField: "_id",
            as: "applicationData"
          }
        },

        {
          $unwind: {
            path: "$applicationData",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "leads",
            localField: "applicationData.lead",
            foreignField: "_id",
            as: "leadData"
          }
        },

        {
          $unwind: {
            path: "$leadData",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "camdetails",
            localField: "leadData._id",
            foreignField: "leadId",
            as: "camData"
          }
        },
        {
          $addFields: {
            camData: {
              $filter: {
                input: "$camData",
                as: "cam",
                cond: { "$gt": ["$$cam.details.repaymentAmount", null] }
              }
            }
          }
        },


        {
          $unwind: {
            path: "$camData",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "closeds",
            localField: "_id",
            foreignField: "data.disbursal",
            as: "closedData"
          }
        },

        {
          $unwind: {
            path: "$closedData",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            loanNo: 1,
            leadNo: "$leadData.leadNo",


          }
        }


      ]);
      if (!disbursal[0]) {
        console.warn(`No disbursal found for Loan Numbur: ${doc.LAN}`);
        progress.errors++;
        continue;
      }
      const closedDocs = await Closed.aggregate([
        {
          $match: {
            "data.loanNo": doc.LAN
          }
        },
        {
          $project: {
            pan: 1, // Include PAN
            data: {
              $filter: {
                input: "$data",
                as: "item",
                cond: { $eq: ["$$item.loanNo", doc.LAN] }
              }
            }
          }
        },
        {
          $unwind: "$data"
        },
        {
          $project: {
            pan: 1,
            loanNo: "$data.loanNo",
            utr: "$data.utr"
          }
        }
      ]
      )

      console.log('disbursallll', disbursal[0].loanNo, disbursal[0].leadNo)
      const updatedDoc = {
        pan: doc.PAN || "",
        leadNo: disbursal[0].leadNo || "",
        loanNo: doc.LAN || "",
        totalReceivedAmount: 0,

        paymentHistory: doc.PAID_AMT > 0 ? [{
          _id: new mongoose.Types.ObjectId(),
          receivedAmount: doc.PAID_AMT || 0,
          paymentDate: new Date(doc.PAID_DATE) || null,
          paymentMode: "offline",
          paymentMethod: "upi",
          paymentUpdateRequest: false,
          isPaymentVerified: true,
          isRejected: false,
          transactionId: closedDocs[0].utr || "",
          isPartialPaid: doc.STATUS === "Part Paid" ? true : false,
          closingType: doc.STATUS === "Closed" ? "closed"
            : doc.STATUS === "Part Paid" ? "partPayment"
              : doc.STATUS === "settel" ? "settled"
                : "", isPaymentVerified: true,
        }] : [],
        repaymentDate: new Date(doc.DOR),
        totalReceivedAmount: 0,
        interestDiscount: 0,
        penaltyDiscount: 0,
        principalDiscount: 0,
        interestReceived: 0,
        penaltyReceived: 0,
        principalReceived: 0,
        excessAmount: 0,
      }

      paymentFile.push(updatedDoc)

      // updateOperations.push({
      //   updateOne: {
      //     filter: { _id: doc._id },
      //     update: { $set: { ...updatedDoc } },
      //   },
      // });


      // if (updateOperations.length >= BATCH_SIZE) {
      //   await Payment.insertMany(paymentFile);
      //   progress.payments.processed += updateOperations.length;
      //   updateOperations.length = 0;
      //   logProgress('payments');
      // }
    } catch (error) {
      progress.payments.errors++;
      console.error(`Error processing Payments ${doc.LAN}:`, error.message);
    }
  }

  if (updateOperations.length > 0) {
    // try {

    //   await Payment.insertMany(paymentFile);
    //   progress.payments.processed += updateOperations.length;
    // } catch (error) {

    //   console.log('bulk erroro', error)

    // }
  }
  await Payment.insertMany(paymentFile)
  // fs.writeFileSync('paymentsData.json', JSON.stringify(paymentFile, null, 2));
  logProgress('payments');
}





async function createCollectionData() {
  console.log('Starting Creating Collections...');

  const payments = await Payment.find()


  progress.collections.total = payments.length;
  let collectiondocs = []
  let collectionBulk = [];
  for (let collectionData of payments) {
    let { _id, loanNo, pan, paymentHistory, interestDiscount, penaltyDiscount, principalDiscount, interestReceived, penaltyReceived, principalReceived } = collectionData
    const disbursal = await Disbursal.aggregate([
      {
        $match: { loanNo }
      },

      {
        $lookup: {
          from: "sanctions",
          localField: "sanction",
          foreignField: "_id",
          as: "sanctionData"
        }
      },
      {
        $unwind: {
          path: "$sanctionData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "applications",
          localField: "sanctionData.application",
          foreignField: "_id",
          as: "applicationData"
        }
      },

      {
        $unwind: {
          path: "$applicationData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "leads",
          localField: "applicationData.lead",
          foreignField: "_id",
          as: "leadData"
        }
      },

      {
        $unwind: {
          path: "$leadData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "camdetails",
          localField: "leadData._id",
          foreignField: "leadId",
          as: "camData"
        }
      },
      {
        $addFields: {
          camData: {
            $filter: {
              input: "$camData",
              as: "cam",
              cond: { "$gt": ["$$cam.details.repaymentAmount", null] }
            }
          }
        }
      },


      {
        $unwind: {
          path: "$camData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "closeds",
          localField: "_id",
          foreignField: "data.disbursal",
          as: "closedData"
        }
      },

      {
        $unwind: {
          path: "$closedData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          isDisbursed: 1,
          loanNo: 1,
          leadNo: "$leadData.leadNo",
          camData: {

            roi: "$camData.roi",
            tenure: "$camData.eligibleTenure",
            disbursalDate: "$camData.disbursalDate",
            repaymentDate: "$camData.repaymentDate",
            sanctionedAmount: "$camData.loanRecommended",
          },
          camDetails: "$camData._id",
          closed: "$closedData._id",
          disbursedBy: 1,

        }
      }


    ])

    console.log("loan nummmmberr ----->", loanNo, _id)


    if (disbursal.length === 0) continue

    let { _id: disbursalId, leadNo, isDisbursed, disbursedBy, camDetails, closed, camData: { roi, tenure, sanctionedAmount, disbursalDate, repaymentDate } } = disbursal[0]




    let receivedAmount = 0;
    let paymentDate = null;
    let closingType = '';

    if (Array.isArray(paymentHistory) && paymentHistory.length > 0) {
      receivedAmount = paymentHistory[0]?.receivedAmount || 0;
      closingType = paymentHistory[0]?.closingType || 0;
      paymentDate = paymentHistory[0]?.paymentDate ? moment.utc(paymentHistory[0].paymentDate).clone().local() : null;
    }



    let localDisbursedDate = moment.utc(new Date(disbursalDate)).clone().local();
    let localPaymentDate = moment.utc(paymentDate).clone().local();
    const today = moment.utc(new Date()).clone().local();
    let penalRate = 2
    let dpd
    let interest = 0
    let penalty = 0
    let principalAmount = sanctionedAmount


    const elapseDays = (closingType === "closed" || closingType === "settled") ?
      localPaymentDate.diff(localDisbursedDate, "days") + 1 : today.diff(localDisbursedDate, "days") + 1
    if (elapseDays > tenure) {
      dpd = elapseDays - tenure
      penalty = Number(Number((sanctionedAmount * (Number(penalRate) / 100)) * dpd).toFixed(2))
      interest = Number(Number((sanctionedAmount * (Number(roi) / 100)) * tenure).toFixed(2))
    } else {
      interest = Number(Number((sanctionedAmount * (Number(roi) / 100)) * tenure).toFixed(2))
    }


    let calculatedData = await calculateReceivedPayment([{
      filteredPaymentHistory: [{ receivedAmount }],
      camDetails,
      interest,
      penalty,
      penaltyDiscount,
      interestDiscount,
      principalDiscount,
      penaltyReceived,
      principalAmount,
      interestReceived,
      principalAmount,
      principalReceived,
    }])

    let outstandingAmount = calculatedData.interest + calculatedData.penalty + calculatedData.principalAmount

    if (closingType === "settled") {
      calculatedData.principalDiscount += outstandingAmount
      calculatedData.principalAmount = 0
      outstandingAmount = 0

    }


    collectiondocs.push({
      ...calculatedData,
      pan,
      loanNo,
      leadNo,
      elapseDays,
      tenure,
      closingType,
      repaymentDate,
      paymentDate,
      sanctionedAmount,
      dpd,
      isDisbursed,
      disbursedBy,
      disbursal: disbursalId,
      payment: _id,
      camDetails,
      closed,
      outstandingAmount,

    })

    let updatedPayment = await Payment.findOneAndUpdate(
      {
        loanNo,
        // "paymentHistory.transactionId": paymentHistory[0].transactionId,
      },
      {

        $inc: {
          penaltyDiscount: Number(calculatedData.penaltyDiscount.toFixed(2)),
          interestDiscount: Number(calculatedData.interestDiscount.toFixed(2)),
          principalDiscount: Number(calculatedData.principalDiscount.toFixed(2)),
          penaltyReceived: Number(calculatedData.penaltyReceived.toFixed(2)),
          interestReceived: Number(calculatedData.interestReceived.toFixed(2)),
          principalReceived: Number(calculatedData.principalReceived.toFixed(2)),
          totalReceivedAmount: Number(calculatedData.receivedAmount.toFixed(2)),

        }

      },
      { new: true, runValidators: true, }
    );

    if (outstandingAmount < 1) {

      const closed = await Closed.findOneAndUpdate(
        {
          pan: pan,
          "data.loanNo": loanNo
        },
        {
          $set: {
            "data.$[elem].isClosed": true,
            "data.$[elem].isActive": false
          }
        },
        {
          arrayFilters: [{ "elem.loanNo": loanNo }],
          returnDocument: 'after',
        }
      );
    }




    collectionBulk.push({
      updateOne: {
        filter: { _id: collectionData._id },
        update: {
          $set: {
            ...calculatedData,
            pan,
            loanNo,
            leadNo,
            elapseDays,
            tenure,
            closingType,
            repaymentDate,
            paymentDate,
            sanctionedAmount,
            dpd,
            isDisbursed,
            disbursedBy,
            disbursal: `ObjectId('${disbursalId}')`,
            payment: `ObjectId('${_id}')`,
            camDetails: `ObjectId('${camDetails}')`,
            closed: `ObjectId('${closed}')`,
            outstandingAmount: (calculatedData.interest + calculatedData.penalty + calculatedData.principalAmount),

          }
        }
      }
    });

    //   if (collectionBulk.length >= BATCH_SIZE) {
    //     await Collection.bulkWrite(collectionBulk);
    //     progress.collections.processed += collectionBulk.length;
    //     collectionBulk.length = 0;
    //     logProgress('collections');

    //   }

    // }

    // if (collectionBulk.length >= 0) {
    //   await Collection.bulkWrite(collectionBulk);
    //   progress.collections.processed += collectionBulk.length;
    //   collectionBulk.length = 0;

  }

  // console.log("jsonData", jsonData);


  fs.writeFileSync('collectionData.json', JSON.stringify(collectiondocs, null, 2));
  logProgress('collections');
  await Collection.insertMany(collectiondocs);
  // logProgress('colection',documents);
}

async function updateCollectionData() {
  console.log('Starting Creating Collections...');

  const payments = await Payment.find()


  progress.collections.total = payments.length;
  let collectiondocs = []
  let collectionBulk = [];
  for (let collectionData of payments) {
    let { _id, loanNo, pan, paymentHistory, interestDiscount, penaltyDiscount, principalDiscount, interestReceived, penaltyReceived, principalReceived } = collectionData
    const disbursal = await Disbursal.aggregate([
      {
        $match: { loanNo }
      },

      {
        $lookup: {
          from: "sanctions",
          localField: "sanction",
          foreignField: "_id",
          as: "sanctionData"
        }
      },
      {
        $unwind: {
          path: "$sanctionData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "applications",
          localField: "sanctionData.application",
          foreignField: "_id",
          as: "applicationData"
        }
      },

      {
        $unwind: {
          path: "$applicationData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "leads",
          localField: "applicationData.lead",
          foreignField: "_id",
          as: "leadData"
        }
      },

      {
        $unwind: {
          path: "$leadData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "camdetails",
          localField: "leadData._id",
          foreignField: "leadId",
          as: "camData"
        }
      },
      {
        $addFields: {
          camData: {
            $filter: {
              input: "$camData",
              as: "cam",
              cond: { "$gt": ["$$cam.details.repaymentAmount", null] }
            }
          }
        }
      },


      {
        $unwind: {
          path: "$camData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "closeds",
          localField: "_id",
          foreignField: "data.disbursal",
          as: "closedData"
        }
      },

      {
        $unwind: {
          path: "$closedData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          isDisbursed: 1,
          loanNo: 1,
          leadNo: "$leadData.leadNo",
          camData: {

            roi: "$camData.roi",
            tenure: "$camData.eligibleTenure",
            disbursalDate: "$camData.disbursalDate",
            repaymentDate: "$camData.repaymentDate",
            sanctionedAmount: "$camData.loanRecommended",
          },
          camDetails: "$camData._id",
          closed: "$closedData._id",
          disbursedBy: 1,

        }
      }


    ])

    console.log("loan nummmmberr ----->", loanNo, _id)


    if (disbursal.length === 0) continue

    let { _id: disbursalId, leadNo, isDisbursed, disbursedBy, camDetails, closed, camData: { roi, tenure, sanctionedAmount, disbursalDate, repaymentDate } } = disbursal[0]




    let receivedAmount = 0;
    let paymentDate = null;
    let closingType = '';

    if (Array.isArray(paymentHistory) && paymentHistory.length > 0) {
      receivedAmount = paymentHistory[0]?.receivedAmount || 0;
      closingType = paymentHistory[0]?.closingType || 0;
      paymentDate = paymentHistory[0]?.paymentDate ? moment.utc(paymentHistory[0].paymentDate).clone().local() : null;
    }



    let localDisbursedDate = moment.utc(new Date(disbursalDate)).clone().local();
    let localPaymentDate = moment.utc(paymentDate).clone().local();
    const today = moment.utc(new Date()).clone().local();
    let penalRate = 2
    let dpd
    let interest = 0
    let penalty = 0
    let principalAmount = sanctionedAmount


    const elapseDays = (closingType === "closed" || closingType === "settled" || closingType === "partPayment") ?
      localPaymentDate.diff(localDisbursedDate, "days") + 1 : today.diff(localDisbursedDate, "days") + 1
    if (elapseDays > tenure) {
      dpd = elapseDays - tenure
      penalty = Number(Number((sanctionedAmount * (Number(penalRate) / 100)) * dpd).toFixed(2))
      interest = Number(Number((sanctionedAmount * (Number(roi) / 100)) * tenure).toFixed(2))
    } else {
      interest = Number(Number((sanctionedAmount * (Number(roi) / 100)) * elapseDays).toFixed(2))
    }


    let calculatedData = await calculateReceivedPayment([{
      filteredPaymentHistory: [{ receivedAmount }],
      camDetails,
      interest,
      penalty,
      penaltyDiscount,
      interestDiscount,
      principalDiscount,
      penaltyReceived,
      principalAmount,
      interestReceived,
      principalAmount,
      principalReceived,
    }])

    let outstandingAmount = calculatedData.interest + calculatedData.penalty + calculatedData.principalAmount

    if (closingType === "settled") {
      calculatedData.principalDiscount += outstandingAmount
      calculatedData.principalAmount = 0
      outstandingAmount = 0

    }
    // if (closingType === "partPayment" || closingType === "") {
    //   if(paymentDate)
    //   calculatedData.principalDiscount += outstandingAmount
    //   calculatedData.principalAmount = 0
    //   outstandingAmount = 0

    // }


    collectiondocs.push({
      ...calculatedData,
      pan,
      loanNo,
      leadNo,
      elapseDays,
      tenure,
      closingType,
      repaymentDate,
      paymentDate,
      sanctionedAmount,
      dpd,
      isDisbursed,
      disbursedBy,
      disbursal: disbursalId,
      payment: _id,
      camDetails,
      closed,
      outstandingAmount,

    })

    let updatedPayment = await Payment.findOneAndUpdate(
      {
        loanNo,
        // "paymentHistory.transactionId": paymentHistory[0].transactionId,
      },
      {

        $inc: {
          penaltyDiscount: Number(calculatedData.penaltyDiscount.toFixed(2)),
          interestDiscount: Number(calculatedData.interestDiscount.toFixed(2)),
          principalDiscount: Number(calculatedData.principalDiscount.toFixed(2)),
          penaltyReceived: Number(calculatedData.penaltyReceived.toFixed(2)),
          interestReceived: Number(calculatedData.interestReceived.toFixed(2)),
          principalReceived: Number(calculatedData.principalReceived.toFixed(2)),
          totalReceivedAmount: Number(calculatedData.receivedAmount.toFixed(2)),

        }

      },
      { new: true, runValidators: true, }
    );

    if (outstandingAmount < 1) {

      const closed = await Closed.findOneAndUpdate(
        {
          pan: pan,
          "data.loanNo": loanNo
        },
        {
          $set: {
            "data.$[elem].isClosed": true,
            "data.$[elem].isActive": false
          }
        },
        {
          arrayFilters: [{ "elem.loanNo": loanNo }],
          returnDocument: 'after',
        }
      );
    }




    collectionBulk.push({
      updateOne: {
        filter: { _id: collectionData._id },
        update: {
          $set: {
            ...calculatedData,
            pan,
            loanNo,
            leadNo,
            elapseDays,
            tenure,
            closingType,
            repaymentDate,
            paymentDate,
            sanctionedAmount,
            dpd,
            isDisbursed,
            disbursedBy,
            disbursal: `ObjectId('${disbursalId}')`,
            payment: `ObjectId('${_id}')`,
            camDetails: `ObjectId('${camDetails}')`,
            closed: `ObjectId('${closed}')`,
            outstandingAmount: (calculatedData.interest + calculatedData.penalty + calculatedData.principalAmount),

          }
        }
      }
    });

    // if (collectionBulk.length >= BATCH_SIZE) {
    //   await Collection.bulkWrite(collectionBulk);
    //   progress.collections.processed += collectionBulk.length;
    //   collectionBulk.length = 0;
    //   logProgress('collections');

    // }
    if (elapseDays <= tenure) {
      await Collection.findOneAndUpdate(
        { loanNo: loanNo },
        {
          $set: {
            principalAmount: calculatedData.principalAmount,
            penalty: calculatedData.penalty,
            interest: calculatedData.interest,
            outstandingAmount
          }
        }
      );

    }

  }

  // if (collectionBulk.length >= 0) {
  //   await Collection.bulkWrite(collectionBulk);
  //   progress.collections.processed += collectionBulk.length;
  //   collectionBulk.length = 0;

  // }

  // console.log("jsonData", jsonData);


  fs.writeFileSync('collectionData.json', JSON.stringify(collectiondocs, null, 2));
  logProgress('collections');
  // await Collection.insertMany(collectiondocs);
  // logProgress('colection',documents);
}


async function runMigration() {
  try {
    await mongoose.connect(MONGO_URI);

    // await createIndexes();
    // await withRetry(() => migrateUsers());
    // await withRetry(() => migrateOTP());
    // await withRetry(() => migrateLoanApplications());
    // await withRetry(() => migrateCamDetails());
    // await withRetry(() => createPaymentCollection());
    // await withRetry(() => createCollectionData());
    await withRetry(() => updateCollectionData());


    console.log('\nMigration Summary:');
    // console.log('Users:', progress.users);
    // console.log('OTP:', progress.otp);
    // console.log('Loans:', progress.loans);
    // console.log('CAM Details:', progress.camDetails);
    // console.log('Payments:', progress.payments);
    console.log('Collection:', progress.collections);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Execute migration
runMigration();