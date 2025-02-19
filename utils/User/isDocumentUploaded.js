const checkUploadedDocuments = (document) => {
    const mandatoryFields = {
        singleDocuments: {
            aadhaarFrontOrBackOrEAadhaar: ["aadhaarFront", "aadhaarBack", "eAadhaar"], // One of these
            panCard: ["panCard"], // Required
            // residentialOrGasOrElectricity: ["others","residential", "gasConnection", "electricityBill"], // One of these
        },
        multipleDocuments: {
            bankOrSalary: ["bankStatement", "salarySlip"], // At least one or both
        },
    };

    let status = { isComplete: true, missingDocuments: [] };

    // Safely handle singleDocuments
    const uploadedSingleDocs = Array.isArray(document.singleDocuments)
        ? document.singleDocuments.map((doc) => doc.type)
        : [];

    // Check Aadhaar (Front or Back or eAadhaar)
    if (!mandatoryFields.singleDocuments.aadhaarFrontOrBackOrEAadhaar.some((field) => uploadedSingleDocs.includes(field))) {
        status.isComplete = false;
        status.missingDocuments.push("aadhaarFront or aadhaarBack or eAadhaar");
    }

    // Check panCard
    if (!uploadedSingleDocs.includes("panCard")) {
        status.isComplete = false;
        status.missingDocuments.push("panCard");
    }

    // Check Residential, Gas, or Electricity Bill
    // if (!mandatoryFields.singleDocuments.residentialOrGasOrElectricity.some((field) => uploadedSingleDocs.includes(field))) {
    //     status.isComplete = false;
    //     status.missingDocuments.push("residential or gasConnection or electricityBill or others");
    // }

    // Safely handle multipleDocuments
    const uploadedMultipleDocs = document.multipleDocuments
        ? Object.keys(document.multipleDocuments).filter(
              (key) => document.multipleDocuments[key] && document.multipleDocuments[key].length > 0
          )
        : [];

    // Check Bank Statement or Salary Slip
    if (!mandatoryFields.multipleDocuments.bankOrSalary.some((field) => uploadedMultipleDocs.includes(field))) {
        status.isComplete = false;
        status.missingDocuments.push("bankStatement or salarySlip");
    }

    return status;
};

export default checkUploadedDocuments;
