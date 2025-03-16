import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { collectionReport } from "../Controllers/reports.js";
const router = express.Router()


router.route("/collection").get(protect,collectionReport)

export default router;
