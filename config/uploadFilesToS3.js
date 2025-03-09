import S3 from "aws-sdk/clients/s3.js";

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_BUCKET_NAME;
const bucketNameProfile = process.env.AWS_BUCKET_NAME_PROFILE;
const accessKeyIdProfile = process.env.AWS_ACCESS_KEY_ID_PROFILE;
const secretAccessKeyProfile = process.env.AWS_SECRET_ACCESS_KEY_PROFILE;


const s3 = new S3({ region, accessKeyId, secretAccessKey });
const s3Pr = new S3({ region, accessKeyIdProfile, secretAccessKeyProfile });

// Upload files to S3
async function uploadFilesToS3(buffer, key) {
    console.log('upload to s3 1')
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
    try {
        // Check file size before uploading
        if (buffer.length > MAX_FILE_SIZE) {
            throw new Error("File size exceeds 25 MB");
        }
        var params = {
            Bucket: bucketName,
            Body: buffer,
            Key: key,
        };
        // Get file extension from the key
        const extension = key.split(".").pop().toLowerCase();
        
        // If it's an .xlsx file, set the ContentType to application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
        if (extension === "xlsx") {
            params.ContentType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }
        console.log('upload to s3 2')
        return await s3.upload(params).promise();
    } catch (error) {
        console.log(error);
    }
}

// profile image
async function uploadFilesToS3Profile(buffer, key) {
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
    try {
        // Check file size before uploading
        if (buffer.length > MAX_FILE_SIZE) {
            throw new Error("File size exceeds 25 MB");
        }

        var params = {
            Bucket: bucketNameProfile,
            Body: buffer,
            Key: key,
        };
        return await s3Pr.upload(params).promise();
    } catch (error) {
        console.log(error);
    }
}

// Delete old files from S3
async function deleteFilesFromS3(key) {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
        };
        await s3.deleteObject(params).promise();
        console.log(`File deleted successfully: ${key}`);
    } catch (error) {
        console.error(`Error deleting file: ${key}`, error);
        throw new Error("Failed to delete old file from S3");
    }
}

async function deleteFilesFromS3Profile(key) {
    try {
        const params = {
            Bucket: bucketNameProfile,
            Key: key,
        };
        await s3.deleteObject(params).promise();
        console.log(`File deleted successfully: ${key}`);
    } catch (error) {
        console.error(`Error deleting file: ${key}`, error);
        throw new Error("Failed to delete old file from S3");
    }
}
// Generate a pre-signed URL for each document
const generatePresignedUrl = (key, mimeType) => {
    const type = key.split("/");
    const params = {
        Bucket: bucketName,
        Key: key,
        Expires: 3 * 60 * 60, // Set expiration time in seconds (e.g., 1 hour)
        ResponseContentDisposition:
            type[1] === "statementAnalyser"
                ? `attachment; filename="${key}"`
                : "inline", // Display the file in the browser
        ResponseContentType: mimeType || "application/octet-stream", // Ensure correct MIME type
    };
    return s3Pr.getSignedUrl("getObject", params);
};

const generatePresignedUrlProfile = (key, mimeType) => {
    const params = {
        Bucket: bucketNameProfile,
        Key: key,
        Expires: 3 * 60 * 60, // Set expiration time in seconds (e.g., 1 hour)
        ResponseContentDisposition: "inline", // Display the file in the browser
        ResponseContentType: mimeType || "application/octet-stream", // Ensure correct MIME type
    };
    return s3Pr.getSignedUrl("getObject", params);
};

const getBSADocBuffer = async (bucket, key) => {
    try {
        const data = await s3.getObject({ Bucket: bucket, Key: key }).promise();

        // Ensure it's a Buffer
        const pdfBuffer = Buffer.isBuffer(data.Body) ? data.Body : Buffer.from(data.Body);

        console.log("Fetched PDF Buffer:", pdfBuffer);

        // Save it locally (for debugging)
        // fs.writeFileSync("downloaded.pdf", pdfBuffer);

        return pdfBuffer;
    } catch (error) {
        console.error("Error fetching PDF from S3:", error);
    }
};
export { uploadFilesToS3, deleteFilesFromS3, generatePresignedUrl, uploadFilesToS3Profile, generatePresignedUrlProfile, deleteFilesFromS3Profile,getBSADocBuffer };
