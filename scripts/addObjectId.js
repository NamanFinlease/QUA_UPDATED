import mongoose from 'mongoose';
import Payment from '../models/Payment.js'; // Update with your actual path

async function addPaymentHistoryIds() {
    try {
        // MongoDB connection
        await mongoose.connect('mongodb+srv://manish:OnlyoneLoan%40007@cluster0.vxzgi.mongodb.net/uveshTesting1?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Get all payment documents
        const payments = await Payment.find();

        // Process each payment document
        for (const payment of payments) {
            let needsUpdate = false;

            // Check each payment history entry
            for (const historyEntry of payment.paymentHistory) {
                if (!historyEntry._id) {
                    historyEntry._id = new mongoose.Types.ObjectId();
                    needsUpdate = true;
                }
            }

            // Save only if modifications were made
            if (needsUpdate) {
                await payment.save();
                console.log(`Updated payment with loanNo: ${payment.loanNo}`);
            }
        }

        console.log('Successfully updated all payment histories');
    } catch (error) {
        console.error('Error updating payment histories:', error);
    } finally {
        // Close connection
        await mongoose.disconnect();
    }
}

// Run the script
addPaymentHistoryIds();