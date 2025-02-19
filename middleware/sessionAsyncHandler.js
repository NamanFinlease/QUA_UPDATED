import mongoose from "mongoose";
import { APIresponse } from "../utils/apiResponse.js"; // Update with the correct path

// For payment transactions
export const sessionAsyncHandler = (requestHandler) => async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await requestHandler(req, res, session);
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    return APIresponse(
      res,
      error.message || "Something went wrong",
      error.code || 500,
      false
    );
  } finally {
    console.log("session ended-->");
    session.endSession();
  }
};
