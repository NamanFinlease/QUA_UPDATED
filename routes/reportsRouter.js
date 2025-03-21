import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import {
    collectionReport,
    masterCollectionReport,
    getMasterSheetData,
} from "../Controllers/reports.js";
const router = express.Router();

router.route("/collection").get(protect, collectionReport);
router.route("/masterCollection").get(protect, masterCollectionReport);
router.route("/master-sheet").get(protect, getMasterSheetData);

export default router;
