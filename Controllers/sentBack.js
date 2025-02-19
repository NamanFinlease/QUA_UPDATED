import asyncHandler from "../middleware/asyncHandler.js";
import Application from "../models/Applications.js";
import Sanction from "../models/Sanction.js";
import Disbursal from "../models/Disbursal.js";
import Employee from "../models/Employees.js";
import Lead from "../models/Leads.js";
import LeadStatus from "../models/LeadStatus.js";
import { postLogs } from "./logs.js";

export const sentBack = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { sendTo, reason } = req.body;

    const lead = await Lead.findById(id).populate("screenerId");
    let leadStatus = await LeadStatus({ leadNo: lead.leadNo });
    let application = await Application.findOne({ lead: id });
    let sanction;
    let disbursal;

    let logs;

    if (req.activeRole === "creditManager") {
        if (sendTo === "screener") {
            const deletedApplication = await Application.findOneAndDelete({
                lead: id,
            })
                .populate({
                    path: "lead",
                    populate: [{ path: "screenerId" }],
                })
                .populate({
                    path: "creditManagerId",
                    select: "fName mName lName",
                });
            if (!deletedApplication) {
                res.status(400);
                throw new Error("Can not delete!!");
            }
            await LeadStatus.updateOne(
                { leadNo: deletedApplication.lead.leadNo }, // Match the document
                {
                    stage: "Lead", // Only update the stage field
                },
                { runValidators: false } // Disable validation
            );

            lead.recommendedBy = null;
            lead.isRecommended = false;
            await lead.save();

            await LeadStatus.findOneAndUpdate({
                leadNo: lead.leadNo
            },
                {
                    stage : "APPLICATION",
                    subStage: "SENT BACK TO SCREENER"
                })

            logs = await postLogs(
                lead._id,
                `SENT BACK TO SCREENER ${deletedApplication.lead.screenerId.fName
                }${deletedApplication.lead.screenerId.lName &&
                ` ${deletedApplication.lead.screenerId.lName}`
                }`,
                `${deletedApplication.lead.fName}${deletedApplication.lead.mName &&
                ` ${deletedApplication.lead.mName}`
                }${deletedApplication.lead.lName &&
                ` ${deletedApplication.lead.lName}`
                }`,
                `Sent back by Credit Manager ${deletedApplication.creditManagerId.fName} ${deletedApplication.creditManagerId.lName}`,
                `${reason}`
            );
            res.json({ success: true, logs });
        }
    } else if (req.activeRole === "sanctionHead") {
        if (sendTo === "creditManager") {
            // If sendTo is Credit Manager this will be used
            sanction = await Sanction.findOneAndDelete({
                application: application._id,
            }).populate({
                path: "application",
                populate: [{ path: "creditManagerId" }, { path: "lead" }],
            });
            if (!sanction) {
                res.status(400);
                throw new Error("Can not delete!!");
            }
            await LeadStatus.updateOne(
                { leadNo: sanction.leadNo }, // Match the document
                {
                    stage: "Application", // Only update the stage field
                },
                { runValidators: false } // Disable validation
            );

            application.isRecommended = false;
            application.recommendedBy = null;
            await application.save();

            logs = await postLogs(
                lead._id,
                `SENT BACK TO CREDIT MANAGER ${sanction.application.creditManagerId.fName
                }${sanction.application.creditManagerId.lName &&
                ` ${sanction.application.creditManagerId.lName}`
                }`,
                `${sanction.application.lead.fName}${sanction.application.lead.mName &&
                ` ${sanction.application.lead.mName}`
                }${sanction.application.lead.lName &&
                ` ${sanction.application.lead.lName}`
                }`,
                `Sent back by Sanction Head ${req.employee.fName} ${req.employee.lName}`,
                `${reason}`
            );

            res.json({ success: true, logs });
        } else {
            res.status(400);
            throw new Error(
                `Sanction Head can not send the application directly to ${sendTo}!!`
            );
        }
    } else if (req.activeRole === "disbursalHead") {
        if (sendTo === "disbursalManager") {
            disbursal = await Disbursal.findOne({ _id: id }).populate([
                {
                    path: "disbursalManagerId",
                    path: "sanction",
                    populate: {
                        path: "application",
                        populate: {
                            path: "lead",
                            populate: { path: "documents" },
                        },
                    },
                },
            ]);

            if (!disbursal) {
                res.status(404);
                throw new Error("No Disbursal found!!");
            }
            await LeadStatus.updateOne(
                { leadNo: sanction.leadNo }, // Match the document
                {
                    stage: "Disbursal Processing", // Only update the stage field
                },
                { runValidators: false } // Disable validation
            );

            disbursal.isRecommended = false;
            disbursal.recommendedBy = null;

            await LeadStatus.findOneAndUpdate({
                leadNo: lead.leadNo
            },
                {
                    stage : "DISBURSAL",
                    subStage: "SENT BACK TO DISBURSAL MANAGER"

                })
            logs = await postLogs(
                lead._id,
                `SENT BACK TO DISBURSAL MANAGER ${disbursal.disbursalManagerId.fName
                }${disbursal.disbursalManagerId.lName &&
                ` ${disbursal.disbursalManagerId.lName}`
                }`,
                `${disbursal.sanction.application.lead.fName}${disbursal.sanction.application.lead.mName &&
                ` ${disbursal.sanction.application.lead.mName}`
                }${disbursal.sanction.application.lead.lName &&
                ` ${disbursal.sanction.application.lead.lName}`
                }`,
                `Sent back by Disbursal Head ${req.employee.fName} ${req.employee.lName}`,
                `${reason}`
            );

            res.json({ success: true, logs });
        }
    } else {
        res.status(401);
        throw new Error("You are not authorized to sent back the application");
    }
});
