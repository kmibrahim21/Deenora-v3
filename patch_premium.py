import os

path = "src/components/pdf/PremiumResultSheetTemplate.tsx"
with open(path, "r") as f:
    content = f.read()

# Replace header width
content = content.replace(
    "w-[120px] border-r border-white/20 text-left align-middle truncate",
    "w-[160px] border-r border-white/20 text-left align-middle truncate whitespace-nowrap"
)

# Replace table cell width/wrap
content = content.replace(
    "text-left font-bold text-slate-900 border-r border-slate-200 truncate",
    "text-left font-bold text-slate-900 border-r border-slate-200 truncate whitespace-nowrap"
)

with open(path, "w") as f:
    f.write(content)

print("Patched successfully")
