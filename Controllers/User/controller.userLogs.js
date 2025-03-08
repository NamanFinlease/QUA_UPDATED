import moment from "moment";
import asyncHandler from "../../middleware/asyncHandler.js";
import User from "../../models/User/model.user.js";
import UserLogHistory from "../../models/User/model.userLogs.js";

// @desc Post logs with status
// @access Private
export const postUserLogs = async (
    userId = "",
    userRemark = "",
    session
) => {
    try {
        if (session) {
            // Check if the lead is present
            const userDetails = await User.findOne({ _id: userId }).session(session);

            if (!userDetails) {
                res.status(404);
                throw new Error("User not found!!!");
            }

            const time = moment().format("DD/MM/YYYY HH:mm:ss")

            // Create the new log initally
            const createloghistory = new UserLogHistory({
                userId,
                logDate: time,
                userRemark,
            });

            await createloghistory.save({ session });
        }
        else {
            // Check if the lead is present
            const userDetails = await User.findOne({ _id: userId });

            if (!userDetails) {
                res.status(404);
                throw new Error("User not found!!!");
            }

            // Create the new log initally
            const createloghistory = await UserLogHistory.create({
                userId: userId,
                logDate: new Date(),
                userRemark,
            });
            createloghistory.pan = userDetails.PAN,
            createloghistory.aadhaar = userDetails.aadarNumber,
            await createloghistory.save();
            return createloghistory;
        }
    } catch (error) {
        throw new Error(error.message);
    }
};

// @desc Get logs with status
// @route GET /api/lead/viewlogs
// @access Private
export const viewUserLogs = asyncHandler(async (req, res) => {
    // Fetch the lead id
    const { userId } = req.params;

    // Check if the lead is present
    const userLogs = await UserLogHistory.find({ userId: userId }).sort({
        logDate: -1,
    });

    if (!userLogs) {
        res.status(404);
        throw new Error("No lead found!!!");
    }

    res.json(userLogs);
});
