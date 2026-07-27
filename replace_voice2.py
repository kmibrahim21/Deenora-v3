import sys

with open('src/pages/VoiceBroadcast.tsx', 'r') as f:
    content = f.read()

target = """                    {!isPreSelected && !isInstPreSelected ? (
                      <div className="relative">
                        {!isSuperAdmin ? (
                          <>
                            {targetType === 'class' ? (
                              <>
                                <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                                  <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                {showClassDropdown && (
                                  <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                    {classes.map(cls => (
                                      <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                        <span className="font-black font-noto">{cls.class_name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (targetType === 'specific_institution' && isSuperAdmin) ? ("""

replacement = """                    {!isPreSelected && !isInstPreSelected ? (
                      <div className="relative">
                        {!isSuperAdmin ? (
                          <>
                            <div className="flex bg-slate-100 p-1 rounded-[1.5rem] mb-4">
                              <button
                                onClick={() => setTargetType('class')}
                                className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-[1.2rem] transition-all ${targetType === 'class' || targetType === 'all' ? 'bg-white shadow-sm text-[#1E3A8A]' : 'text-slate-400'}`}
                              >
                                {lang === 'bn' ? 'শিক্ষার্থী' : 'Students'}
                              </button>
                              <button
                                onClick={() => { setTargetType('teachers'); setSelectedClassId(''); }}
                                className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-[1.2rem] transition-all ${targetType === 'teachers' ? 'bg-white shadow-sm text-[#1E3A8A]' : 'text-slate-400'}`}
                              >
                                {lang === 'bn' ? 'শিক্ষক' : 'Teachers'}
                              </button>
                            </div>

                            {targetType === 'class' || targetType === 'all' ? (
                              <>
                                <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                                  <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                {showClassDropdown && (
                                  <div className="absolute top-[120px] left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                    <button onClick={() => { setTargetType('all'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${targetType === 'all' ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                      <span className="font-black font-noto">{lang === 'bn' ? 'সকল শিক্ষার্থী (সম্পূর্ণ প্রতিষ্ঠান)' : 'All Students (Entire Institution)'}</span>
                                    </button>
                                    {classes.map(cls => (
                                      <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setTargetType('class'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                        <span className="font-black font-noto">{cls.class_name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : targetType === 'teachers' ? (
                              <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-indigo-600" />
                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                                  {lang === 'bn' ? 'মোট শিক্ষক' : 'Total Teachers'}: {teachers.length}
                                </p>
                              </div>
                            ) : null}
                          </>
                        ) : (targetType === 'specific_institution' && isSuperAdmin) ? ("""

if target in content:
    with open('src/pages/VoiceBroadcast.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Replaced successfully")
else:
    print("Target not found.")

