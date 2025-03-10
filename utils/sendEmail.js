import axios from "axios";

// const apiKey = process.env.ZOHO_APIKEY;

async function sendEmail(recipient, recipientName, subject, link) {
    try {
        // const options = {
        //     method: "POST",
        //     url: "https://api.mailgun.net/v3/qualoan.com/messages",
        //     data: formData,
        //     headers: {
        //         accept: "application/json",
        //         authorization: `Basic ${process.env.MAILGUN_AUTH}`,
        //         ...formData.getHeaders(),
        //     },
        // };

        const options = {
            method: "POST",
            url: "https://api.zeptomail.in/v1.1/email",
            headers: {
                accept: "application/json",
                authorization: process.env.ZOHO_APIKEY,
                "cache-control": "no-cache",
                "content-type": "application/json",
            },
            data: JSON.stringify({
                from: { address: "info@qualoan.com" },
                to: [
                    {
                        email_address: {
                            address: recipient,
                            name: recipientName,
                        },
                    },
                ],
                subject: subject,
                htmlbody: `<p>To verify your aadhaar click on <strong>${link}</strong>.</p>`,
            }),
        };

        const response = await axios(options);

        return response.data;
    } catch (error) {
        console.log(error.data.message);
        throw new Error("Error sending email", error.data.message);
    }
}

export default sendEmail;
