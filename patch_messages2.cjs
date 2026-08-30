const fs = require('fs');
let code = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

// Add submitSuggestion function
const submitSyllabusCode = `
  const submitSuggestion = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!suggestionClass) return alert('সব তথ্য দিন');
    setIsSubmitting(true);
    try {
      const payload = { 
        subjects: suggestionSubjectList, 
        session: suggestionSession, 
        exam: suggestionExam,
        status: isDraft ? 'draft' : 'published' 
      };
      if (editingItem) {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            title: suggestionTitle || \`Suggestion \${suggestionSession}\`,
            class_name: \`APP_SUGGESTION_\${suggestionClass}\`,
            message: payload,
            sender_name: profile?.name || 'Admin'
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || 'সাজেশন আপডেট করতে সমস্যা হয়েছে।');
        }
      } else {
        const { error } = await supabase.from('messages').insert({
          institution_id: madrasah?.id,
          class_name: \`APP_SUGGESTION_\${suggestionClass}\`,
          title: suggestionTitle || \`Suggestion \${suggestionSession}\`,
          message: JSON.stringify(payload),
          sender_name: profile?.name || 'Admin'
        });
        if (error) throw error;
      }
      sessionStorage.removeItem(\`messages_cache_\${madrasah?.id}\`);
      setShowSuggestionModal(false);
      setEditingItem(null);
      await fetchData();
    } finally { setIsSubmitting(false); }
  };
`;

code = code.replace(/const submitSyllabus = async/g, submitSyllabusCode + '\n  const submitSyllabus = async');

fs.writeFileSync('src/pages/Messages.tsx', code);
