
export async function createBeneficiary(payableAccount,fName , lName , mobile , personalEmail , city , state, ifscCode , hash) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    // headers.append("Authorization", `Basic ${Buffer.from('test_key:test_secret').toString('base64')}`);
    headers.append("Authorization", `Basic ${Buffer.from('test_vh7U9:m2450iFjbr').toString('base64')}`);
    console.log("headers-->" , headers)

    const body = JSON.stringify({
        key: "test_vh7U9",
        name:  `${fName} ${lName}`,
        phone: mobile,
        email: personalEmail,
        address:  `${city} ${state}`,
        account_number: payableAccount,
        ifsc: ifscCode,
        hash: hash,
    });

    const response = await fetch("https://api.paytring.com/api/v2/payout/beneficiary/create", {
        method: "POST",
        headers,
        body,
        redirect: "follow",
    });

    return response.json();
}


export async function createPayout(amount, payableAccount, beneficiaryId, receiptId, hash) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    // headers.append("Authorization", "Basic dGVzdF9rZXk6dGVzdF9zZWNyZXQ=");
    headers.append("Authorization", "Basic dGVzdF92aDdVOTptMjQ1MGlGamJy");

    const body = JSON.stringify({
        key: "test_vh7U9",
        pg: "paytring",
        account_number: payableAccount,
        beneficiary_id: beneficiaryId,
        method: "imps",
        amount: amount,
        receipt_id: receiptId,
        hash: hash,
    });

    const response = await fetch("https://api.paytring.com/api/v2/payout/create", {
        method: "POST",
        headers,
        body,
        redirect: "follow",
    });

    return response.json();
}


export async function fetchPayout(transferId , hash) {

    const headers = new Headers();
    headers.append("REFERER", "localhost");
    headers.append("Content-Type", "application/json");
    // headers.append("Authorization", "Basic dGVzdF9rZXk6dGVzdF9zZWNyZXQ=");
    headers.append("Authorization", "Basic dGVzdF92aDdVOTptMjQ1MGlGamJy");
     

    const body = JSON.stringify({
        key: "test_vh7U9",
        id: transferId,
        fetch_type: "advance",
        hash: hash,
    });

    const response = await fetch("https://api.paytring.com/api/v2/payout/fetch", {
        method: "POST",
        headers,
        body,
        redirect: "follow",
    });

    return response.json();
}