import re

with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

# Add state
content = content.replace(
    "const [newSortOrder, setNewSortOrder] = useState<string>('');",
    "const [newSortOrder, setNewSortOrder] = useState<string>('');\n  const [newAssociationType, setNewAssociationType] = useState<string>('');"
)

# Update reset state on close
content = content.replace(
    "onClick={() => { setShowModal(false); setEditingClass(null); setNewClassName(''); setNewSortOrder(''); }}",
    "onClick={() => { setShowModal(false); setEditingClass(null); setNewClassName(''); setNewSortOrder(''); setNewAssociationType(''); }}"
)

# Update handleSaveClass - editingClass branch
content = content.replace(
    "name: newClassName.trim(),\n            sort_order: order ",
    "name: newClassName.trim(),\n            sort_order: order,\n            association_type: newAssociationType || null "
)
content = content.replace(
    "name: newClassName.trim(),\n            sort_order: order\n",
    "name: newClassName.trim(),\n            sort_order: order,\n            association_type: newAssociationType || null\n"
)

content = content.replace(
    "sort_order: order\n        };",
    "sort_order: order,\n          association_type: newAssociationType || null\n        };"
)

# Update edit button logic
content = content.replace(
    "onClick={() => { setEditingClass(cls); setNewClassName(cls.name); setNewSortOrder(cls.sort_order?.toString() || ''); setShowModal(true); }}",
    "onClick={() => { setEditingClass(cls); setNewClassName(cls.name); setNewSortOrder(cls.sort_order?.toString() || ''); setNewAssociationType(cls.association_type || ''); setShowModal(true); }}"
)

# Insert the UI field
ui_field = """
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                  <BookOpen size={12} /> {lang === 'bn' ? 'সমিতির ধরন (ঐচ্ছিক)' : 'Association Type (Optional)'}
                </label>
                <select 
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border-2 rounded-[1.8rem] font-black text-sm outline-none focus:border-[#42f5e9]/30 focus:bg-white transition-all shadow-inner appearance-none`}
                  value={newAssociationType}
                  onChange={(e) => setNewAssociationType(e.target.value)}
                >
                  <option value="">{lang === 'bn' ? 'সাধারণ (কোনো ধরন নেই)' : 'General (None)'}</option>
                  <option value="savings">{lang === 'bn' ? 'সঞ্চয় সমিতি' : 'Savings Association'}</option>
                  <option value="qard_hasan">{lang === 'bn' ? 'করযে হাসানা সমিতি' : 'Qard Hasan Association'}</option>
                  <option value="capital_share">{lang === 'bn' ? 'মূলধন/শেয়ার সমিতি' : 'Capital/Share Association'}</option>
                </select>
              </div>
"""

content = re.sub(
    r"(<div className=\"space-y-2\.5\">\s*<label className=\"flex items-center gap-2 text-\[10px\] font-black text-slate-400 uppercase tracking-\[0\.2em\] px-2\">\s*<Hash size=\{12\} /> সিরিয়াল নম্বর \(Sorting\)\s*</label>\s*<input[^>]+>\s*</div>)",
    r"\1\n" + ui_field,
    content
)

# Make sure resetting works in handleSaveClass
content = content.replace(
    "setNewSortOrder('');\n      setEditingClass(null);",
    "setNewSortOrder('');\n      setNewAssociationType('');\n      setEditingClass(null);"
)


with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
