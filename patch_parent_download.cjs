const fs = require('fs');
const file = 'src/pages/ParentPortal.tsx';
let code = fs.readFileSync(file, 'utf8');

const downloadBtnStr = `
                        {notice.sender_name && (
                          <div className="pt-3 flex items-center gap-2 mt-2">
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest font-noto">
                              প্রেরক: <span className="text-slate-400">{notice.sender_name}</span>
                            </span>
                          </div>
                        )}
`;

const updatedDownloadBtnStr = `
                        <div className="pt-3 flex items-center justify-between mt-2 border-t border-slate-50/50">
                          {notice.sender_name ? (
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest font-noto">
                              প্রেরক: <span className="text-slate-400">{notice.sender_name}</span>
                            </span>
                          ) : <span />}
                          {(notice.class_name?.startsWith('APP_SYLLABUS_') || notice.class_name?.startsWith('APP_SUGGESTION_') || notice.class_name === 'APP_DIARY') && (
                            <button
                               onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    setDownloadingReport(true);
                                    await generateMessagePDF(currentInstitution, notice, lang === 'bn' ? 'bn' : 'en');
                                  } catch (err) {
                                    console.error('PDF error', err);
                                  } finally {
                                    setDownloadingReport(false);
                                  }
                               }}
                               className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white transition-colors rounded-lg flex items-center gap-1.5 text-xs font-bold"
                            >
                               <Download size={14} /> পিডিএফ ডাউনলোড
                            </button>
                          )}
                        </div>
`;

code = code.replace(downloadBtnStr, updatedDownloadBtnStr);
fs.writeFileSync(file, code);
