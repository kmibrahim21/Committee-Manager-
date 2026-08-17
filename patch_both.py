import re

# 1. Patch Account.tsx
with open('src/pages/Account.tsx', 'r') as f:
    account = f.read()

card_start = "{/* Association Management Card */}"
card_end = "</button>"

# Find the block
import sys

try:
    s_idx = account.index(card_start)
    e_idx = account.index(card_end, s_idx) + len(card_end)
    
    card_str = account[s_idx:e_idx]
    if "madrasah?.institution_type === 'association'" not in card_str:
        new_card_str = "{madrasah?.institution_type === 'association' && (\n" + card_str + "\n        )}"
        account = account[:s_idx] + new_card_str + account[e_idx:]
        
        with open('src/pages/Account.tsx', 'w') as f:
            f.write(account)
        print("Patched Account.tsx")
except Exception as e:
    print("Error patching Account.tsx:", e)

# 2. Patch Departments.tsx
with open('src/pages/Departments.tsx', 'r') as f:
    dept = f.read()

field_start = "<div className=\"space-y-2.5\">\n                <label className=\"flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2\">\n                  <BookOpen size={12} /> {lang === 'bn' ? 'সমিতির ধরন (ঐচ্ছিক)' : 'Association Type (Optional)'}"
# Let's just find the select block

if "Association Type (Optional)" in dept:
    # Use regex to find the div block
    pattern = r"(<div className=\"space-y-2\.5\">\s*<label className=\"flex items-center gap-2 text-\[10px\] font-black text-slate-400 uppercase tracking-\[0\.2em\] px-2\">\s*<BookOpen size=\{12\} /> \{lang === 'bn' \? 'সমিতির ধরন \(ঐচ্ছিক\)' : 'Association Type \(Optional\)'\}\s*</label>[\s\S]*?</select>\s*</div>)"
    
    match = re.search(pattern, dept)
    if match:
        block = match.group(1)
        if "madrasah?.institution_type === 'association' &&" not in block:
            new_block = "{madrasah?.institution_type === 'association' && (\n" + block + "\n              )}"
            dept = dept.replace(block, new_block)
            with open('src/pages/Departments.tsx', 'w') as f:
                f.write(dept)
            print("Patched Departments.tsx")
    else:
        print("Regex didn't match in Departments.tsx")

