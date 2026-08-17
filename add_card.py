import re

with open('src/pages/Account.tsx', 'r') as f:
    content = f.read()

card = """        {/* Association Management Card */}
        <button 
          onClick={() => setView('management')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sliders size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'ম্যানেজমেন্ট (নীতিমালা)' : 'Management (Policies)'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'সমিতির ধরন ও নিয়ম' : 'Type & Rules'}
            </p>
          </div>
        </button>

"""

content = content.replace("{/* Executive Committee Card */}", card + "{/* Executive Committee Card */}")

with open('src/pages/Account.tsx', 'w') as f:
    f.write(content)

