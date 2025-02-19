export function formatFullName(fName = "", mName = "", lName = "") {
    return [fName, mName, lName]
        .map((name) => name?.trim())
        .filter((name) => name)
        .join(" ")
        .trim();
}
