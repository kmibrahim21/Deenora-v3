const fs = require('fs');
const content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

// Add downloadActionType state
let updated = content.replace(
  "const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn', templateId?: 'classic' | 'premium') => Promise<void>) | null>(null);",
  "const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn', templateId?: 'classic' | 'premium') => Promise<void>) | null>(null);\n  const [downloadActionType, setDownloadActionType] = useState<'marksheet' | 'result-sheet' | 'seat-plan' | 'admit-card' | null>(null);"
);

// Update calls
updated = updated.replace(
  "setDownloadAction(() => (l: 'en' | 'bn', tId?: 'classic' | 'premium') => handleDownloadClassResult(l, tId));",
  "setDownloadAction(() => (l: 'en' | 'bn', tId?: 'classic' | 'premium') => handleDownloadClassResult(l, tId));\n                    setDownloadActionType('result-sheet');"
);

updated = updated.replace(
  "setDownloadAction(() => (l: 'en' | 'bn', tId?: 'classic' | 'premium') => handleDownloadMassMarksheets(l, tId));",
  "setDownloadAction(() => (l: 'en' | 'bn', tId?: 'classic' | 'premium') => handleDownloadMassMarksheets(l, tId));\n                    setDownloadActionType('marksheet');"
);

updated = updated.replace(
  "setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadSeatPlan(l));",
  "setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadSeatPlan(l));\n                            setDownloadActionType('seat-plan');"
);

updated = updated.replace(
  "setDownloadAction(() => (l: 'en' | 'bn') => confirmDownloadAdmitCard(l));",
  "setDownloadAction(() => (l: 'en' | 'bn') => confirmDownloadAdmitCard(l));\n                 setDownloadActionType('admit-card');"
);

// Update modal template selection
updated = updated.replace(
  "{/* Template Options */}",
  "{/* Template Options */}\n                      {downloadActionType === 'result-sheet' && ("
);

// We need to close the conditional block for the template options div
// The div ends around 3734. Let's find it with regex.
// The div structure is:
// <div className="mb-6 space-y-2 text-left">
//   <label>...</label>
//   <div className="grid...">
//      <button>...</button>
//      <button>...</button>
//   </div>
// </div>
// Let's replace the whole section safely.
