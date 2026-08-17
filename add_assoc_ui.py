with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

target = """                <input 
                  type="number" 
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border-2 rounded-[1.8rem] font-black text-lg outline-none focus:border-[#42f5e9]/30 focus:bg-white transition-all shadow-inner`} 
                  value={newSortOrder} 
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  placeholder="যেমন: ১"
                />
              </div>"""

ui_field = """
              {madrasah?.institution_type === 'association' && (
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
              )}"""

if target in content:
    content = content.replace(target, target + "\n" + ui_field)
    with open('src/pages/Departments.tsx', 'w') as f:
        f.write(content)
    print("UI added!")
else:
    print("Target not found!")

