import mongoose from 'mongoose';
import Payment from '../models/Payment.js'; // Update with your actual path

async function addPaymentHistoryIds() {
  try {
    await mongoose.connect('mongodb+srv://manish:OnlyoneLoan%40007@cluster0.vxzgi.mongodb.net/uveshTesting1?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const payments = await Payment.find();

    for (const payment of payments) {
      if (!Array.isArray(payment.paymentHistory)) {
        console.warn(`⚠️ Skipping loanNo: ${payment.loanNo} - paymentHistory is not an array`);
        continue;
      }

      let needsUpdate = false;

      for (const historyEntry of payment.paymentHistory) {
        if (!historyEntry._id) {
          historyEntry._id = new mongoose.Types.ObjectId();
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        payment.markModified('paymentHistory'); // Force Mongoose to recognize the change
        await payment.save();
        console.log(`✅ Updated payment with loanNo: ${payment.loanNo}`);
      }
    }

    console.log('✅ Successfully updated all payment histories');
  } catch (error) {
    console.error('❌ Error updating payment histories:', error);
  } finally {
    await mongoose.disconnect();
  }
}

addPaymentHistoryIds();
