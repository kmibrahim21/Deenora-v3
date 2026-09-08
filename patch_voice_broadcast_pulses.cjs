const fs = require('fs');
let code = fs.readFileSync('src/pages/VoiceBroadcast.tsx', 'utf8');

// 1. Add voiceDurations state and getPulsesForVoice
const oldVoicesState = `  const [voices, setVoices] = useState<any[]>([]);`;
const newVoicesState = `  const [voices, setVoices] = useState<any[]>([]);
  const [voiceDurations, setVoiceDurations] = useState<{ [id: string]: number }>({});

  useEffect(() => {
    voices.forEach((v) => {
      if (v.id && v.file_url && !voiceDurations[v.id]) {
        const audio = new Audio(v.file_url);
        audio.onloadedmetadata = () => {
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            setVoiceDurations(prev => ({ ...prev, [v.id]: Math.ceil(audio.duration) }));
          }
        };
      }
    });
  }, [voices]);

  const getPulsesForVoice = (voiceId: string) => {
    const duration = voiceDurations[voiceId] || 0;
    if (duration > 30) {
      return Math.min(2, Math.ceil(duration / 30));
    }
    return 1;
  };`;

code = code.replace(oldVoicesState, newVoicesState);

// 2. Retry estimated cost
code = code.replace(
  "const estimatedCost = uniqueNormalizedPhoneNumbers.length * voiceRate;",
  "const pulses = getPulsesForVoice(retryBroadcastVoiceId || selectedVoiceId);\n      const estimatedCost = uniqueNormalizedPhoneNumbers.length * voiceRate * pulses;"
);

// 3. Pre-confirm estimated cost
code = code.replace(
  "const estimatedCost = count * voiceRate;",
  "const pulses = getPulsesForVoice(selectedVoiceId);\n    const estimatedCost = count * voiceRate * pulses;"
);

// 4. Send broadcast estimated cost
code = code.replace(
  "const finalEstimatedCost = finalCount * voiceRate;",
  "const pulses = getPulsesForVoice(selectedVoiceId);\n      const finalEstimatedCost = finalCount * voiceRate * pulses;"
);

// 5. Update dropdown voice display to show duration & pulses if available
const oldVoiceDropdownOption = `<button key={v.id} onClick={() => { setSelectedVoiceId(v.id); setShowVoiceDropdown(false); }} className={\`w-full text-left px-5 py-3.5 rounded-xl mb-1 \${selectedVoiceId === v.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}\`}>
                              <span className="font-black font-noto">{v.title}</span>
                            </button>`;

const newVoiceDropdownOption = `<button key={v.id} onClick={() => { setSelectedVoiceId(v.id); setShowVoiceDropdown(false); }} className={\`w-full text-left px-5 py-3.5 rounded-xl mb-1 flex items-center justify-between \${selectedVoiceId === v.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}\`}>
                              <span className="font-black font-noto">{v.title}</span>
                              {voiceDurations[v.id] ? (
                                <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-full \${selectedVoiceId === v.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}\`}>
                                  {voiceDurations[v.id]}s ({getPulsesForVoice(v.id)} {getPulsesForVoice(v.id) === 1 ? 'Pulse' : 'Pulses'})
                                </span>
                              ) : null}
                            </button>`;

code = code.replace(oldVoiceDropdownOption, newVoiceDropdownOption);

fs.writeFileSync('src/pages/VoiceBroadcast.tsx', code);
console.log('Successfully patched VoiceBroadcast.tsx for pulses');
