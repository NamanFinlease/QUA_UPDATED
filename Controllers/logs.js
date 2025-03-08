import asyncHandler from "../middleware/asyncHandler.js";
import Lead from "../models/Leads.js";
import LogHistory from "../models/LeadLogHistory.js";
import UserLogHistory from "../models/User/model.userLogs.js";
import moment from "moment";

// @desc Post logs with status
// @access Private
export const postLogs = async (
    leadId = "",
    leadStatus = "",
    borrower = "",
    leadRemark = "",
    reason = "",
    session
) => {
    try {
        const time = moment().format("DD/MM/YYYY HH:mm:ss")
        if (session) {

            // Check if the lead is present
            const lead = await Lead.findOne({ _id: leadId }, null, { session });

            if (!lead) {
                res.status(404);
                throw new Error("No lead found!!!");
            }

            // Create the new log initally
            const createloghistory = new LogHistory({
                lead: leadId,
                logDate: time,
                status: leadStatus,
                borrower: borrower,
                leadRemark: leadRemark,
                reason: reason,
            });
            await createloghistory.save({ session });
            return createloghistory;
        }

        else {
            // Check if the lead is present
            const lead = await Lead.findOne({ _id: leadId });

            if (!lead) {
                res.status(404);
                throw new Error("No lead found!!!");
            }

            // Create the new log initally
            const createloghistory = await LogHistory.create({
                lead: leadId,
                logDate: time,
                status: leadStatus,
                borrower: borrower,
                leadRemark: leadRemark,
                reason: reason,
            });
            return createloghistory;

        }
    } catch (error) {
        throw new Error(error.message);
    }
};

// @desc Get logs with status
// @route GET /api/lead/viewlogs
// @access Private
export const viewLogs = asyncHandler(async (req, res) => {
    // Fetch the lead id
    const { leadId } = req.params;
    // get User Log history
    const leadDetails = await Lead.findById(leadId)
    const userLogHistory = await UserLogHistory.find({ userId: leadDetails.userId }).sort({
        logDate: -1,
    });

    // Check if the lead is present
    const leadLogDetails = await LogHistory.find({ lead: leadId }).sort({
        logDate: -1,
    });

    if (!leadLogDetails) {
        res.status(404);
        throw new Error("No lead found!!!");
    }
    const mergedLogs = [
        ...Object.values(leadLogDetails).map(log => ({
            id: log._id,
            logDate: log?.logDate,
            lead: log?.lead,
            borrower: log?.borrower,
            status: log?.status,
            leadRemark: log?.leadRemark,
            reason: log?.reason,
        })),
        ...userLogHistory.map(log => ({
            id: log._id,
            logDate: log?.logDate,
            lead: log?.userId,
            leadRemark: log?.userRemark,
            borrower: `${leadDetails.fName} ${leadDetails.mName} ${leadDetails.lName}`,
            status: "User Registration",
            reason: "",
        })),
    ];

    res.json(mergedLogs);
})
