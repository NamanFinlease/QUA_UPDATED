import moment from "moment";

export async function calculateRepaymentAmount(
    repaymentDate,
    disbursalDate,
    loanRecommended,
    roi
) {
    const localDisburseDate = moment
        .utc(new Date(disbursalDate))
        .clone()
        .local();
    const localRepaymentDate = moment
        .utc(new Date(repaymentDate))
        .clone()
        .local();

    const tenure = localRepaymentDate.diff(localDisburseDate, "days") + 1;
    const repaymentAmount =
        Number(loanRecommended) +
        (Number(loanRecommended) * Number(tenure) * Number(roi)) / 100;

    console.log("repayment amount", repaymentAmount);

    return repaymentAmount;
}
