import axios from "axios";

// const apiKey = process.env.ZOHO_APIKEY;

async function sendEmail(formData) {
    try {
        const options = {
            method: "POST",
            url: "https://api.mailgun.net/v3/qualoan.com/messages",
            data: formData,
            headers: {
                accept: "application/json",
                authorization: `Basic ${process.env.MAILGUN_AUTH}`,
                ...formData.getHeaders(),
            },
        };

        const response = await axios(options);

        return response.data;
    } catch (error) {
        console.log(error.data.message);
        throw new Error("Error sending email", error.data.message);
    }
}

export default sendEmail;
