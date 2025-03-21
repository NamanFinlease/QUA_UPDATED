import jwt from "jsonwebtoken";
import { configDotenv } from "dotenv";
configDotenv()

const generateToken = (res, id) => {
    const token = jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
    const isLocal = process.env.NODE_ENV !== "production"; // Defaults to 'development' if NODE_ENV is not set

    res.cookie("jwt", token, {
        httpOnly: true,
        secure: true, // Secure only in production
        sameSite: "None", // Lax for local, None for cross-origin
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days
    });
    return token
};

const generateUserToken = (res, id) => {
    const token = jwt.sign({ id }, process.env.JWT_SECRET_USER, {
        expiresIn: "30d",
    });
    // Set JWT as HTTP-Only cookie
    res.cookie("user_jwt", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days
    });
    return token
};

export { generateToken, generateUserToken };
