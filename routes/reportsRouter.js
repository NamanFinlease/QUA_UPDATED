import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { collectionReport, masterCollectionReport } from "../Controllers/reports.js";
const router = express.Router()


router.route("/collection").get(protect,collectionReport)
router.route("/masterCollection").get(protect,masterCollectionReport)

export default router;
