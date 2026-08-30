const fs = require('fs');
let code = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

const suggestionTabBlock = `
              {/* === TAB 4: SUGGESTION === */}
              {activeTab === 'suggestion' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                       <BookOpen size={18} className="text-emerald-500" />
                       {lang === 'bn' ? 'সাজেশন' : 'Suggestion'}
                    </h2>
                    <button onClick={() => { 
                       setEditingItem(null); 
                       setSuggestionTitle('');
                      setSuggestionClass('');
                      setSuggestionExam('');
                      setSuggestionSession('2025-26');
                      setSuggestionSubjectList([
                        { subject: 'বাংলা', details: '' }
                      ]);
                      setShowSuggestionModal(true); 
                     }} className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                       <Plus size={14} /> {lang === 'bn' ? 'সাজেশন যোগ করুন' : 'Add Suggestion'}
                    </button>
                  </div>

                  {suggestionList.length > 0 ? (
                    <div className="space-y-6">
                      {classes.map(cls => {
                         const clsSyllabus = suggestionList.filter(m => m.class_name === \`APP_SUGGESTION_\${cls.class_name}\`);
                         if(clsSyllabus.length === 0) return null;
                         return (
                           <div key={cls.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                             <div className="bg-emerald-50/50 px-4 py-3 border-b border-slate-200 font-black text-emerald-900 flex items-center gap-2">
                               {cls.class_name}
                             </div>
                             <div className="divide-y divide-slate-100">
                              {clsSyllabus.map(s => (
                                 <SyllabusItem key={s.id} item={s} onDelete={handleDelete} onEdit={startEdit} onDownload={handleDownload} isDownloading={isDownloading === s.id} />
                               ))}
                             </div>
                           </div>
                         );
                      })}
                      {(() => {
                        const matchedClassNames = classes.map(c => \`APP_SUGGESTION_\${c.class_name}\`);
                        const unmatched = suggestionList.filter(s => !matchedClassNames.includes(s.class_name));
                        if (unmatched.length === 0) return null;
                        return (
                          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-black text-slate-800 flex items-center gap-2">
                              Other / Unknown Classes
                            </div>
                            <div className="divide-y divide-slate-100">
                              {unmatched.map(s => (
                                 <SyllabusItem key={s.id} item={s} onDelete={handleDelete} onEdit={startEdit} onDownload={handleDownload} isDownloading={isDownloading === s.id} />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 font-bold">{lang === 'bn' ? 'কোনো সাজেশন নেই' : 'No suggestions found'}</div>
                  )}
                </div>
              )}
           </>
         )}
      </div>

      {/* --- MODALS --- */}
`;

code = code.replace(/<\/>\s*\)\}\s*<\/div>\s*\{\/\* --- MODALS --- \*\/\}/, suggestionTabBlock);

fs.writeFileSync('src/pages/Messages.tsx', code);
