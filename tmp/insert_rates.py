
import sys

file_path = 'src/pages/SuperAccount.tsx'
insertion_line = 1350

new_content = """                 {/* Rates */}
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Service Rates (Per Unit)</h4>
                    <div className={`p-4 rounded-[2rem] border grid grid-cols-1 md:grid-cols-2 gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Non-Masking Rate (TK)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} 
                            value={globalSettings.sms_provider_config?.non_masking_rate || 0} 
                            onChange={(e) => setGlobalSettings({
                               ...globalSettings,
                               sms_provider_config: {
                                  ...globalSettings.sms_provider_config,
                                  non_masking_rate: parseFloat(e.target.value)
                               }
                            })} 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Masking Rate (TK)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} 
                            value={globalSettings.sms_provider_config?.masking_rate || 0} 
                            onChange={(e) => setGlobalSettings({
                               ...globalSettings,
                               sms_provider_config: {
                                  ...globalSettings.sms_provider_config,
                                  masking_rate: parseFloat(e.target.value)
                               }
                            })} 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Bulk SMS Rate (TK)</label>
                          <input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.sms_rate} onChange={(e) => setGlobalSettings({...globalSettings, sms_rate: parseFloat(e.target.value)})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Voice Call Rate (TK)</label>
                          <input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.voice_rate} onChange={(e) => setGlobalSettings({...globalSettings, voice_rate: parseFloat(e.target.value)})} />
                       </div>
                    </div>
                 </div>
"""

with open(file_path, 'r') as f:
    lines = f.readlines()

# insertion_line is 1-indexed
lines.insert(insertion_line - 1, new_content + "\n")

with open(file_path, 'w') as f:
    f.writelines(lines)
