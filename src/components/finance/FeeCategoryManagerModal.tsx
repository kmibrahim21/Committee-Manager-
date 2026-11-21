import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers,
  X,
  Plus,
  Edit3,
  Trash2,
  Tag,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from 'supabase';
import { Institution } from 'types';
import {
  FeeCategory,
  FeeCategoryColor,
  FeeCategoryFrequency,
  FREQUENCY_LABELS,
  CATEGORY_COLOR_CLASSES,
  saveInstitutionFeeCategories,
} from '../../utils/feeCategoryHelper';

interface FeeCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  madrasah: Institution;
  lang: 'en' | 'bn';
  categories: FeeCategory[];
  onCategoriesUpdated: (categories: FeeCategory[]) => void;
}

const COLOR_OPTIONS: { id: FeeCategoryColor; labelBn: string; labelEn: string }[] = [
  { id: 'blue', labelBn: 'নীল', labelEn: 'Blue' },
  { id: 'emerald', labelBn: 'সবুজ', labelEn: 'Emerald' },
  { id: 'purple', labelBn: 'বেগুনি', labelEn: 'Purple' },
  { id: 'amber', labelBn: 'সোনালি', labelEn: 'Amber' },
  { id: 'rose', labelBn: 'লাল', labelEn: 'Rose' },
  { id: 'slate', labelBn: 'স্লেট', labelEn: 'Slate' },
];

export const FeeCategoryManagerModal: React.FC<FeeCategoryManagerModalProps> = ({
  isOpen,
  onClose,
  madrasah,
  lang,
  categories,
  onCategoriesUpdated,
}) => {
  const isDark = madrasah?.theme === 'dark';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<FeeCategoryFrequency>('monthly');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<FeeCategoryColor>('blue');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setError(null);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setFrequency('monthly');
    setDescription('');
    setColor('blue');
  };

  const handleStartEdit = (cat: FeeCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setFrequency(cat.frequency);
    setDescription(cat.description || '');
    setColor(cat.color || 'blue');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(lang === 'bn' ? 'ক্যাটাগরির নাম লিখুন' : 'Please enter category name');
      return;
    }

    const duplicate = categories.find(
      (c) => c.name.toLowerCase().trim() === trimmedName.toLowerCase() && c.id !== editingId
    );
    if (duplicate) {
      setError(lang === 'bn' ? 'এই নামে একটি ক্যাটাগরি ইতোমধ্যেই রয়েছে' : 'Category name already exists');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let updated: FeeCategory[];
      if (editingId) {
        updated = categories.map((c) =>
          c.id === editingId
            ? {
                ...c,
                name: trimmedName,
                frequency,
                description: description.trim() || undefined,
                color,
              }
            : c
        );
      } else {
        const newCat: FeeCategory = {
          id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: trimmedName,
          frequency,
          is_default: false,
          description: description.trim() || undefined,
          color,
        };
        updated = [...categories, newCat];
      }

      const saved = await saveInstitutionFeeCategories(supabase, madrasah, updated);
      onCategoriesUpdated(saved);
      resetForm();
    } catch (err: any) {
      setError(err?.message || (lang === 'bn' ? 'সংরক্ষণ করতে সমস্যা হয়েছে' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (catId: string) => {
    setSaving(true);
    setError(null);
    try {
      const updated = categories.filter((c) => c.id !== catId);
      const saved = await saveInstitutionFeeCategories(supabase, madrasah, updated);
      onCategoriesUpdated(saved);
      if (editingId === catId) resetForm();
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err?.message || (lang === 'bn' ? 'ডিলিট করতে সমস্যা হয়েছে' : 'Failed to delete'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1050] bg-black/60 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
                isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#42f5e9]/15 text-[#0fb5ab]'
              }`}
            >
              <Layers size={22} />
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-black font-noto leading-tight ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                {lang === 'bn' ? 'চাঁদা ও ফি ক্যাটাগরি সেটিংস' : 'Fee & Contribution Categories'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {lang === 'bn' ? 'কমিটির হিসাবের ধরণ ও ফ্রিকোয়েন্সি ম্যানেজ করুন' : 'Configure category types & frequency'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-400 hover:text-slate-700 border border-slate-200'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add / Edit Form */}
          <form
            onSubmit={handleSubmit}
            className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${
              isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50/80 border-slate-200/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black font-noto uppercase tracking-wider ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                {editingId
                  ? lang === 'bn'
                    ? 'ক্যাটাগরি এডিট করুন'
                    : 'Edit Category'
                  : lang === 'bn'
                  ? 'নতুন ক্যাটাগরি যোগ করুন'
                  : 'Add New Category'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 underline"
                >
                  {lang === 'bn' ? 'এডিট বাতিল' : 'Cancel Edit'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">
                  {lang === 'bn' ? 'ক্যাটাগরির নাম' : 'Category Name'} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: বিশেষ কল্যাণ তহবিল' : 'e.g., Welfare Fund'}
                  className={`w-full h-11 px-4 rounded-xl border text-xs font-bold outline-none transition-all ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-[#42f5e9]'
                      : 'bg-white border-slate-200 text-slate-800 focus:border-[#0fb5ab]'
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">
                  {lang === 'bn' ? 'আদায়ের ফ্রিকোয়েন্সি' : 'Frequency'}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(Object.keys(FREQUENCY_LABELS) as FeeCategoryFrequency[]).map((freqKey) => (
                    <button
                      type="button"
                      key={freqKey}
                      onClick={() => setFrequency(freqKey)}
                      className={`py-2 px-2 rounded-xl text-[10px] font-black border transition-all font-noto ${
                        frequency === freqKey
                          ? 'bg-[#0fb5ab] text-white border-[#0fb5ab] shadow-sm'
                          : isDark
                          ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {lang === 'bn' ? FREQUENCY_LABELS[freqKey].bn : FREQUENCY_LABELS[freqKey].en}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">
                  {lang === 'bn' ? 'সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)' : 'Short Description (Optional)'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={lang === 'bn' ? 'সংক্ষিপ্ত নোট...' : 'Optional short note...'}
                  className={`w-full h-10 px-4 rounded-xl border text-xs font-medium outline-none transition-all ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-[#42f5e9]'
                      : 'bg-white border-slate-200 text-slate-700 focus:border-[#0fb5ab]'
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1">
                  {lang === 'bn' ? 'ব্যাজ কালার' : 'Badge Color'}
                </label>
                <div className="flex items-center gap-2.5 px-1">
                  {COLOR_OPTIONS.map((opt) => {
                    const cls = CATEGORY_COLOR_CLASSES[opt.id];
                    const selected = color === opt.id;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setColor(opt.id)}
                        title={lang === 'bn' ? opt.labelBn : opt.labelEn}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${cls.dot} ${
                          selected
                            ? 'ring-2 ring-offset-2 ring-[#0fb5ab] scale-110 dark:ring-offset-slate-900'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {selected && <Check size={14} className="text-white" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#0fb5ab] to-[#0e8a84] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Plus size={16} />
                  <span>
                    {editingId
                      ? lang === 'bn'
                        ? 'আপডেট সংরক্ষণ করুন'
                        : 'Save Changes'
                      : lang === 'bn'
                      ? 'ক্যাটাগরি যোগ করুন'
                      : 'Add Category'}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Existing Categories List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {lang === 'bn' ? 'বিদ্যমান ক্যাটাগরিসমূহ' : 'Existing Categories'} ({categories.length})
              </span>
            </div>

            <div className="space-y-2">
              {categories.map((cat) => {
                const cColor = CATEGORY_COLOR_CLASSES[cat.color || 'blue'];
                const freqLabel = FREQUENCY_LABELS[cat.frequency] || FREQUENCY_LABELS.custom;
                const isConfirming = deleteConfirmId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                      isDark ? 'bg-slate-800/40 border-slate-700/80' : 'bg-white border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black border font-noto ${
                            isDark
                              ? `${cColor.darkBg} ${cColor.darkText} ${cColor.darkBorder}`
                              : `${cColor.bg} ${cColor.text} ${cColor.border}`
                          }`}
                        >
                          <Tag size={11} />
                          <span>{cat.name}</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {lang === 'bn' ? freqLabel.badgeBn : freqLabel.en}
                        </span>
                        {cat.is_default && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-[#42f5e9]/15 text-[#0fb5ab]">
                            {lang === 'bn' ? 'ডিফল্ট' : 'Default'}
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-slate-400 truncate font-noto">{cat.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(cat.id)}
                            disabled={saving}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-black"
                          >
                            {lang === 'bn' ? 'হ্যাঁ' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black ${
                              isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {lang === 'bn' ? 'না' : 'No'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                              isDark
                                ? 'bg-slate-800 text-sky-400 hover:bg-slate-700'
                                : 'bg-slate-50 text-blue-600 hover:bg-blue-50'
                            }`}
                            title={lang === 'bn' ? 'এডিট' : 'Edit'}
                          >
                            <Edit3 size={14} />
                          </button>
                          {!cat.is_default && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(cat.id)}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                isDark
                                  ? 'bg-slate-800 text-rose-400 hover:bg-rose-950/40'
                                  : 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                              }`}
                              title={lang === 'bn' ? 'ডিলিট' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FeeCategoryManagerModal;
