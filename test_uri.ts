const message = `আসসালামু আলাইকুম, প্রিয় অভিভাবক! আপনার সন্তান মোহাম্মাদ ইব্রাহিম খলিল
নবম শ্রেণী
৮০%
প্রায় সময় ক্লাসে অনুপস্থিত থাকে। যার কারনে পড়ালেখায় প্রচুর দূর্বলতা পরিলক্ষিত হচ্ছে। এই দূর্বলতার সম্পূর্ণ দায়ভার গার্ডিয়ানের উপর বর্তাবে, প্রতিষ্ঠান কোনভাবেই দায়ী নয়।
২৭-০৭-২০২৬
হযরত শাহজালাল (রহঃ) সুন্নিয়া দাখিল মাদ্রাসা`;
const enc = encodeURIComponent(message).replace(/%2B/g, '%252B');
const url = `https://smpp.revesms.com:7790/sendtext?apikey=blablabla&secretkey=blablabla&callerID=blablabla&toUser=01765831777&messageContent=${enc}&type=3`;
console.log(url.length);
