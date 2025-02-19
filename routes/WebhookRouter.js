import express from "express";
import { bsaWebhook } from "../Controllers/webhooks.js";

const router = express.Router();

router.post("/bank/bsa/success", bsaWebhook);

export default router;
