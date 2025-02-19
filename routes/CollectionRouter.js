import express from "express";
import {
    activeLeads,
    getActiveLead,
    updateActiveLead,
    closedLeads,
    updatePayment,
    getPaymentCalculation,
    getRecoveryList,
    getClosedList,
    allocate,
    getAllocatedList,
    repaymentDetails,
    preActiveLeads,
    preAllocate,
    getPreAllocatedList

} from "../Controllers/collection.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadFields } from "./LeadsRouter.js";

const router = express.Router();

router.route("/active").get(protect, activeLeads);
// Add received payment.............
router.route("/updatePayment/:loanNo").post(protect,uploadFields, updatePayment); // transaction
// Get repayment details..........
router.route("/repayment/:id").get(protect,repaymentDetails)

router
    .route("/active/:loanNo")
    .get(protect, getActiveLead)
    .patch(protect, updateActiveLead);
router.route("/closed").get(protect, closedLeads);

router.get("/paymentCalculation/:collectionId", protect , getPaymentCalculation)
router.get("/recoveryList/:collectionId" , protect ,  getRecoveryList)
router.get("/closedList" , protect , getClosedList)

router.patch("/allocate/:collectionId" , protect , allocate)
router.get("/allocatedList" , protect , getAllocatedList)


// pre collection routes
router.get("/preCollection/active" , protect, preActiveLeads);
router.patch("/preCollection/allocate/:collectionId" , protect , preAllocate)
router.get("/preCollection/allocatedList" , protect , getPreAllocatedList)

export default router;
