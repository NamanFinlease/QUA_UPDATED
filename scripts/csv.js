import mongoose from 'mongoose';
import csv from 'csv-parser';
import fs from 'fs';

// MongoDB connection configuration
const MONGO_URI = 'mongodb+srv://ajay:zdYryDsVh90hIhMc@crmproject.4u20b.mongodb.net/QUAloanUpdatedDB?retryWrites=true&w=majority&appName=CRMProject';
const MONGO_OPTIONS = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,  // 30 seconds
    socketTimeoutMS: 60000,          // 60 seconds
    connectTimeoutMS: 30000          // 30 seconds
};

// Define helper functions for data parsing
const parseNumber = (value) => {
    if (!value) return 0;
    const num = parseFloat(value.toString().replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
};

const parseDate = (value) => {
    if (!value) return null;
    try {
        return new Date(value);
    } catch (e) {
        return null;
    }
};

// Define Mongoose schema
const loanSchema = new mongoose.Schema({
    LAN: String,
    NAME: String,
    PAN: String,
    MOBILE_NO: String,
    ALTERNATE_NO: String,
    PINCODE: Number,
    MAIL_ID: String,
    OFFICE_MAIL: String,
    AMOUNT: Number,
    PF_AMOUNT: Number,
    DISBURSED_AMOUNT: Number,
    ROI: String,
    DOD: Date,
    DOR: Date,
    DPD: Number,
    TENURE: Number,
    REPAYMENT_AMOUNT: Number,
    PAID_DATE: Date,
    PAID_AMT: Number,
    STATUS : String,
    PF : String
});

export const Loan = mongoose.model('csv', loanSchema);

// Main function to handle data import
async function importCSVData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI, MONGO_OPTIONS);
        console.log('Connected to MongoDB successfully');

        // Create read stream and process CSV
        const results = [];
        const stream = fs.createReadStream('QUALoanTotalcasesSummaryNew.csv').on("error", (err) => {
            console.error("File read error:", err.message);
            process.exit(1);
          })
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim() // Trim headers to remove extra spaces
            }))
            .on('data', (row) => {
                console.log("--->" , row['PAID DATE'])
                const processedRow = {
                    LAN: row['LAN']?.trim() || '',
                    NAME: row['NAME']?.trim() || '',
                    PAN: row['PAN']?.trim() || '',
                    STATUS : row['STATUS']?.trim()|| '',
                    MOBILE_NO: row['MOBILE NO.']?.trim() || '',
                    ALTERNATE_NO: row['ALTERNATE NO']?.trim() || '',
                    PINCODE: parseInt(row['PINCODE']) || 0,
                    MAIL_ID: row['MAIL ID']?.trim() || '',
                    OFFICE_MAIL: row['OFFICE MAIL']?.trim() || '',
                    AMOUNT: parseNumber(row['AMOUNT']),
                    PF_AMOUNT: parseNumber(row['PF AMOUNT']),
                    DISBURSED_AMOUNT: parseNumber(row['DISBURSHED AMT']),
                    ROI: row['ROI']?.trim() || '',
                    DOD: parseDate(row['DOD']),
                    PF : row['PF']?.trim() || '',
                    DOR: parseDate(row['DOR']),
                    PAID_DATE: parseDate(row['PAID DATE']),
                    DPD: parseInt(row['DPD']) || 0,
                    TENURE: parseInt(row['TENURE']) || 0,
                    REPAYMENT_AMOUNT: parseNumber(row['REPAYMENT AMT.']),
                    PAID_AMT: parseNumber(row['PAID AMT'])
                };
                results.push(processedRow);
            })
            .on('error', (error) => {
                console.error('CSV processing error:', error);
                stream.destroy();
                throw error;
            });

        // Wait for stream to finish
        await new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
        });

        console.log(`CSV processing complete. Total records: ${results.length}`);

        // Batch insert configuration
        const BATCH_SIZE = 500;
        let insertedCount = 0;
        let batchNumber = 1;

        // Process in batches
        while (insertedCount < results.length) {
            const batchStart = insertedCount;
            const batchEnd = insertedCount + BATCH_SIZE;
            const currentBatch = results.slice(batchStart, batchEnd);

            try {
                const result = await Loan.insertMany(currentBatch, {
                    ordered: false,
                    maxTimeMS: 30000
                });

                insertedCount += result.length;
                console.log(`Batch ${batchNumber} inserted (${insertedCount}/${results.length})`);

                // Add delay if needed
                await new Promise(resolve => setTimeout(resolve, 50));
                batchNumber++;
            } catch (batchError) {
                console.error(`Error in batch ${batchNumber}:`, batchError.message);
                if (batchError.writeErrors) {
                    console.error(`Failed documents: ${batchError.writeErrors.length}`);
                }
                // Continue with next batch
                insertedCount += BATCH_SIZE;
                batchNumber++;
            }
        }

        console.log('Data import completed successfully');
        console.log(`Total documents inserted: ${insertedCount}`);
        console.log('Closing MongoDB connection');

    } catch (error) {
        console.error('Error during import process:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

// Run the import
importCSVData();

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\nProcess interrupted. Closing connections...');
    await mongoose.disconnect();
    process.exit(0);
});