
import mongoose from "mongoose";
import asyncHandler from "../middleware/asyncHandler.js";
import Employee from "../models/Employees.js";
import LandingPageLead from "../models/LandingPageLead.js";

// @desc   Create LandingPageLead Entry
// @route  POST /api/marketing/createLandingPageLead
// @access Public
export const createLandingPageLead = asyncHandler(async (req, res) => {
    const {
        fullName,
        pan,
        mobile,
        email,
        pinCode,
        salary,
        loanAmount,
        source,
    } = req.body;

    // Validate required fields
    if (
        !fullName ||
        !pan ||
        !mobile ||
        !email ||
        !pinCode ||
        !salary ||
        !loanAmount
    ) {
        return res.status(400).json({
            success: false,
            message: "All fields are required.",
        });
    }

    // Check if the lead already exists
    const existingLead = await LandingPageLead.findOne({ pan, mobile, email });

    if (existingLead) {
        return res.status(409).json({
            success: false,
            message: "Lead already exists.",
        });
    }

    // Create a new lead entry
    const leadInfo = await LandingPageLead.create({
        fullName,
        pan,
        mobile,
        email,
        pinCode,
        salary,
        loanAmount,
        source,
    });

    // Return success response
    return res.status(201).json({
        success: true,
        message: "Lead information saved successfully!",
        leadInfo,
    });
});

// @desc   Get all LandingPageLeads entries (Paginated)
// @route  GET /api/marketing/getAllLandingPageLeads
// @access Private
export const getAllLandingPageLeads = asyncHandler(async (req, res) => {

    if (req.activeRole !== "screener" || req.activeRole !== "admin" || req.activeRole !== "sanctionHead") {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to access this resource.",
        });
    }
    let page = parseInt(req.query.page) || 1; // Current page
    let limit = parseInt(req.query.limit) || 10; // Items per page

    // Prevent invalid pagination values
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const skip = (page - 1) * limit;

    try {
        // Fetch paginated leads
        const leads = await LandingPageLead.find()
            .skip(skip)
            .limit(limit)
            .sort({ updatedAt: -1 });

        // Get total count
        const totalLeads = await LandingPageLead.countDocuments();

        return res.status(200).json({
            success: true,
            totalLeads,
            totalPages: Math.ceil(totalLeads / limit),
            currentPage: page,
            leads,
        });
    } catch (error) {
        console.error("❌ Error fetching leads:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving leads.",
        });
    }
});


// @desc   allocate partial leads
// @route  POST /api/marketing/partialLead/:id
// @access Private
export const allocatePartialLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Lead id is required.",
        });

    }
    if (req.activeRole !== "screener") {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to access this resource.",
        });
    }
    let screenerId;
    if (req.activeRole === "screener") {
        screenerId = req.employee._id.toString(); // Current user is a screener
    }
    const employee = await Employee.findById(screenerId);
    if (!employee) {
        return res.status(400).json({
            success: false,
            message: "Employee not found.",
        });
    }

    // Find the lead by ID
    const lead = await LandingPageLead.findById(id);

    if (!lead) {
        return res.status(400).json({
            success: false,
            message: "Lead not found.",
        });
    }

    // Update the lead with assignedTo and status
    lead.screenerId = screenerId;
    lead.remarks = req?.body?.remarks || "";

    // Save the updated lead
    await lead.save();

    return res.status(200).json({
        success: true,
        message: "Lead allocated successfully.",
        lead,
    });

});


// @desc   list of allocated partial leads
// @route  GET /api/marketing/allocated
// @access Private
export const allocatedList = asyncHandler(async (req, res) => {

    if (req.activeRole !== "screener" || req.activeRole !== "admin" || req.activeRole !== "sanctionHead") {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to access this resource.",
        });
    }
    let screenerId;
    if (req.activeRole === "screener") {
        screenerId = req.employee._id.toString(); // Current user is a screener
    }
    const employee = await Employee.findById(screenerId);
    if (!employee) {
        return res.status(400).json({
            success: false,
            message: "Employee not found.",
        });
    }

    let page = parseInt(req.query.page) || 1; // Current page
    let limit = parseInt(req.query.limit) || 10; // Items per page

    // Prevent invalid pagination values
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    const skip = (page - 1) * limit;
    let pipeline
    if (req.activeRole !== "screener") {
        pipeline = [
            {
                $match: {
                    screenerId: { $exists: true, $ne: null }
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $match: {} }]
                }
            }
        ]
    }
    else {
        pipeline = [
            {
                $match: {
                    screenerId: { $exists: true, $ne: null }
                }
            },
            {
                $match: {
                    screenerId: new mongoose.Types.ObjectId(screenerId)
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $match: {} }]
                }
            }
        ]

    }

    const allocatedLeads = await LandingPageLead.aggregate(pipeline);

    return res.status(200).json({
        success: true,
        allocatedLeads,
    });

});


// @desc   list of completed partial leads
// @route  GET /api/marketing/completed
// @access Private
export const completedList = asyncHandler(async (req, res) => {
    if (req.activeRole !== "screener" || req.activeRole !== "admin" || req.activeRole !== "sanctionHead") {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to access this resource.",
        });
    }
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    const skip = (page - 1) * limit;
    let pipeline = [
        {
            $match: {
                isComplete: true
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $skip: skip
        },
        {
            $limit: limit
        },
        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [{ $match: {} }]
            }
        }
    ]

    const completedLeads = await LandingPageLead.aggregate(pipeline)

    return res.status(200).json({
        success: true,
        completedLeads,
    });
});


// @desc   to reject partial leads
// @route  POST /api/marketing/reject/:id
// @access Private
export const reject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({
            success: false,
            message: "Lead id is required.",
        });

    }
    if (req.activeRole !== "screener") {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to access this resource.",
        });
    }
    let screenerId;
    if (req.activeRole === "screener") {
        screenerId = req.employee._id.toString(); // Current user is a screener
    }
    const employee = await Employee.findById(screenerId);
    if (!employee) {
        return res.status(400).json({
            success: false,
            message: "Employee not found.",
        });
    }

    // Find the lead by ID
    const lead = await LandingPageLead.findById(id);

    if (!lead) {
        return res.status(400).json({
            success: false,
            message: "Lead not found.",
        });
    }

    // Update the lead with assignedTo and status
    lead.rejectedBy = screenerId;
    lead.isRejected = true;
    lead.remarks = req?.body?.remarks || "";

    // Save the updated lead
    await lead.save();

    return res.status(200).json({
        success: true,
        message: "Lead allocated successfully.",
        lead,
    });

})


// @desc   to get rejected partial leads
// @route  GET /api/marketing/rejectedList
// @access Private
export const rejectedList = asyncHandler(async (req, res) => {
    if (req.activeRole !== "screener" || req.activeRole !== "admin" || req.activeRole !== "sanctionHead") {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to access this resource.",
        });
    }
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    const skip = (page - 1) * limit;
    let pipeline = [
        {
            $match: {
                isRejected: true
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $skip: skip
        },
        {
            $limit: limit
        },
        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [{ $match: {} }]
            }
        }
    ]

    const rejectedLeads = await LandingPageLead.aggregate(pipeline)

    return res.status(200).json({
        success: true,
        rejectedLeads,
    });
})