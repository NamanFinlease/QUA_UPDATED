import express from "express";
import { createLandingPageLead, getAllLandingPageLeads, allocatePartialLead, allocatedList, completedList  , reject , rejectedList , getProfile} from "../Controllers/marketingLead.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/landingPageData").post(createLandingPageLead).get(protect, getAllLandingPageLeads); // (DONE)
router.route("/partialLead/:id").post(protect, allocatePartialLead);  // Allocate marketing lead (DONE)
router.route("/allocated").get(protect, allocatedList);  // Allocated marketing lead (DONE)
router.route("/completed").get(protect, completedList);  // Completed marketing lead (DONE)
router.route("/reject/:id").post(protect, reject);  // reject lead (DONE)
router.route("/rejectedList").get(protect, rejectedList); // get rejectedList (DONE)
router.route("/profile/:id").get(protect, getProfile); // get profile (DONE)
export default router;