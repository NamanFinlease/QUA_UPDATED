export const APIresponse = (res, message, statusCode, status, data) => {
  let respData = {
    message,
    statusCode,
    status,
    data,
  };
  res.status(statusCode || 200).send(respData);
};



