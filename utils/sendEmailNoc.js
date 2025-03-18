import axios from "axios";
async function sendNocMail(mailData) {
    try {
        const response = await axios.post('https://api.zeptomail.in/v1.1/email/template', 
            {
                mail_template_key: mailData.mail_template_key,
                from: mailData.from,
                to: mailData.to,
                cc: mailData.cc || [],
                merge_info: mailData.merge_info
            },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Zoho-enczapikey PHtE6r0FRri63WIm9hgE5vPtQ5H3PYop+b4yegIWtYsWAvMCH01dr94qlTHjr08jAfUWEvLIz95tsOue5uyGLGa+Mm1KWGqyqK3sx/VYSPOZsbq6x00fuFkddUzaVoHmdd9p0yzRudjbNA==' // Replace with your actual API key
                }
            }
        );

        console.log("Email sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error sending email:", error.response ? error.response.data : error.message);
        throw error;
    }
}

export default sendNocMail;