import axios from "axios";

export const fetchBRE = async (pan) => {
    try {
        const data = {
            pan_folder: pan,
        };
        const response = await axios.post(
            "https://bre-api.qualoan.com/process",
            data,
            {
                header: {
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error fetching BRE:", error.message);
        return { message: `${error.message}` };
    }
};
