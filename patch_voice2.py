import sys

with open('src/pages/VoiceBroadcast.tsx', 'r') as f:
    content = f.read()

target = """                                <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                                  <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>"""

replacement = """                                <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                                  <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                
                                {selectedClassId && targetType === 'class' && (
                                  <div className="flex items-center gap-2 px-4 py-2 mt-2 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                    <Users size={16} className="text-[#2563EB]" />
                                    <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-wider">
                                      {lang === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}: {classStudents.length} {lang === 'bn' ? 'জন' : ''}
                                    </p>
                                  </div>
                                )}"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced dropdown UI")

with open('src/pages/VoiceBroadcast.tsx', 'w') as f:
    f.write(content)

