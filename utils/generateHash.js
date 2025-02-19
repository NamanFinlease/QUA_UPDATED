import CryptoJS from "crypto-js"

const generateHashCode = async(payableAccount, fName , lName , mobile , personalEmail , city , state, ifscCode)=>{

     let params = {
        key: "test_vh7U9",
        name: `${fName} ${lName}`,
        phone: mobile,
        email: personalEmail,
        address: `${city} ${state}`,
        account_number: payableAccount,
        ifsc: ifscCode,
    }

    
    // Step 1 : Sort the object
    let sorted_params = Object.keys(params).sort().reduce((accumulator, key) => {
        accumulator[key] = params[key]
        return accumulator;
    }, {});
    // Step 2 : Join all Sting Values with |
    let value_string = "";
    let allValues = Object.values(sorted_params);
    for (let i = 0; i < allValues.length; i++) {
        if (typeof allValues[i] != "object") {
            value_string += allValues[i] + "|";
        }
    }
    // Step 3: Append key secret.
    value_string += "API_SECRET"
    // Step 4 : Create hash and add to the params
    const hash = CryptoJS.SHA512(value_string).toString();
    params["hash"] = hash;


    return params
}

export default  generateHashCode   
