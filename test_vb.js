const bnToEn = (str) => {
  const numbers = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  return str.replace(/[০-৯]/g, match => numbers[match]);
};

let phoneNumbers = ["01765831777", "01765831777 "];
const normalizedPhoneNumbers = phoneNumbers
  .map(phone => {
    if (!phone) return '';
    const enPhone = bnToEn(String(phone));
    const digits = enPhone.replace(/[^0-9]/g, '');
    if (digits.length === 11 && digits.startsWith('01')) return digits;
    if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
    if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
    return digits;
  })
  .filter(p => p && p.length === 11 && p.startsWith('01'));

console.log("normalizedPhoneNumbers:", normalizedPhoneNumbers);
