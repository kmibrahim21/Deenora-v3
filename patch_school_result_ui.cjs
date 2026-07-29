const fs = require('fs');
let content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

// We want to remove the template choice completely.
// Let's replace the whole block:
// {downloadActionType === 'result-sheet' && (
//                      <div className="mb-6 space-y-2 text-left">
//                          ...
//                      </div>
//
//                      )}
const regex = /\{downloadActionType === 'result-sheet' && \([\s\S]*?<\/div>[\s]*\)\}/g;
content = content.replace(regex, "");

// Make sure `selectedResultTemplate` defaults to 'classic' instead of anything else if it exists.
content = content.replace(
  "const [selectedResultTemplate, setSelectedResultTemplate] = useState<'classic' | 'premium'>('classic');",
  "const [selectedResultTemplate, setSelectedResultTemplate] = useState<'classic' | 'premium'>('classic');"
);

fs.writeFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', content);
console.log("UI Patched successfully");
