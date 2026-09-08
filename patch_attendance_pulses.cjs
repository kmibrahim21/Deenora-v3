const fs = require('fs');
let code = fs.readFileSync('src/pages/Attendance.tsx', 'utf8');

const oldTemplatesState = `  const [voiceTemplates, setVoiceTemplates] = useState<any[]>([]);`;
const newTemplatesState = `  const [voiceTemplates, setVoiceTemplates] = useState<any[]>([]);
  const [voiceDurations, setVoiceDurations] = useState<{ [id: string]: number }>({});

  useEffect(() => {
    voiceTemplates.forEach((v) => {
      if (v.id && v.file_url && !voiceDurations[v.id]) {
        const audio = new Audio(v.file_url);
        audio.onloadedmetadata = () => {
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            setVoiceDurations(prev => ({ ...prev, [v.id]: Math.ceil(audio.duration) }));
          }
        };
      }
    });
  }, [voiceTemplates]);

  const getPulsesForVoice = (voiceId: string) => {
    const duration = voiceDurations[voiceId] || 0;
    if (duration > 30) {
      return Math.min(2, Math.ceil(duration / 30));
    }
    return 1;
  };`;

code = code.replace(oldTemplatesState, newTemplatesState);

code = code.replace(
  "const estimatedCost = uniquePhoneNumbers.length * voiceRate;",
  "const pulses = getPulsesForVoice(selectedVoiceTemplateId);\n    const estimatedCost = uniquePhoneNumbers.length * voiceRate * pulses;"
);

fs.writeFileSync('src/pages/Attendance.tsx', code);
console.log('Successfully patched Attendance.tsx for pulses');
