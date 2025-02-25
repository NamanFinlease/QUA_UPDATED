import express from "express";
import {createLandingPageLead , getAllLandingPageLeads , allocatePartialLead , allocatedList , completedList} from "../Controllers/marketingLead.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/landingPageData").post(createLandingPageLead).get(protect, getAllLandingPageLeads);
router.route("/partialLead/:id").post(protect, allocatePartialLead);  // Allocate marketing lead
router.route("/allocated").get(protect, allocatedList);  // Allocated marketing lead
router.route("/completed").get(protect, completedList);  // Completed marketing lead

export default router;