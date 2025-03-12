import asyncHandler from "../middleware/asyncHandler.js";
import Closed from "../models/Closed.js";
import Lead from "../models/Leads.js";
import Application from "../models/Applications.js";
import Employee from "../models/Employees.js";
import { postLogs } from "./logs.js";
import LeadStatus from "../models/LeadStatus.js";
import Sanction from "../models/Sanction.js";
import Disbursal from "../models/Disbursal.js";
import LoanApplication from "../models/User/model.loanApplication.js";
import Close from "../models/close.js";

// @desc Rejecting a lead
// @route PATCH /api/leads/reject/:id or /api/applications/reject/:id
// @access Private
export const rejected = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    console.log('reject 1')
    const employee = await Employee.findOne({ _id: req.employee._id });

    // List of roles that are authorized to hold a lead
    // const authorizedRoles = [
    //     "screener",
    //     "admin",
    //     "creditManager",
    //     "sanctionHead",
    // ];

    if (!req.employee) {
        res.status(403);
        throw new Error("Not Authorized!!");
    }
    console.log('reject 2')

    // if (!authorizedRoles.includes(req.employee.empRole)) {
    //     res.status(403);
    //     throw new Error("Not Authorized to reject a lead!!");
    // }

    let lead;
    let application;
    let sanction;
    let disbursal;
    let status;
    let logs;

    if (req.activeRole === "screener") {
        console.log('reject 3')
        lead = await Lead.findByIdAndUpdate(
            id,
            { onHold: false, isRejected: true, rejectedBy: req.employee._id },
            { new: true }
        ).populate({ path: "rejectedBy", select: "fName mName lName" });
        
        if (!lead) {
            throw new Error("Lead not found");
        }
        
        status = await LeadStatus.findByIdAndUpdate(
            { _id: lead.leadStatus },
            {
                isRejected: true,
                stage: "APPLICATION",
                subStage: "LEAD REJECTED",
            },
            { new: true }
        );
        
        if (!status) {
            res.status(404);
            throw new Error("Status not found");
        }
        
        logs = await postLogs(
            lead._id,
            "LEAD REJECTED",
            `${lead.fName}${lead.mName && ` ${lead.mName}`}${lead.lName && ` ${lead.lName}`
            }`,
            `Lead rejected by ${lead.rejectedBy.fName} ${lead.rejectedBy.lName}`,
            `${reason}`
        );
        // update loan Application while  rejected lead
        await LoanApplication.findOneAndUpdate(
            { leadNo: lead.leadNo },
            {
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                applicationStatus: "REJECTED",
                sanction: "REJECTED",
            },
            { new: true }
        );
        return res.json({ lead, logs });
    } else if (req.activeRole === "creditManager") {
        console.log('reject 4')
        application = await Application.findByIdAndUpdate(
            id,
            { isRejected: true, rejectedBy: req.employee._id },
            { new: true }
        )
        .populate({ path: "lead", populate: { path: "documents" } })
        .populate({ path: "rejectedBy", select: "fName mName lName" });
        
        if (!application) {
            throw new Error("Application not found");
        }
        
        status = await LeadStatus.findByIdAndUpdate(
            { _id: application.lead.leadStatus },
            {
                isRejected: true,
                stage: "APPLICATION",
                subStage: "APPLICATION REJECTED",
            },
            { new: true }
        );
        
        if (!status) {
            res.status(404);
            throw new Error("Status not found");
        }
        
        logs = await postLogs(
            application.lead._id,
            "APPLICATION REJECTED",
            `${application.lead.fName}${application.lead.mName && ` ${application.lead.mName}`
            }${application.lead.lName && ` ${application.lead.lName}`}`,
            `APPLICATION rejected by ${application.rejectedBy.fName} ${application.rejectedBy.lName}`,
            `${reason}`
        );
        // update loan Application while  rejected lead
        await LoanApplication.findOneAndUpdate(
            { leadNo: lead.leadNo },
            {
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                applicationStatus: "REJECTED",
                sanction: "REJECTED",
            },
            { new: true }
        );
        return res.json({ application, logs });
    } else if (req.activeRole === "sanctionHead") {
        console.log('reject 4')
        sanction = await Sanction.findByIdAndUpdate(
            id,
            { isRejected: true, rejectedBy: req.employee._id },
            { new: true }
        ).populate([
            { path: "rejectedBy", select: "fName mName lName" },
            {
                path: "application",
                populate: { path: "lead", populate: { path: "documents" } },
            },
        ]);

        if (!sanction) {
            throw new Error("Sanction not found!!");
        }

        status = await LeadStatus.findByIdAndUpdate(
            { _id: sanction.application.lead.leadStatus },
            {
                isRejected: true,
                stage: "SANCTION",
                subStage: "SANCTION REJECTED",
            },
            { new: true }
        );

        if (!status) {
            res.status(404);
            throw new Error("Status not found");
        }

        logs = await postLogs(
            sanction.application.lead._id,
            "SANCTION REJECTED",
            `${sanction.application.lead.fName}${sanction.application.lead.mName &&
            ` ${sanction.application.lead.mName}`
            }${sanction.application.lead.lName &&
            ` ${sanction.application.lead.lName}`
            }`,
            `SANCTION rejected by ${sanction.rejectedBy.fName} ${sanction.rejectedBy.lName}`,
            `${reason}`
        );
        // update loan Application while  rejected lead
        await LoanApplication.findOneAndUpdate(
            { leadNo: lead.leadNo },
            {
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                applicationStatus: "REJECTED",
                sanction: "REJECTED",
            },
            { new: true }
        );
        return res.json({ sanction, logs });
    } else if (
        req.activeRole === "disbursalManager" ||
        req.activeRole === "disbursalHead"
    ) {
        disbursal = await Disbursal.findByIdAndUpdate(
            id,
            { isRejected: true, rejectedBy: req.employee._id },
            { new: true }
        ).populate([
            { path: "rejectedBy", select: "fName mName lName" },
            {
                path: "sanction",
                populate: {
                    path: "application",
                    populate: { path: "lead", populate: { path: "documents" } },
                },
            },
        ]);
        if (!disbursal) {
            throw new Error("Disbursal not found!!");
        }

        status = await LeadStatus.findByIdAndUpdate(
            { _id: disbursal.sanction.application.lead.leadStatus },
            {
                isRejected: true,
                subStage: "DISBURSAL REJECTED",
                stage: "DISBURSAL",
            },
            { new: true }
        );

        if (!status) {
            res.status(404);
            throw new Error("Status not found");
        }

        const closedDoc = await Close.findOne({
            loanNo: disbursal.loanNo,
        });
        if (closedDoc) {
            
                closedDoc.loanNo === disbursal.loanNo
                    ? { ...closedDoc, isActive: false, isClosed: true }
                    : closedDoc
            
            await closedDoc.save();
        }

        logs = await postLogs(
            disbursal.sanction.application.lead._id,
            "DISBURSAL REJECTED",
            `${disbursal.sanction.application.lead.fName}${disbursal.sanction.application.lead.mName &&
            ` ${disbursal.sanction.application.lead.mName}`
            }${disbursal.sanction.application.lead.lName &&
            ` ${disbursal.sanction.application.lead.lName}`
            }`,
            `Disbursal rejected by ${disbursal.rejectedBy.fName} ${disbursal.rejectedBy.lName}`,
            `${reason}`
        );
        // update loan Application while  rejected lead
        await LoanApplication.findOneAndUpdate(
            { leadNo: disbursal.sanction.application?.lead.leadNo },
            {
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                applicationStatus: "REJECTED",
                disbursed: "REJECTED",
            },
            { new: true }
        );
        return res.json({ disbursal, logs });
    }
});

// @desc Get rejected leads depends on if it's admin or an employee
// @route GET /api/leads/reject
// @access Private
export const getRejected = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1; // current page
    const limit = parseInt(req.query.limit) || 10; // items per page
    const skip = (page - 1) * limit;

    let query = { isRejected: true };

    if (!req.employee) {
        res.status(403);
        throw new Error("Not Authorized!!");
    }

    const leads = await Lead.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "rejectedBy", select: "fName mName lName" });

    const totalLeads = leads.length;

    const applications = await Application.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("lead")
        .populate({ path: "rejectedBy", select: "fName mName lName" });

    const totalApplications = applications.length;

    const sanctions = await Sanction.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
            { path: "rejectedBy", select: "fName mName lName" },
            { path: "application", populate: { path: "lead" } },
        ]);

    const totalSanctions = sanctions.length;

    const disbursals = await Disbursal.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
            { path: "rejectedBy", select: "fName mName lName" },
            {
                path: "sanction",
                populate: {
                    path: "application",
                    populate: { path: "lead" },
                },
            },
        ]);

    const totalDisbursals = disbursals.length;

    return res.json({
        rejectedLeads: {
            totalLeads,
            totalPages: Math.ceil(totalLeads / limit),
            currentPage: page,
            leads,
        },
        rejectedApplications: {
            totalApplications,
            totalPages: Math.ceil(totalApplications / limit),
            currentPage: page,
            applications,
        },
        rejectedSanctions: {
            totalSanctions,
            totalPages: Math.ceil(totalSanctions / limit),
            currentPage: page,
            sanctions,
        },
        rejectedDisbursals: {
            totalDisbursals,
            totalPages: Math.ceil(totalDisbursals / limit),
            currentPage: page,
            disbursals,
        },
    });
    // }
});
