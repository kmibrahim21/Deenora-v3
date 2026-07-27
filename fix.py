import sys

with open('src/pages/VoiceBroadcast.tsx', 'r') as f:
    content = f.read()

# Let's fix the structure. It should be:
target = """                            ) : targetType === 'teachers' ? (
                              <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-indigo-600" />
                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                                  {lang === 'bn' ? 'মোট শিক্ষক' : 'Total Teachers'}: {teachers.length}
                                </p>
                              </div>
                            ) : null}
                          </>
                        ) : (targetType === 'specific_institution' && isSuperAdmin) ? (
                              <>
                                <button onClick={() => setShowInstitutionDropdown(!showInstitutionDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                                  <span className={`text-base font-black font-noto ${selectedInstitutionIds.length > 0 ? 'text-[#1E3A8A]' : 'text-slate-400'}`}>
                                    {selectedInstitutionIds.length > 0 ? `${selectedInstitutionIds.length} টি প্রতিষ্ঠান নির্বাচিত` : 'প্রতিষ্ঠান নির্বাচন করুন'}
                                  </span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showInstitutionDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
      
                                {selectedInstitutionIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1">
                                    {allInstitutions.filter(i => selectedInstitutionIds.includes(i.id)).slice(0, 5).map(inst => (
                                      <span key={inst.id} className="px-3 py-1 bg-blue-100 text-[#1E3A8A] text-[10px] font-black rounded-full uppercase tracking-widest">{inst.name}</span>
                                    ))}
                                    {selectedInstitutionIds.length > 5 && (
                                      <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-widest">+{selectedInstitutionIds.length - 5} More</span>
                                    )}
                                  </div>
                                )}
      
                                {showInstitutionDropdown && (
                                  <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                    <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                                      <button 
                                        onClick={() => {
                                          if (selectedInstitutionIds.length === allInstitutions.length) {
                                            setSelectedInstitutionIds([]);
                                          } else {
                                            setSelectedInstitutionIds(allInstitutions.map(i => i.id));
                                          }
                                        }}
                                        className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest hover:underline"
                                      >
                                        {selectedInstitutionIds.length === allInstitutions.length ? 'Deselect All' : 'Select All'}
                                      </button>
                                    </div>
                                    {allInstitutions.map(inst => (
                                      <button key={inst.id} onClick={() => {
                                        if (selectedInstitutionIds.includes(inst.id)) {
                                          setSelectedInstitutionIds(selectedInstitutionIds.filter(id => id !== inst.id));
                                        } else {
                                          setSelectedInstitutionIds([...selectedInstitutionIds, inst.id]);
                                        }
                                      }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 flex items-center justify-between ${selectedInstitutionIds.includes(inst.id) ? 'bg-blue-50 text-[#1E3A8A]' : 'hover:bg-slate-50 text-slate-600'}`}>
                                        <span className="font-black font-noto text-sm truncate pr-4">{inst.name}</span>
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${selectedInstitutionIds.includes(inst.id) ? 'bg-[#2563EB] border-[#2563EB]' : 'border-slate-300'}`}>
                                          {selectedInstitutionIds.includes(inst.id) && <Check size={12} className="text-white" />}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="bg-blue-50 p-6 rounded-[1.8rem] border border-blue-100 flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#2563EB] shadow-sm">
                                  <Users size={24} />
                                </div>
                                <div>
                                  <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-widest mb-1">Targeting All (Default)</p>
                                  <p className="text-sm font-black text-[#1E3A8A]">System-wide broadcast</p>
                                </div>
                              </div>
                            )}
                          </>
                        ) : ("""

replacement = """                            ) : targetType === 'teachers' ? (
                              <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-indigo-600" />
                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                                  {lang === 'bn' ? 'মোট শিক্ষক' : 'Total Teachers'}: {teachers.length}
                                </p>
                              </div>
                            ) : null}
                          </>
                        ) : targetType === 'specific_institution' ? (
                          <>
                                <button onClick={() => setShowInstitutionDropdown(!showInstitutionDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                                  <span className={`text-base font-black font-noto ${selectedInstitutionIds.length > 0 ? 'text-[#1E3A8A]' : 'text-slate-400'}`}>
                                    {selectedInstitutionIds.length > 0 ? `${selectedInstitutionIds.length} টি প্রতিষ্ঠান নির্বাচিত` : 'প্রতিষ্ঠান নির্বাচন করুন'}
                                  </span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showInstitutionDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
      
                                {selectedInstitutionIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1">
                                    {allInstitutions.filter(i => selectedInstitutionIds.includes(i.id)).slice(0, 5).map(inst => (
                                      <span key={inst.id} className="px-3 py-1 bg-blue-100 text-[#1E3A8A] text-[10px] font-black rounded-full uppercase tracking-widest">{inst.name}</span>
                                    ))}
                                    {selectedInstitutionIds.length > 5 && (
                                      <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-widest">+{selectedInstitutionIds.length - 5} More</span>
                                    )}
                                  </div>
                                )}
      
                                {showInstitutionDropdown && (
                                  <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                    <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                                      <button 
                                        onClick={() => {
                                          if (selectedInstitutionIds.length === allInstitutions.length) {
                                            setSelectedInstitutionIds([]);
                                          } else {
                                            setSelectedInstitutionIds(allInstitutions.map(i => i.id));
                                          }
                                        }}
                                        className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest hover:underline"
                                      >
                                        {selectedInstitutionIds.length === allInstitutions.length ? 'Deselect All' : 'Select All'}
                                      </button>
                                    </div>
                                    {allInstitutions.map(inst => (
                                      <button key={inst.id} onClick={() => {
                                        if (selectedInstitutionIds.includes(inst.id)) {
                                          setSelectedInstitutionIds(selectedInstitutionIds.filter(id => id !== inst.id));
                                        } else {
                                          setSelectedInstitutionIds([...selectedInstitutionIds, inst.id]);
                                        }
                                      }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 flex items-center justify-between ${selectedInstitutionIds.includes(inst.id) ? 'bg-blue-50 text-[#1E3A8A]' : 'hover:bg-slate-50 text-slate-600'}`}>
                                        <span className="font-black font-noto text-sm truncate pr-4">{inst.name}</span>
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${selectedInstitutionIds.includes(inst.id) ? 'bg-[#2563EB] border-[#2563EB]' : 'border-slate-300'}`}>
                                          {selectedInstitutionIds.includes(inst.id) && <Check size={12} className="text-white" />}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                          </>
                        ) : ("""

with open('src/pages/VoiceBroadcast.tsx', 'w') as f:
    f.write(content.replace(target, replacement))

