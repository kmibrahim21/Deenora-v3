const totalPayable = 500;
const totalPaid = 500;
const previousDue = 500;
const balanceDue = Math.max(0, previousDue + totalPayable - totalPaid);
let status = 'unpaid';
if (totalPayable > 0) {
    if (totalPaid >= totalPayable) status = 'paid';
    else if (totalPaid > 0) status = 'partial';
    else status = 'unpaid';
} else {
    status = totalPaid > 0 ? 'paid' : 'no_fee';
}
console.log({status, balanceDue});
