import express from "express";
import { createLandingPageLead, getAllLandingPageLeads, allocatePartialLead, allocatedList, completedList  , reject , rejectedList} from "../Controllers/marketingLead.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/landingPageData").post(createLandingPageLead).get(protect, getAllLandingPageLeads); // (DONE)
router.route("/partialLead/:id").post(protect, allocatePartialLead);  // Allocate marketing lead (DONE)
router.route("/allocated").get(protect, allocatedList);  // Allocated marketing lead (DONE)
router.route("/completed").get(protect, completedList);  // Completed marketing lead
router.route("/reject/:id").post(protect, reject);  // reject lead
router.route("/rejectedList").get(protect, rejectedList); // get rejectedList

export default router;