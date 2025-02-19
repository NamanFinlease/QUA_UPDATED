const splitName = function splitName(fullName) {
    const nameParts = fullName.trim().split(/\s+/); // Split by spaces and remove extra spaces
    let fName = "", mName = "", lName = "";

    if (nameParts.length === 1) {
        fName = nameParts[0];
    } else if (nameParts.length === 2) {
        fName = nameParts[0];
        lName = nameParts[1];
    } else if (nameParts.length >= 3) {
        fName = nameParts[0];
        lName = nameParts.slice(1).join(" "); // Combine all words after the first as lName
    }

    return { fName, mName, lName };
};

export default splitName;
