// config/otpUtil.js
import axios from "axios";

export const generateAadhaarOtp = async (aadhaar) => {
    try {
        // Construct the request payload
        const data = {
            // uniqueId: "1234", // Adjust as needed if dynamic
            aadhaar_number: aadhaar, // Aadhaar number
        };

        console.log('data', data)

        // API endpoint and headers
        // const url = "https://svc.digitap.ai/ent/v3/kyc/intiate-kyc-auto";
        const url = "https://sm-kyc-sync-prod.scoreme.in/kyc/external/aadhaarOtp";
        const headers = {
            // authorization: process.env.DIGITAP_AUTH_KEY,
            clientId: process.env.SCOREME_CLIENT_ID,
            clientSecret: process.env.SCOREME_CLIENT_SECRET,
            "Content-Type": "application/json",
            // "User-Agent": "curl/7.68.0",
        };


        // Send POST request to the API
        const response = await axios.post(url, data, { headers });
        console.log('response aadhaar', response.data)

        // Check for a successful response
        if (response?.data?.responseCode !== "SOS174") {
            return { success: false, message: "Please enter a valid Aadhaar" };
        }

        // Return the successful response data
        return { success: true, data: response.data };
    } catch (error) {
        // Log and handle errors
        console.error("Error generating Aadhaar OTP:", error.message || error);

        // Return a custom error message
        return {
            success: false,
            message: "Failed to generate Aadhaar OTP. Please try again later.",
        };
    }
};

export const verifyAadhaarOtp = async (
    otp,
    aadhaar_number,
    consent,
) => {
    const data = {
        otp,
        aadhaar_number,
        consent,
    };

    console.log('data', data)
    try {
        const response = await axios.post(
            // "https://svc.digitap.ai/ent/v3/kyc/submit-otp",
            "https://sm-kyc-sync-prod.scoreme.in/kyc/external/aadhaarDetail",
            data,
            {
                headers: {
                    clientId: process.env.SCOREME_CLIENT_ID,
                    clientSecret: process.env.SCOREME_CLIENT_SECRET,
                    // authorization: process.env.DIGITAP_AUTH_KEY,
                    "Content-Type": "application/json",
                },
            }
        );
        console.log('response ',response.data)
        return response.data; // Return the response data
    } catch (error) {
        throw new Error(error?.response?.data?.msg || "An error occurred");
    }
};
