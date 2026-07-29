const fs = require('fs');
let content = fs.readFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', 'utf8');

// The faulty string is:
// {downloadActionType === 'result-sheet' && (
// {/* Template Options */}
// <div className="mb-6 space-y-2 text-left">

content = content.replace(
  "{downloadActionType === 'result-sheet' && (\n{/* Template Options */}",
  "{downloadActionType === 'result-sheet' && (\n<>"
);
content = content.replace(
  "</button>\n                        </div>\n                    </div>)}",
  "</button>\n                        </div>\n                    </div>\n</>\n)}"
);

fs.writeFileSync('src/components/results/engines/school/SchoolResultEngine.tsx', content);
console.log("Patched successfully");
