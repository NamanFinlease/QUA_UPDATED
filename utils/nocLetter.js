const axios = require("axios");
async function sendNocMail(params) {
    const {
        mailTemplateKey,
        fromAddress,
        fromName,
        toAddress,
        toName,
        date,
        companyName,
        customerName,
        disbursalDate,
        loanPaid,
        supportId,
        loanAmount,
        dateOfPayment,
        loanNo,
        brand
    } = params;

    // Construct the request payload
    const requestBody = {
        mail_template_key: mailTemplateKey,
        from: { address: fromAddress, name: fromName },
        to: [{ email_address: { address: toAddress, name: toName } }],
        merge_info: {
            date,
            "Company Name": companyName,
            "Customer name": customerName,
            "Disbursal<b>&nbsp;date</b>": disbursalDate,
            "loan paid": loanPaid,
            "support id": supportId,
            "loan amount": loanAmount,
            "Date of Payment": dateOfPayment,
            "Loan No": loanNo,
            brand
        }
    };

    try {
        // Send the API request using Axios
        const response = await axios.post("https://api.zeptomail.in/v1.1/email/template", requestBody, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": process.env.ZEPTO_API_KEY
            }
        });

        console.log("✅ Email sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error sending email:", error.response ? error.response.data : error.message);
        return null;
    }
}

// Example Usage:
const userInput = {
    mailTemplateKey: 
    // "2518b.2fe8cbd850477763.k1.0faae550-eb6f-11ef-a154-cabf48e1bf81.19508864025",
    process.env.mailTemplateKey,
    fromAddress: "info@qualoan.com",
    fromName: "noreply",
    toAddress: "admin@only1loan.com",
    toName: "Naman Finleas Private Limited",
    date: "2025-02-15",
    companyName: "FinTech Basket",
    customerName: "John Doe",
    disbursalDate: "2025-01-01",
    loanPaid: "50000",
    supportId: "support@fintechbasket.com",
    loanAmount: "50000",
    dateOfPayment: "2025-02-10",
    loanNo: "LN-12345",
    brand: "FinTech Basket"
};

// Call the function
sendZeptoMail(sendNocMail);
