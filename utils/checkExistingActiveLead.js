import Lead from "../models/Leads.js";
import Application from "../models/Applications.js";
import Sanction from "../models/Sanction.js";
import Closed from "../models/Closed.js";
import Close from "../models/close.js";

export const checkExisitingActiveLead = async (pan) => {
    try {
        const sanctions = await Sanction.find({ pan: pan });
        console.log("sanctions: ", sanctions);

        if (sanctions.length === 0) {
            const applications = await Application.find({ pan: pan });
            if (applications.length === 0) {
                const leads = await Lead.find({ pan: pan });
            }
        } else {
            sanctions.map(async (sanction) => {
                const activeLead = await Close.find({
                    pan,
                    loanNo: sanction.loanNo,
                });
                console.log("Active Lead: ", activeLead);

                // if(sanction.isApproved && activeLead.)
            });
        }
    } catch (error) {
        console.log(error);
        return error;
    }
};
