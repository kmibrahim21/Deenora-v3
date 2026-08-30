const fs = require('fs');
const file = 'src/components/pdf/SyllabusPDFTemplate.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const examName = parsed\?\.exam \|\| 'পরীক্ষার সিলেবাস ও পাঠ্যসূচি';/, 
  "const examName = parsed?.exam || (isSuggestion ? 'পরীক্ষার সাজেশন' : 'পরীক্ষার সিলেবাস ও পাঠ্যসূচি');");

code = code.replace(/<th className="py-2.5 px-4 font-black">নির্ধারিত পরীক্ষার সিলেবাস ও পাঠ্যক্রম<\/th>/,
  '<th className="py-2.5 px-4 font-black">{isSuggestion ? "নির্ধারিত পরীক্ষার সাজেশন" : "নির্ধারিত পরীক্ষার সিলেবাস ও পাঠ্যক্রম"}</th>');

code = code.replace(/\{sub\.details \|\| 'সিলেবাস অন্তর্ভুক্ত করা হয়নি\।'}/g,
  "{sub.details || (isSuggestion ? 'সাজেশন অন্তর্ভুক্ত করা হয়নি।' : 'সিলেবাস অন্তর্ভুক্ত করা হয়নি।')}");

code = code.replace(/<li>সকল শিক্ষার্থীকে নিজ নিজ সিলেবাস অনুযায়ী পড়ালেখা সম্পন্ন করার জন্য নির্দেশ দেওয়া হচ্ছে\।<\/li>/,
  "<li>সকল শিক্ষার্থীকে নিজ নিজ {isSuggestion ? 'সাজেশন' : 'সিলেবাস'} অনুযায়ী পড়ালেখা সম্পন্ন করার জন্য নির্দেশ দেওয়া হচ্ছে।</li>");

code = code.replace(/সিলেবাস শাখা<br \/>অনুমোদিত সিল/,
  "{isSuggestion ? 'সাজেশন' : 'সিলেবাস'} শাখা<br />অনুমোদিত সিল");

fs.writeFileSync(file, code);
