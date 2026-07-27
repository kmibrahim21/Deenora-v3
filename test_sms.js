const isBangla = /[^\x00-\x7F]/.test(message);
function getSmsLengthInfo(message) {
  const isBangla = /[^\x00-\x7F]/.test(message);
  const len = message.length;
  
  if (len === 0) return { parts: 0, length: 0, maxAllowed: isBangla ? 70 : 160, isBangla };

  let parts = 1;
  let maxAllowed = isBangla ? 70 : 160;

  if (isBangla) {
    if (len > 70) {
      parts = Math.ceil(len / 67);
      maxAllowed = parts * 67;
    }
  } else {
    if (len > 160) {
      parts = Math.ceil(len / 153);
      maxAllowed = parts * 153;
    }
  }

  return { parts, length: len, maxAllowed, isBangla };
}

const message = `আসসালামু আলাইকুম, প্রিয় অভিভাবক! আপনার সন্তান {student_name}
{class}
{attendance_percentage}
প্রায় সময় ক্লাসে অনুপস্থিত থাকে। যার কারনে পড়ালেখায় প্রচুর দূর্বলতা পরিলক্ষিত হচ্ছে। এই দূর্বলতার সম্পূর্ণ দায়ভার গার্ডিয়ানের উপর বর্তাবে, প্রতিষ্ঠান কোনভাবেই দায়ী নয়।
{date}
{institution_name}`;

console.log(getSmsLengthInfo(message));
