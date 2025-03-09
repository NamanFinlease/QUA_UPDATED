
const adjustValue = (received, payable) => {
    return received >= payable
        ? { remainingReceived: received - payable, remainingPayable: 0 }
        : { remainingReceived: 0, remainingPayable: payable - received };
};

export const calculateReceivedPayment = (collectionData) => {
    // console.log('Receive Payment 1',collectionData)
    let {
        filteredPaymentHistory,
        camDetails,
        interest,
        penalty,
        penaltyDiscount,
        interestDiscount,
        principalDiscount,
        penaltyReceived,
        principalAmount,
        interestReceived,
        principalReceived,
    } = collectionData[0];
    let { receivedAmount, discount } = filteredPaymentHistory[0];
    let remainingReceivedAmount = receivedAmount;
    let remainingDiscount = discount;
    
    const amounts = [
        { key: "penalty", payable: penalty, received: penaltyReceived, discount: penaltyDiscount },
        { key: "interest", payable: interest, received: interestReceived, discount: interestDiscount },
        { key: "principalAmount", payable: principalAmount, received: principalReceived, discount: principalDiscount },
    ];
    const updatedAmounts = amounts.map(({ key, payable }) => {
        let remainingPayable = payable;
        let appliedDiscount = 0;
        let received = 0;
        
        // console.log(key,payable)
        
        
        
        // Adjust discount if available
        if (remainingDiscount > 0 && payable > 0) {
            const adjustment = adjustValue(remainingDiscount, payable);
            remainingDiscount = adjustment.remainingReceived;
            appliedDiscount = payable - adjustment.remainingPayable;
            remainingPayable = adjustment.remainingPayable;
        }
        
        // Adjust received amount
        if (remainingReceivedAmount > 0 && remainingPayable > 0) {
            const adjustment = adjustValue(remainingReceivedAmount, remainingPayable);
            remainingReceivedAmount = adjustment.remainingReceived;
            received = payable - adjustment.remainingPayable - appliedDiscount
            remainingPayable = adjustment.remainingPayable;
            
        }
        
        // console.log('updated calculated',{ key, payable: remainingAdjustable, discount: appliedDiscount, received },currentRemainingAmount)
        
        // console.log('Receive Payment 2')
        return { key, payable: Number(remainingPayable.toFixed(2)), discount: Number(appliedDiscount.toFixed(2)), received: Number(received.toFixed(2)) };
    });

    const discountKeys = {
        penalty: "penaltyDiscount",
        interest: "interestDiscount",
        principalAmount: "principalDiscount",
    };
    const receivedAmountKeys = {
        penalty: "penaltyReceived",
        interest: "interestReceived",
        principalAmount: "principalReceived",
    };

    const finalValues = updatedAmounts.reduce((acc, { key, payable, discount, received }) => {
        acc[key] = payable;
        if (discountKeys[key]) {
            acc[discountKeys[key]] = discount;
        }
        if (receivedAmountKeys[key]) {
            acc[receivedAmountKeys[key]] = received;
        }
        return acc;
    }, {});



    return { receivedAmount, discount: 0, ...finalValues ,excessAmount: Number(remainingReceivedAmount.toFixed(2)) };

}