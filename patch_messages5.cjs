const fs = require('fs');
let code = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

// Extract Syllabus Modal
const syllabusModalStart = code.indexOf('{/* 4. Syllabus Modal */}');
const deleteModalStart = code.indexOf('{/* DELETE CONFIRMATION MODAL */}');

if (syllabusModalStart !== -1 && deleteModalStart !== -1) {
    let syllabusModalCode = code.substring(syllabusModalStart, deleteModalStart);
    
    // Replace all syllabus references with suggestion
    let suggestionModalCode = syllabusModalCode
        .replace(/4\. Syllabus Modal/g, '5. Suggestion Modal')
        .replace(/showSyllabusModal/g, 'showSuggestionModal')
        .replace(/setShowSyllabusModal/g, 'setShowSuggestionModal')
        .replace(/syllabusClass/g, 'suggestionClass')
        .replace(/setSyllabusClass/g, 'setSuggestionClass')
        .replace(/syllabusTitle/g, 'suggestionTitle')
        .replace(/setSyllabusTitle/g, 'setSuggestionTitle')
        .replace(/syllabusExam/g, 'suggestionExam')
        .replace(/setSyllabusExam/g, 'setSuggestionExam')
        .replace(/syllabusSession/g, 'suggestionSession')
        .replace(/setSyllabusSession/g, 'setSuggestionSession')
        .replace(/syllabusSubjectList/g, 'suggestionSubjectList')
        .replace(/setSyllabusSubjectList/g, 'setSuggestionSubjectList')
        .replace(/submitSyllabus/g, 'submitSuggestion')
        .replace(/সিলেবাস যোগ করুন/g, 'সাজেশন যোগ করুন')
        .replace(/বিভিন্ন শ্রেণীর জন্য নতুন সিলেবাস তৈরি অথবা আপডেট করুন/g, 'বিভিন্ন শ্রেণীর জন্য নতুন সাজেশন তৈরি অথবা আপডেট করুন')
        .replace(/সিলেবাস প্রকাশ করুন/g, 'সাজেশন প্রকাশ করুন')
        .replace(/bg-orange-/g, 'bg-emerald-')
        .replace(/text-orange-/g, 'text-emerald-')
        .replace(/border-orange-/g, 'border-emerald-')
        .replace(/hover:bg-orange-/g, 'hover:bg-emerald-')
        .replace(/hover:shadow-orange-/g, 'hover:shadow-emerald-');

    code = code.replace('{/* DELETE CONFIRMATION MODAL */}', suggestionModalCode + '\n      {/* DELETE CONFIRMATION MODAL */}');
    fs.writeFileSync('src/pages/Messages.tsx', code);
    console.log("Suggestion Modal added successfully.");
} else {
    console.log("Could not find boundaries.");
}
