// @desc Get report of all disbursed applications
// @route GET /api/reports/collection/

import asyncHandler from "../middleware/asyncHandler.js";
import { exportMasterCollectionData } from "../utils/MIS/collection/masterCollection.js";

// @access Private
export const collectionReport = asyncHandler(async (req, res) => {
    const data = await exportMasterCollectionData();
    if(!data) {
        res.status(400)
        throw new Error("Error in generating report")
    }
    // console.log("Data: ", data);
    return res.json({ data });
});