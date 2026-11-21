import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Department, Member, UserRole, Profile } from 'types';
import { Loader2, Plus, X, DollarSign, Tag, CheckCircle2, Download, ChevronDown, RefreshCw, AlertCircle, Info, Users, CreditCard, Calendar, Settings, Layers, Edit3, Trash2 } from 'lucide-react';
import { sortMadrasahClasses } from 'pages/Departments';
import { generateDepartmentSubscriptionReportPDF, generateSubscriptionReceiptPDF } from '../../utils/pdfGenerator';
import { FeeCategoryManagerModal } from './FeeCategoryManagerModal';
import {
  FeeCategory,
  FREQUENCY_LABELS,
  CATEGORY_COLOR_CLASSES,
  convertBnToEnNumberString,
  getLastDayOfMonth,
  formatMonthLabel,
  getInstitutionFeeCategories,
  getCategoryForStructure,
  batchSaveFeeStructureCategories,
  getStructureDateRange,
  saveStructureDateRange,
} from '../../utils/feeCategoryHelper';

interface FlexibleSubscriptionEngineProps {
  activeTab: 'fees' | 'structures';
  madrasah: Institution;
  lang: 'en' | 'bn';
  departments: Department[];
  onStudentClick?: (student: any) => void;
  role?: UserRole;
  profile?: Profile | null;
}

export const FlexibleSubscriptionEngine: React.FC<FlexibleSubscriptionEngineProps> = ({ activeTab, madrasah, lang, departments: initialClasses, onStudentClick, role, profile }) => {
  const isDark = madrasah.theme === 'dark';
  const [departments, setClasses] = useState<Department[]>(initialClasses || []);
  const [feesReport, setFeesReport] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Fee Collection State
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [anyStudentsInMadrasah, setAnyStudentsInMadrasah] = useState<boolean | null>(null);
  
  // Collection Modal State
  const [showFeeCollection, setShowFeeCollection] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [availableFeeItems, setAvailableFeeItems] = useState<any[]>([]);
  const [selectedFeeCategories, setSelectedFeeCategories] = useState<string[]>([]);
  const [paidFeeCategories, setPaidFeeCategories] = useState<string[]>([]);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<any>(null);
  const [studentFeeHistory, setStudentFeeHistory] = useState<any[]>([]);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear().toString());

  // Structure & Category State
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>(() => getInstitutionFeeCategories(madrasah));
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [editingStructure, setEditingStructure] = useState<any | null>(null);
  const [structureDeptId, setStructureDeptId] = useState('');
  const [structureCategoryId, setStructureCategoryId] = useState('');
  const [structureAmount, setStructureAmount] = useState('');
  const [useStructureDateRange, setUseStructureDateRange] = useState(false);
  const [structureStartMonth, setStructureStartMonth] = useState('');
  const [structureEndMonth, setStructureEndMonth] = useState('');
  const [showStructureDeptDropdown, setShowStructureDeptDropdown] = useState(false);
  const [showStructureCategoryDropdown, setShowStructureCategoryDropdown] = useState(false);

  const openAddStructureModal = () => {
    const cats = getInstitutionFeeCategories(madrasah);
    setFeeCategories(cats);
    setEditingStructure(null);
    setStructureDeptId('');
    setStructureCategoryId(cats[0]?.id || '');
    setStructureAmount('');
    setUseStructureDateRange(false);
    setStructureStartMonth('');
    setStructureEndMonth('');
    setShowStructureDeptDropdown(false);
    setShowStructureCategoryDropdown(false);
    setActionError(null);
    setShowAddStructure(true);
  };

  const openEditStructureModal = (structure: any) => {
    const cats = getInstitutionFeeCategories(madrasah);
    setFeeCategories(cats);
    const matchedCat = getCategoryForStructure(structure, cats, madrasah);
    const range = getStructureDateRange(structure, madrasah);
    const hasRange = Boolean(range.start_date || range.due_date);

    setEditingStructure(structure);
    setStructureDeptId(structure.department_id || '');
    setStructureCategoryId(matchedCat.id);
    setStructureAmount(String(structure.amount ?? ''));
    setUseStructureDateRange(hasRange);
    setStructureStartMonth(range.start_date ? range.start_date.slice(0, 7) : '');
    setStructureEndMonth(range.due_date ? range.due_date.slice(0, 7) : '');
    setShowStructureDeptDropdown(false);
    setShowStructureCategoryDropdown(false);
    setActionError(null);
    setShowAddStructure(true);
  };

  const handleSaveStructure = async () => {
    const selectedCat = feeCategories.find(c => c.id === structureCategoryId);
    if (!selectedCat) {
      setActionError(lang === 'bn' ? 'একটি ক্যাটাগরি নির্বাচন করুন' : 'Please select a category');
      return;
    }

    const parsedAmount = parseFloat(convertBnToEnNumberString(structureAmount)) || 0;
    const startDate = useStructureDateRange && structureStartMonth ? `${structureStartMonth}-01` : null;
    const dueDate = useStructureDateRange && structureEndMonth ? getLastDayOfMonth(structureEndMonth) : null;

    setIsSaving(true);
    setActionError(null);
    try {
      let savedStruct: any = null;
      const basePayload = {
        institution_id: madrasah.id,
        department_id: structureDeptId || null,
        fee_name: selectedCat.name,
        amount: parsedAmount,
      };
      const extendedPayload = {
        ...basePayload,
        category_id: selectedCat.id,
        start_date: startDate,
        due_date: dueDate,
      };

      if (editingStructure?.id) {
        let { data, error } = await supabase
          .from('fee_structures')
          .update(extendedPayload)
          .eq('id', editingStructure.id)
          .select('*')
          .single();

        if (error && (error.code === '42703' || error.message?.includes('column'))) {
          const retry = await supabase
            .from('fee_structures')
            .update(basePayload)
            .eq('id', editingStructure.id)
            .select('*')
            .single();
          data = retry.data;
          error = retry.error;
        }
        if (error) throw error;
        savedStruct = data;
      } else {
        let { data, error } = await supabase
          .from('fee_structures')
          .insert(extendedPayload)
          .select('*')
          .single();

        if (error && (error.code === '42703' || error.message?.includes('column'))) {
          const retry = await supabase
            .from('fee_structures')
            .insert(basePayload)
            .select('*')
            .single();
          data = retry.data;
          error = retry.error;
        }
        if (error) throw error;
        savedStruct = data;
      }

      if (savedStruct?.id) {
        await batchSaveFeeStructureCategories(supabase, madrasah, { [savedStruct.id]: selectedCat.id });
        await saveStructureDateRange(supabase, madrasah, savedStruct.id, {
          start_date: startDate || undefined,
          due_date: dueDate || undefined,
        });
      }

      setShowAddStructure(false);
      setEditingStructure(null);
      fetchData();
    } catch (e: any) {
      setActionError(e?.message || (lang === 'bn' ? 'সেভ করতে সমস্যা হয়েছে' : 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDownloadLangModal, setShowDownloadLangModal] = useState(false);
  const [downloadAction, setDownloadAction] = useState<((lang: 'en' | 'bn') => Promise<void>) | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Accounting Settings State
  const [accountingStartDate, setAccountingStartDate] = useState(madrasah.config_json?.accounting_start_date || '');
  const [accountingEndDate, setAccountingEndDate] = useState(madrasah.config_json?.accounting_end_date || '');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  const handleSaveAccountingConfig = async () => {
    setIsSavingConfig(true);
    setConfigSuccess(false);
    try {
      const updatedConfig: any = {
        ...(madrasah.config_json || {}),
        accounting_start_date: accountingStartDate || null,
        accounting_end_date: accountingEndDate || null,
      };

      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);

      if (error) throw error;
      
      madrasah.config_json = updatedConfig;
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error updating accounting dates:", err);
      setActionError(lang === 'bn' ? "হিসাব শুরুর তারিখ সেভ করতে সমস্যা হয়েছে: " + err.message : "Error saving accounting dates: " + err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [madrasah.id]);

  useEffect(() => {
    fetchData();
  }, [madrasah.id, activeTab, selectedMonth, selectedClass]);

  useEffect(() => {
    if (selectedStudent) {
      initializeFeeCollection(selectedStudent);
    }
  }, [selectedStudent]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('departments').select('*').eq('institution_id', madrasah.id);
    if (data) {
      let filteredClasses = data;
      if (role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0) {
        filteredClasses = data.filter(cls => profile.permissions.allowed_departments.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      if (activeTab === 'fees') {
        const classId = selectedClass === '' ? null : selectedClass;
        
        const { data: feeStructures } = await supabase.from('fee_structures')
            .select('*')
            .eq('institution_id', madrasah.id);

        const { data: feesData } = await supabase.from('fees')
            .select('member_id, amount_paid, discount')
            .eq('institution_id', madrasah.id)
            .eq('month', selectedMonth);

        let filteredData = [];
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_monthly_dues_report', {
            p_institution_id: madrasah.id,
            p_class_id: classId,
            p_month: selectedMonth
          });
          
          if (!rpcError && rpcData && rpcData.length > 0) {
            filteredData = rpcData;
          } else {
            // Robust client-side query fallback directly from public.members table
            let query = supabase
              .from('members')
              .select('id, name, roll, member_id_number, department_id, departments(name)')
              .eq('institution_id', madrasah.id);
            
            if (classId) {
              query = query.eq('department_id', classId);
            }
            
            const { data: membersData, error: membersError } = await query;
            if (membersError) throw membersError;
            
            filteredData = (membersData || []).map((m: any) => ({
              member_id: m.id,
              student_name: m.name,
              student_roll: m.member_id_number || m.roll || '-',
              member_id_number: m.member_id_number,
              department_id: m.department_id,
              department_name: m.departments?.name || m.departments?.[0]?.name || ''
            }));
          }
        } catch (e) {
          console.warn("RPC failed, trying direct query:", e);
          let query = supabase
            .from('members')
            .select('id, name, roll, member_id_number, department_id, departments(name)')
            .eq('institution_id', madrasah.id);
          
          if (classId) {
            query = query.eq('department_id', classId);
          }
          
          const { data: membersData, error: membersError } = await query;
          if (membersError) throw membersError;
          
          filteredData = (membersData || []).map((m: any) => ({
            member_id: m.id,
            student_name: m.name,
            student_roll: m.member_id_number || m.roll || '-',
            member_id_number: m.member_id_number,
            department_id: m.department_id,
            department_name: m.departments?.name || m.departments?.[0]?.name || ''
          }));
        }

        if (role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0 && !classId) {
          filteredData = filteredData.filter((student: any) => profile.permissions.allowed_departments.includes(student.department_id));
        }

        const correctedData = filteredData.map((student: any) => {
            const memberId = student.member_id || student.student_id || student.id;
            const memberName = student.student_name || student.name || '';
            const memberRoll = student.member_id_number || student.student_roll || student.roll || '-';

            const studentFeeStructures = feeStructures?.filter(fs => fs.department_id === student.department_id || fs.department_id === null) || [];
            const totalPayable = studentFeeStructures.reduce((sum, fs) => sum + Number(fs.amount), 0);
            
            const studentFees = feesData?.filter(f => f.member_id === memberId) || [];
            const totalPaid = studentFees.reduce((sum, f) => sum + Number(f.amount_paid) + Number(f.discount || 0), 0);
            
            const balanceDue = Math.max(0, totalPayable - totalPaid);
            
            let status = 'unpaid';
            if (totalPayable <= 0) status = 'no_fee';
            else if (totalPaid >= totalPayable) status = 'paid';
            else if (totalPaid > 0) status = 'partial';

            return {
                ...student,
                id: memberId,
                member_id: memberId,
                name: memberName,
                student_name: memberName,
                roll: memberRoll,
                student_roll: memberRoll,
                total_payable: totalPayable,
                total_paid: totalPaid,
                balance_due: balanceDue,
                status: status
            };
        });

        setFeesReport(correctedData || []);

        if (!filteredData || filteredData.length === 0) {
          let checkQuery = supabase.from('members').select('id', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
          if (classId) checkQuery = checkQuery.eq('department_id', classId);
          const { count } = await checkQuery;
          setAnyStudentsInMadrasah(count && count > 0 ? true : false);
        } else {
          setAnyStudentsInMadrasah(true);
        }
      }

      if (activeTab === 'structures') {
        const { data } = await supabase.from('fee_structures').select('*, departments(name)').eq('institution_id', madrasah.id);
        if (data) setStructures(data || []);
      }
    } catch (e: any) {
      console.error("Fetch Error:", e);
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeFeeCollection = async (student: any) => {
    setDiscount('');
    
    // 1. Fetch structures
    const { data: structures } = await supabase.from('fee_structures')
      .select('*')
      .eq('institution_id', madrasah.id)
      .or(`department_id.eq.${student.department_id},department_id.is.null`);
    if (!structures) {
        setAvailableFeeItems([]);
        return;
    }
    setAvailableFeeItems(structures);

    // 2. Fetch ledger entries for this student/month to see what's paid
    const { data: ledgerData } = await supabase.from('ledger')
      .select('description')
      .eq('institution_id', madrasah.id)
      .eq('type', 'income')
      .eq('category', 'Member Fee')
      .ilike('description', `%${student.name} (%Month: ${selectedMonth})%`);

    const paidItems: string[] = [];
    ledgerData?.forEach(l => {
        const desc = l.description.split(' - ')[0];
        if (desc) {
            desc.split(', ').forEach(item => paidItems.push(item));
        }
    });
    setPaidFeeCategories(paidItems);

    // 3. Select unpaid items
    const unpaid = structures.filter(s => !paidItems.includes(s.fee_name));
    const unpaidNames = unpaid.map(s => s.fee_name);
    setSelectedFeeCategories(unpaidNames);
    
    // 4. Set initial amount
    const total = unpaid.reduce((sum, s) => sum + s.amount, 0);
    setCollectAmount(total > 0 ? total.toString() : '');
  };

  const calculateTotal = (categories: string[], discountVal: string, items = availableFeeItems, monthsCount = 1) => {
    const gross = items
        .filter(item => categories.includes(item.fee_name))
        .reduce((sum, item) => sum + item.amount, 0) * monthsCount;
    
    const disc = parseFloat(discountVal) || 0;
    const net = Math.max(0, gross - disc);
    return net > 0 ? net.toString() : '';
  };

  const handleCollectFee = async () => {
    if (!selectedStudent || !collectAmount) return;
    setIsSaving(true);
    try {
      const totalAmt = parseFloat(collectAmount);
      const totalDiscount = parseFloat(discount) || 0;
      const memberName = selectedStudent.name || selectedStudent.student_name || 'সদস্য';
      const memberId = selectedStudent.member_id || selectedStudent.student_id || selectedStudent.id;
      const memberRoll = selectedStudent.roll || selectedStudent.student_roll || selectedStudent.member_id_number || '-';
      
      const feeData = {
        institution_id: madrasah.id,
        member_id: memberId,
        department_id: selectedStudent.department_id,
        amount_paid: totalAmt,
        month: selectedMonth,
        status: (Number(selectedStudent.total_paid) + totalAmt + totalDiscount) >= Number(selectedStudent.total_payable) ? 'paid' : 'partial'
      };

      // Try inserting with discount first
      let { error: feeErr } = await supabase.from('fees').insert({
        ...feeData,
        discount: totalDiscount
      });
      
      // If error is about missing column, retry without discount
      if (feeErr && (feeErr.message.includes('column') || feeErr.code === '42703')) {
          const { error: retryErr } = await supabase.from('fees').insert(feeData);
          feeErr = retryErr;
      }
      
      if (feeErr) throw feeErr;

      // Add to Ledger
      const feeDescription = selectedFeeCategories.join(', ');
      const className = departments.find(c => c.id === selectedStudent.department_id)?.name || '';
      
      await supabase.from('ledger').insert({
        institution_id: madrasah.id,
        type: 'income',
        amount: totalAmt,
        category: 'Member Fee',
        description: `${feeDescription} - ${memberName} (${className} | ID: ${memberRoll} | Month: ${selectedMonth})${totalDiscount > 0 ? ` (ছাড়: ৳${totalDiscount})` : ''}`,
        transaction_date: new Date().toISOString().split('T')[0]
      });

      setShowFeeCollection(false);
      setCollectAmount('');
      setDiscount('');
      setSelectedStudent(null);
      fetchData();
    } catch (err: any) { 
      setActionError(err.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleShowHistory = async (student: any) => {
    setHistoryStudent(student);
    setShowHistoryModal(true);
    fetchStudentHistory(student.member_id || student.student_id || student.id, historyYear);
  };

  const fetchStudentHistory = async (studentId: string, year: string) => {
    const { data } = await supabase.from('fees')
      .select('*')
      .eq('member_id', studentId)
      .like('month', `${year}-%`);
    setStudentFeeHistory(data || []);
  };

  useEffect(() => {
      if (historyStudent) {
          fetchStudentHistory(historyStudent.member_id || historyStudent.student_id || historyStudent.id, historyYear);
      }
  }, [historyYear]);

  const handleDownloadClassReport = async (downloadLang: 'en' | 'bn' = lang) => {
    if (feesReport.length === 0) {
      setActionError('No data to download');
      return;
    }

    const className = departments.find(c => c.id === selectedClass)?.name || 'All Committees';

    setIsDownloading(true);
    try {
      await generateDepartmentSubscriptionReportPDF(
          className,
          selectedMonth,
          feesReport,
          { name: madrasah.name },
          downloadLang
      );
    } catch (error) {
      console.error('Download error:', error);
      setActionError('Error downloading PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadReceipt = async (student: any, downloadLang: 'en' | 'bn' = lang) => {
    const className = departments.find(c => c.id === student.department_id)?.name || '';
    setIsDownloading(true);
    try {
        await generateSubscriptionReceiptPDF(
            { ...student, name: className },
            selectedMonth,
            { name: madrasah.name, address: madrasah.address, phone: madrasah.phone },
            downloadLang
        );
    } catch (error) {
        console.error('Download error:', error);
        setActionError('Error downloading PDF');
    } finally {
        setIsDownloading(false);
    }
  };

  if (activeTab === 'fees') {
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-5 relative">
         {/* Download Indicator */}
         {isDownloading && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
                <div className={`${isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-blue-100'} backdrop-blur-md border px-6 py-3 rounded-full shadow-2xl flex items-center gap-3`}>
                    <div className="relative">
                        <Loader2 className={`animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} size={20} />
                        <div className={`absolute inset-0 blur-sm rounded-full animate-pulse ${isDark ? 'bg-blue-500/20' : 'bg-blue-400/20'}`}></div>
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>ডাউনলোড হচ্ছে...</span>
                </div>
            </div>
         )}

         <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-[2rem] border shadow-bubble space-y-4`}>
            <div className="flex flex-wrap gap-3 items-center justify-between">
               {/* Department Selector */}
               <div className="relative flex-1 min-w-[140px]">
                  <button onClick={() => setShowClassDropdown(!showClassDropdown)} className={`w-full h-11 px-4 rounded-xl border flex items-center justify-between group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                     <span className={`text-[11px] font-black truncate ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{departments.find(c => c.id === selectedClass)?.name || 'সব কমিটি'}</span>
                     <ChevronDown size={16} className={`transition-colors ${isDark ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-[#2563EB]'}`} />
                  </button>
                  {showClassDropdown && (
                      <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl border z-50 p-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                          <button onClick={() => { setSelectedClass(''); setShowClassDropdown(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-600 hover:bg-slate-50 hover:text-[#2563EB]'}`}>সব কমিটি</button>
                          {departments.map(c => (
                              <button key={c.id} onClick={() => { setSelectedClass(c.id); setShowClassDropdown(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-black transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-600 hover:bg-slate-50 hover:text-[#2563EB]'}`}>{c.name}</button>
                          ))}
                      </div>
                  )}
               </div>

               {/* Month Selector */}
               <div className="relative flex-1 min-w-[140px]">
                  <input type="month" className={`w-full h-11 px-4 border rounded-xl text-[11px] font-black outline-none transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
               </div>

               {/* Status Filter */}
               <div className="relative flex-1 min-w-[140px]">
                   <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className={`w-full h-11 px-4 border rounded-xl text-[11px] font-black outline-none appearance-none transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/30'}`}
                  >
                      <option value="all">সব স্ট্যাটাস</option>
                      <option value="paid">পরিশোধিত (Paid)</option>
                      <option value="partial">আংশিক (Partial)</option>
                      <option value="unpaid">বকেয়া (Unpaid)</option>
                  </select>
                  <ChevronDown className={`absolute right-3 top-3.5 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={16}/>
               </div>

               {/* Download Report Button */}
               <button 
                  onClick={() => {
                      setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadClassReport(l));
                      setShowDownloadLangModal(true);
                  }}
                  disabled={feesReport.length === 0}
                  className="h-11 px-6 bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none"
               >
                  <Download size={16} />
                  রিপোর্ট ডাউনলোড
               </button>
            </div>
         </div>

         {fetchError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold shadow-sm">
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">স্কিমা এরর!</p>
                  <p className="opacity-70">{fetchError}</p>
                  <p className="mt-1 font-normal opacity-60">সমাধান: SQL এডিটর থেকে নতুন প্রোভাইড করা কোডটি রান করুন।</p>
               </div>
               <button onClick={() => fetchData()} className="bg-white px-3 py-1.5 rounded-lg border border-red-200 text-red-600 active:scale-95"><RefreshCw size={14}/></button>
            </div>
         )}

         {actionError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold shadow-sm mb-4">
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">ত্রুটি!</p>
                  <p className="opacity-70">{actionError}</p>
               </div>
               <button onClick={() => setActionError(null)} className="bg-white p-1.5 rounded-lg border border-red-200 text-red-600 active:scale-95"><X size={14}/></button>
            </div>
         )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading ? (
              <div className={`flex flex-col items-center justify-center py-16 col-span-full ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest">ডাটা লোড হচ্ছে...</p>
              </div>
            ) : feesReport.length > 0 ? (
                feesReport.filter((item: any) => {
                    const isFullyPaid = Number(item.balance_due) <= 0 && Number(item.total_payable) > 0;
                    const isPartial = Number(item.balance_due) > 0 && Number(item.total_paid) > 0;
                    const isUnpaid = Number(item.total_paid) === 0 && Number(item.total_payable) > 0;

                    if (statusFilter === 'paid') return isFullyPaid;
                    if (statusFilter === 'partial') return isPartial;
                    if (statusFilter === 'unpaid') return isUnpaid;
                    return true;
                }).map((item: any) => {
                  const balance = Number(item.balance_due) || 0;
                  const payable = Number(item.total_payable) || 0;
                  const paid = Number(item.total_paid) || 0;

                  const isFullyPaid = balance <= 0 && payable > 0;
                  const isNoFeeSet = payable === 0;
                  const hasBalance = balance > 0;

                  return (
                  <div key={item.member_id} className={`p-4 rounded-[1.8rem] border shadow-bubble flex items-center justify-between gap-3 group active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                     <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center font-black text-base shrink-0 overflow-hidden ${isFullyPaid ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500') : hasBalance ? (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-500') : (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-[#2563EB]')}`}>
                           {item.name?.trim()?.charAt(0) || '#'}
                        </div>
                        <div className="min-w-0 flex-1">
                           <h5 
                             className={`font-black font-noto break-words whitespace-normal leading-snug mb-1 cursor-pointer hover:underline decoration-2 underline-offset-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}
                             onClick={() => onStudentClick ? onStudentClick(item) : handleShowHistory(item)}
                           >
                             {item.name}
                           </h5>
                           <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {item.roll && item.roll !== '-' && (
                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black break-all ${isDark ? 'bg-slate-900 text-[#42f5e9]' : 'bg-[#42f5e9]/15 text-[#0e8a84]'}`}>
                                  #{item.roll}
                                </span>
                              )}
                              <p className="text-[10px] text-slate-400 font-bold uppercase">জমা: ৳{paid}</p>
                              <p className="text-[10px] text-red-400 font-bold uppercase">বকেয়া: ৳{Math.max(0, balance)}</p>
                              {isNoFeeSet && <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>No Subscription Set</span>}
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                       <button 
                          onClick={() => {
                              setDownloadAction(() => (l: 'en' | 'bn') => handleDownloadReceipt(item, l));
                              setShowDownloadLangModal(true);
                          }}
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border shadow-sm transition-all ${isDark ? 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-blue-400' : 'bg-white text-slate-400 border-slate-100 hover:bg-blue-50 hover:text-[#2563EB] hover:border-blue-100'} active:scale-95`}
                          title="Download Receipt"
                       >
                          <Download size={18} />
                       </button>
                       <button 
                          onClick={() => { setSelectedStudent(item); setCollectAmount(''); setShowFeeCollection(true); }} 
                          disabled={isFullyPaid || isNoFeeSet} 
                          className={`px-4 sm:px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${isFullyPaid ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-600 border border-emerald-200') : isNoFeeSet ? (isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed') : hasBalance ? 'bg-orange-500 text-white active:scale-95 shadow-orange-200' : 'bg-[#2563EB] text-white active:scale-95'}`}
                       >
                          {isFullyPaid ? 'PAID' : 'চাঁদা জমা নিন'}
                       </button>
                     </div>
                  </div>
                )})
            ) : !fetchError && (
              <div className={`text-center py-16 rounded-[3rem] border-2 border-dashed mx-2 px-6 flex flex-col items-center col-span-full ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-blue-50 text-blue-200'}`}>
                    {anyStudentsInMadrasah ? <Info size={32} /> : <Users size={32} />}
                 </div>
                 <h3 className={`text-lg font-black font-noto leading-tight ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>
                   {anyStudentsInMadrasah ? 'রিপোর্ট পাওয়া যায়নি' : 'কোনো সদস্য পাওয়া যায়নি'}
                 </h3>
                 <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-wide leading-relaxed">
                   {anyStudentsInMadrasah 
                      ? 'আপনার ডাটাবেসে সদস্য আছে, কিন্তু তারা সম্ভবত সঠিক কমিটিতে নিবন্ধিত নয় অথবা ডাটাবেস ফাংশনে সমস্যা হচ্ছে।'
                      : 'এই সংগঠনের অধীনে কোনো সদস্য নিবন্ধিত নেই। অনুগ্রহ করে সদস্য যোগ করুন।'}
                 </p>
              </div>
            )}
          </div>

         {/* COLLECT FEE MODAL */}
         {/* Modals */}
      {showDownloadLangModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1001] flex items-center justify-center p-3 sm:p-4">
              <div className={`rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl border animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-white/20'}`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                      <Download size={32} strokeWidth={2.5} />
                  </div>
                  
                  <h3 className={`text-xl font-black mb-2 text-center font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>ভাষা নির্বাচন করুন</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-8 tracking-widest">Select PDF Language</p>
                  
                  <div className="space-y-3">
                      <button 
                          onClick={async () => {
                              if (downloadAction) {
                                  setShowDownloadLangModal(false);
                                  await downloadAction('bn');
                              }
                          }}
                          className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      >
                          <span className="text-sm">বাংলা (Bengali)</span>
                      </button>
                      
                      <button 
                          onClick={async () => {
                              if (downloadAction) {
                                  setShowDownloadLangModal(false);
                                  await downloadAction('en');
                              }
                          }}
                          className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      >
                          <span className="text-sm">English</span>
                      </button>
                      
                      <button 
                          onClick={() => setShowDownloadLangModal(false)}
                          className={`w-full py-4 rounded-2xl active:scale-[0.98] transition-all mt-4 font-black ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                          বাতিল (Cancel)
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showFeeCollection && selectedStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-4 sm:p-6">
                <div className={`w-full max-w-sm rounded-[1.8rem] sm:rounded-[3rem] p-5 sm:p-8 space-y-4 sm:space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[92vh] sm:max-h-[80vh] shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                    <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>সাবস্ক্রিপশন সংগ্রহ করুন</h3>
                        <button onClick={() => setShowFeeCollection(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
                    </div>
                    <div className={`p-6 rounded-3xl border text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">সদস্যের নাম</p>
                        <h4 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{selectedStudent.name}</h4>
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className={`p-2.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                              <p className="text-[7px] font-black text-slate-400 uppercase"> প্রদেয় </p>
                              <p className={`font-black text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>৳{selectedStudent.total_payable}</p>
                            </div>
                            <div className={`p-2.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                              <p className="text-[7px] font-black text-slate-400 uppercase"> পরিশোধিত </p>
                              <p className={`font-black text-sm ${isDark ? 'text-emerald-400' : 'text-green-600'}`}>৳{selectedStudent.total_paid}</p>
                            </div>
                            <div className={`p-2.5 rounded-2xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                              <p className="text-[7px] font-black text-slate-400 uppercase"> বকেয়া </p>
                              <p className={`font-black text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>৳{Math.max(0, Number(selectedStudent.balance_due))}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">চাঁদার ধরণ (Contribution Type)</label>
                            <div className={`rounded-2xl p-4 border max-h-40 overflow-y-auto ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="space-y-2">
                                    {availableFeeItems.length > 0 ? (
                                        availableFeeItems.map(item => {
                                            const isPaid = paidFeeCategories.includes(item.fee_name);
                                            const isSelected = selectedFeeCategories.includes(item.fee_name);
                                            
                                            return (
                                                <div key={item.id} className={`flex flex-col gap-2 p-3 rounded-xl transition-colors ${isPaid ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-100')}`}>
                                                    <label className={`flex items-center gap-3 cursor-pointer`}>
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected || isPaid ? 'bg-[#2563EB] border-[#2563EB]' : (isDark ? 'border-slate-600' : 'border-slate-300')} ${isPaid ? 'opacity-50' : ''}`}>
                                                            {(isSelected || isPaid) && <CheckCircle2 size={14} className="text-white" />}
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden"
                                                            checked={isSelected || isPaid}
                                                            disabled={isPaid}
                                                            onChange={(e) => {
                                                                if (isPaid) return;
                                                                let newCategories = [];
                                                                if (e.target.checked) {
                                                                    newCategories = [...selectedFeeCategories, item.fee_name];
                                                                } else {
                                                                    newCategories = selectedFeeCategories.filter(c => c !== item.fee_name);
                                                                }
                                                                setSelectedFeeCategories(newCategories);
                                                                setCollectAmount(calculateTotal(newCategories, discount, availableFeeItems));
                                                            }}
                                                        />
                                                        <div className="flex-1 flex justify-between items-center">
                                                            <span className={`text-xs font-black ${isPaid ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-200' : 'text-[#1E3A8A]')}`}>
                                                                {item.fee_name} {isPaid && '(পরিশোধিত)'}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'text-slate-400 bg-slate-800' : 'text-slate-400 bg-slate-100'}`}>৳{item.amount}</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-4 text-slate-400 text-xs font-bold">কোনো চাঁদার ধরণ পাওয়া যায়নি। দয়া করে চাঁদা সেটিংস থেকে ধরণ যোগ করুন।</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">জমা টাকার পরিমাণ</label>
                            <div className="relative">
                              <input type="number" className={`w-full h-14 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-blue-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-[#2563EB]/20'}`} placeholder="0.00" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
                              <DollarSign className={`absolute left-4 top-4 ${isDark ? 'text-blue-400' : 'text-[#2563EB]'}`} size={20}/>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ছাড় / ডিসকাউন্ট (যদি থাকে)</label>
                            <div className="relative">
                              <input type="number" className={`w-full h-14 rounded-2xl px-12 font-black text-lg outline-none border-2 border-transparent transition-all ${isDark ? 'bg-slate-800 text-slate-100 focus:border-orange-500/20' : 'bg-slate-50 text-[#1E293B] focus:border-orange-500/20'}`} placeholder="0.00" value={discount} onChange={(e) => {
                                  setDiscount(e.target.value);
                                  setCollectAmount(calculateTotal(selectedFeeCategories, e.target.value, availableFeeItems));
                              }} />
                              <Tag className="absolute left-4 top-4 text-orange-500" size={20}/>
                            </div>
                        </div>
                        <button onClick={handleCollectFee} disabled={isSaving || !collectAmount} className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                            {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20}/> পেমেন্ট নিশ্চিত করুন</>}
                        </button>
                    </div>
                </div>
            </div>
         )}

         {/* HISTORY MODAL */}
         {showHistoryModal && historyStudent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-4 sm:p-6">
                <div className={`w-full max-w-2xl rounded-[1.8rem] sm:rounded-[3rem] p-5 sm:p-8 space-y-4 sm:space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[92vh] sm:max-h-[90vh] shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                    <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>সাবস্ক্রিপশন হিস্ট্রি</h3>
                        <button onClick={() => setShowHistoryModal(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
                    </div>
                    
                    <div className={`flex items-center justify-between p-4 rounded-3xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">সদস্যের নাম</p>
                            <h4 className={`text-lg font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{historyStudent.name}</h4>
                        </div>
                        <div className="w-32">
                            <select 
                                value={historyYear}
                                onChange={(e) => setHistoryYear(e.target.value)}
                                className={`w-full h-10 px-3 border rounded-xl text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-[#1E3A8A]'}`}
                            >
                                {[0, 1, 2].map(offset => {
                                    const year = (new Date().getFullYear() - offset).toString();
                                    return <option key={year} value={year}>{year}</option>;
                                })}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {Array.from({ length: 12 }, (_, i) => {
                            const monthStr = `${historyYear}-${String(i + 1).padStart(2, '0')}`;
                            const monthName = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][i];
                            
                            const recordsForMonth = studentFeeHistory.filter(f => f.month === monthStr);
                            let status = 'unpaid';
                            let totalPaid = 0;
                            
                            const studentFeeStructures = availableFeeItems.filter(fs => fs.department_id === historyStudent.department_id || fs.department_id === null);
                            const totalPayable = studentFeeStructures.reduce((sum, fs) => sum + Number(fs.amount), 0);

                            if (recordsForMonth.length > 0) {
                                totalPaid = recordsForMonth.reduce((sum, r) => sum + (Number(r.amount_paid) || 0) + (Number(r.discount) || 0), 0);
                                if (totalPaid >= totalPayable && totalPayable > 0) status = 'paid';
                                else if (totalPaid > 0) status = 'partial';
                                else status = 'unpaid';
                            }

                            return (
                                <div key={monthStr} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${status === 'paid' ? (isDark ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-100') : status === 'partial' ? (isDark ? 'bg-orange-500/20 border-orange-500/30' : 'bg-orange-50 border-orange-100') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                                    <span className={`text-sm font-black ${status === 'paid' ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : status === 'partial' ? (isDark ? 'text-orange-400' : 'text-orange-700') : 'text-slate-500'}`}>
                                        {monthName}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${status === 'paid' ? (isDark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-200 text-emerald-800') : status === 'partial' ? (isDark ? 'bg-orange-500/30 text-orange-300' : 'bg-orange-200 text-orange-800') : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600')}`}>
                                        {status === 'paid' ? 'পরিশোধিত' : status === 'partial' ? 'আংশিক' : 'বকেয়া'}
                                    </span>
                                    {totalPaid > 0 && (
                                        <span className={`text-xs font-bold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>৳{totalPaid}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
         )}
      </div>
    );
  }

  if (activeTab === 'structures') {
    const groupedStructures = structures.reduce((acc: Record<string, any[]>, s: any) => {
      const className = s.departments?.name || (lang === 'bn' ? 'সব কমিটি (সকল সদস্য)' : 'All Committees');
      if (!acc[className]) acc[className] = [];
      acc[className].push(s);
      return acc;
    }, {});

    const selectedCategoryObj = feeCategories.find(c => c.id === structureCategoryId);

    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-5">
         {actionError && (
            <div className={`p-4 border rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm mb-4 ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
               <div className="bg-red-500 text-white p-2 rounded-xl">
                  <AlertCircle size={20} />
               </div>
               <div className="flex-1">
                  <p className="font-black">{lang === 'bn' ? 'ত্রুটি!' : 'Error!'}</p>
                  <p className="opacity-70">{actionError}</p>
               </div>
               <button onClick={() => setActionError(null)} className={`p-1.5 rounded-lg border active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-red-200 text-red-600'}`}><X size={14}/></button>
            </div>
         )}

         <div className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border shadow-bubble ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h3 className={`text-lg font-black font-noto ${isDark ? 'text-slate-100' : 'text-[#0fb5ab]'}`}>
                      {lang === 'bn' ? 'চাঁদা ও ফি সেটিংস' : 'Subscription & Fee Settings'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {lang === 'bn' ? 'কমিটির চাঁদা, ক্যাটাগরি ও মেয়াদ নির্ধারণ করুন' : 'Configure committee fees, categories & periods'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        type="button"
                        onClick={() => {
                           setFeeCategories(getInstitutionFeeCategories(madrasah));
                           setShowCategoryModal(true);
                        }} 
                        className={`px-3.5 h-11 rounded-2xl font-black text-xs flex items-center gap-1.5 border transition-all active:scale-95 ${isDark ? 'bg-slate-900 text-[#42f5e9] border-slate-700 hover:bg-slate-700' : 'bg-[#e0fdfb] text-[#0fb5ab] border-[#42f5e9]/40 hover:bg-[#42f5e9]/20'}`}
                    >
                        <Layers size={16} />
                        <span className="font-noto">{lang === 'bn' ? 'ক্যাটাগরি সেটিংস' : 'Categories'}</span>
                    </button>
                    <button 
                        type="button"
                        onClick={openAddStructureModal} 
                        className="h-11 px-4 bg-[#0fb5ab] hover:bg-[#0d9c93] text-white rounded-2xl flex items-center gap-1.5 shadow-lg shadow-[#0fb5ab]/25 active:scale-95 transition-all text-xs font-black font-noto"
                    >
                        <Plus size={18} strokeWidth={3} />
                        <span>{lang === 'bn' ? 'নতুন চাঁদা/ফি' : 'Add Fee'}</span>
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {structures.length > 0 ? (
                    (Object.entries(groupedStructures) as [string, any[]][]).map(([className, items]) => (
                        <div key={className} className="space-y-2.5">
                            <div className="flex items-center gap-2 px-2">
                                <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}></div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-900 text-[#42f5e9]' : 'bg-[#e0fdfb] text-[#0fb5ab]'}`}>{className}</span>
                                <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}></div>
                            </div>
                            <div className="grid grid-cols-1 gap-2.5">
                                 {items.map((s: any) => {
                                     const catObj = getCategoryForStructure(s, feeCategories, madrasah);
                                     const catColor = CATEGORY_COLOR_CLASSES[catObj.color || 'blue'];
                                     const freqInfo = FREQUENCY_LABELS[catObj.frequency] || FREQUENCY_LABELS.custom;
                                     const range = getStructureDateRange(s, madrasah);
                                     const hasDates = Boolean(range.start_date || range.due_date);

                                     return (
                                     <div key={s.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all ${isDark ? 'bg-slate-900/60 border-slate-700 hover:bg-slate-900' : 'bg-slate-50/60 border-slate-100 hover:bg-white hover:shadow-sm'}`}>
                                         <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-white text-[#0fb5ab] border border-[#0fb5ab]/15'}`}>
                                                 <Tag size={18} />
                                             </div>
                                             <div className="min-w-0 flex-1">
                                                 <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                     <h5 className={`font-black font-noto text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{s.fee_name}</h5>
                                                     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border font-noto ${isDark ? `${catColor.darkBg} ${catColor.darkText} ${catColor.darkBorder}` : `${catColor.bg} ${catColor.text} ${catColor.border}`}`}>
                                                         {catObj.name}
                                                     </span>
                                                     <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200/70 text-slate-600'}`}>
                                                         {lang === 'bn' ? freqInfo.badgeBn : freqInfo.en}
                                                     </span>
                                                 </div>
                                                 <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                                     {hasDates ? (
                                                         <span className="inline-flex items-center gap-1 text-[#0fb5ab]">
                                                             <Calendar size={11} />
                                                             {range.start_date ? formatMonthLabel(range.start_date, lang) : (lang === 'bn' ? 'শুরু' : 'Start')}
                                                             {' → '}
                                                             {range.due_date ? formatMonthLabel(range.due_date, lang) : (lang === 'bn' ? 'চলমান' : 'Ongoing')}
                                                         </span>
                                                     ) : (
                                                         <span className="inline-flex items-center gap-1">
                                                             <Calendar size={11} />
                                                             {lang === 'bn' ? 'উন্মুক্ত সময়সীমা' : 'Open period'}
                                                         </span>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 dark:border-slate-800">
                                             <div className={`text-lg font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>৳{Number(s.amount || 0).toLocaleString()}</div>
                                             {deleteConfirmId === s.id ? (
                                                 <div className="flex items-center gap-1.5">
                                                     <button onClick={async () => {
                                                         const { error } = await supabase.from('fee_structures').delete().eq('id', s.id);
                                                         if (error) {
                                                             console.error("Delete Error:", error);
                                                             setActionError("ডিলিট করতে সমস্যা হয়েছে: " + error.message);
                                                         } else {
                                                             fetchData();
                                                         }
                                                         setDeleteConfirmId(null);
                                                     }} className="bg-red-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-black">{lang === 'bn' ? 'হ্যাঁ' : 'Yes'}</button>
                                                     <button onClick={() => setDeleteConfirmId(null)} className={`text-[10px] px-2.5 py-1.5 rounded-lg font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{lang === 'bn' ? 'না' : 'No'}</button>
                                                 </div>
                                             ) : (
                                                 <div className="flex items-center gap-1.5">
                                                     <button
                                                         type="button"
                                                         onClick={() => openEditStructureModal(s)}
                                                         className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-slate-800 text-[#42f5e9] hover:bg-slate-700' : 'bg-white text-[#0fb5ab] border border-slate-200 hover:bg-[#e0fdfb]'}`}
                                                         title={lang === 'bn' ? 'এডিট' : 'Edit'}
                                                     >
                                                         <Edit3 size={14} />
                                                     </button>
                                                     <button
                                                         type="button"
                                                         onClick={() => setDeleteConfirmId(s.id)}
                                                         className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-slate-800 text-rose-400 hover:bg-rose-950/40' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}
                                                         title={lang === 'bn' ? 'ডিলিট' : 'Delete'}
                                                     >
                                                         <Trash2 size={14} />
                                                     </button>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 );})}
                             </div>
                         </div>
                     ))
                 ) : (
                     <div className={`text-center py-12 rounded-3xl border-2 border-dashed ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-white text-slate-300'}`}>
                             <Tag size={24} />
                         </div>
                         <p className="text-slate-400 uppercase text-[10px] font-black">{lang === 'bn' ? 'কোনো চাঁদার ধরণ সেট করা নেই' : 'No fee structures found'}</p>
                     </div>
                 )}
             </div>
          </div>

          <FeeCategoryManagerModal
             isOpen={showCategoryModal}
             onClose={() => setShowCategoryModal(false)}
             madrasah={madrasah}
             lang={lang}
             categories={feeCategories}
             onCategoriesUpdated={(updated) => {
               setFeeCategories(updated);
               if (!updated.some(c => c.id === structureCategoryId) && updated[0]) {
                 setStructureCategoryId(updated[0].id);
               }
             }}
          />

          {/* ADD / EDIT STRUCTURE MODAL */}
          {showAddStructure && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[999] flex items-center justify-center p-4 sm:p-6">
               <div className={`w-full max-w-md rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 space-y-5 animate-in zoom-in-95 shadow-2xl relative max-h-[92vh] overflow-y-auto ${isDark ? 'bg-slate-900 text-white border border-slate-800' : 'bg-white text-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#e0fdfb] text-[#0fb5ab]'}`}>
                        <Tag size={18} />
                      </div>
                      <div>
                        <h3 className={`text-lg font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                          {editingStructure
                            ? (lang === 'bn' ? 'চাঁদা / ফি এডিট করুন' : 'Edit Fee Structure')
                            : (lang === 'bn' ? 'নতুন চাঁদা / ফি যোগ করুন' : 'Add Fee Structure')}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {lang === 'bn' ? 'কমিটি, ক্যাটাগরি ও মেয়াদ নির্ধারণ' : 'Set committee, category & duration'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setShowAddStructure(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-700'}`}><X size={20} /></button>
                  </div>

                  <div className="space-y-4">
                     {/* Department Selector */}
                     <div className="relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5 block">
                          {lang === 'bn' ? 'কমিটি / বিভাগ (ঐচ্ছিক)' : 'Committee / Department (Optional)'}
                        </label>
                        <button
                          type="button"
                          onClick={() => { setShowStructureDeptDropdown(!showStructureDeptDropdown); setShowStructureCategoryDropdown(false); }}
                          className={`w-full h-12 px-4 rounded-xl border font-bold text-xs flex items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                        >
                           <span className="truncate">{departments.find(c => c.id === structureDeptId)?.name || (lang === 'bn' ? 'সব কমিটি (All Committees)' : 'All Committees')}</span>
                           <ChevronDown size={16} className="text-slate-400 shrink-0" />
                        </button>
                        {showStructureDeptDropdown && (
                            <div className={`absolute top-full left-0 right-0 mt-1.5 rounded-2xl shadow-2xl border z-[1005] p-1.5 max-h-48 overflow-y-auto ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                <button type="button" onClick={() => { setStructureDeptId(''); setShowStructureDeptDropdown(false); }} className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold ${isDark ? 'hover:bg-slate-700 text-slate-100' : 'hover:bg-slate-50 text-slate-800'}`}>
                                  {lang === 'bn' ? 'সব কমিটি (All Committees)' : 'All Committees'}
                                </button>
                                {departments.map(c => (
                                    <button type="button" key={c.id} onClick={() => { setStructureDeptId(c.id); setShowStructureDeptDropdown(false); }} className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold ${isDark ? 'hover:bg-slate-700 text-slate-100' : 'hover:bg-slate-50 text-slate-800'}`}>{c.name}</button>
                                ))}
                            </div>
                        )}
                     </div>

                     {/* Category Selector */}
                     <div className="relative">
                        <div className="flex items-center justify-between px-1 mb-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {lang === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category'} *
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowCategoryModal(true)}
                            className="text-[10px] font-black text-[#0fb5ab] hover:underline flex items-center gap-1"
                          >
                            <Plus size={11} />
                            <span>{lang === 'bn' ? 'নতুন ক্যাটাগরি যোগ' : 'Add Category'}</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowStructureCategoryDropdown(prev => !prev); setShowStructureDeptDropdown(false); }}
                          className={`w-full h-12 px-4 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                        >
                           <div className="flex items-center gap-2 min-w-0">
                              <Tag size={15} className="text-[#0fb5ab] shrink-0" />
                              <span className="truncate font-noto">{selectedCategoryObj?.name || (lang === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category')}</span>
                              {selectedCategoryObj && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                  {lang === 'bn' ? FREQUENCY_LABELS[selectedCategoryObj.frequency]?.badgeBn : FREQUENCY_LABELS[selectedCategoryObj.frequency]?.en}
                                </span>
                              )}
                           </div>
                           <ChevronDown size={16} className={`transition-transform shrink-0 text-slate-400 ${showStructureCategoryDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showStructureCategoryDropdown && (
                          <div className={`absolute top-full left-0 right-0 mt-1.5 rounded-2xl shadow-2xl border z-[1005] p-1.5 max-h-56 overflow-y-auto ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                             {feeCategories.map(cat => {
                               const isSelected = structureCategoryId === cat.id;
                               const freq = FREQUENCY_LABELS[cat.frequency];
                               return (
                                 <button
                                   type="button"
                                   key={cat.id}
                                   onClick={() => { setStructureCategoryId(cat.id); setShowStructureCategoryDropdown(false); }}
                                   className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${isSelected ? (isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#e0fdfb] text-[#0fb5ab]') : (isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-50 text-slate-700')}`}
                                 >
                                   <span className="font-noto">{cat.name}</span>
                                   <div className="flex items-center gap-2">
                                     <span className="text-[10px] opacity-70">{lang === 'bn' ? freq?.badgeBn : freq?.en}</span>
                                     {isSelected && <CheckCircle2 size={14} />}
                                   </div>
                                 </button>
                               );
                             })}
                             <div className={`mt-1.5 pt-1.5 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                               <button
                                 type="button"
                                 onClick={() => { setShowStructureCategoryDropdown(false); setShowCategoryModal(true); }}
                                 className="w-full px-3.5 py-2 rounded-xl text-xs font-black text-[#0fb5ab] hover:bg-[#0fb5ab]/10 flex items-center justify-center gap-1.5"
                               >
                                 <Settings size={14} />
                                 <span>{lang === 'bn' ? 'ক্যাটাগরি ম্যানেজ / নতুন যোগ' : 'Manage Categories'}</span>
                               </button>
                             </div>
                          </div>
                        )}
                     </div>

                     {/* Amount */}
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5 block">
                          {lang === 'bn' ? 'টাকার পরিমাণ (৳)' : 'Amount (৳)'}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`w-full h-12 rounded-xl pl-10 pr-4 font-black text-base outline-none border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-[#42f5e9]' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#0fb5ab]'}`}
                            placeholder="0"
                            value={structureAmount}
                            onChange={(e) => setStructureAmount(convertBnToEnNumberString(e.target.value))}
                          />
                          <DollarSign className="absolute left-3.5 top-3.5 text-[#0fb5ab]" size={18} />
                        </div>
                     </div>

                     {/* Month Range Toggle & Picker */}
                     <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/80 border-slate-200/80'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`text-xs font-black font-noto block ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                              {lang === 'bn' ? 'নির্দিষ্ট মাস / মেয়াদ নির্ধারণ' : 'Specify Month / Period Range'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {useStructureDateRange
                                ? (lang === 'bn' ? 'শুরু ও শেষের মাস বেছে নিন' : 'Pick start and end months')
                                : (lang === 'bn' ? 'সব মাসের জন্য প্রযোজ্য' : 'Applies across all months')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUseStructureDateRange(!useStructureDateRange)}
                            className={`w-12 h-6 rounded-full p-0.5 transition-colors flex items-center ${useStructureDateRange ? 'bg-[#0fb5ab] justify-end' : (isDark ? 'bg-slate-700 justify-start' : 'bg-slate-300 justify-start')}`}
                          >
                            <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                          </button>
                        </div>

                        {useStructureDateRange && (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">
                                  {lang === 'bn' ? 'শুরুর মাস' : 'Start Month'}
                                </label>
                                <input
                                  type="month"
                                  value={structureStartMonth}
                                  onChange={(e) => setStructureStartMonth(e.target.value)}
                                  className={`w-full h-10 rounded-xl px-3 font-bold text-xs outline-none border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">
                                  {lang === 'bn' ? 'শেষের মাস' : 'End Month'}
                                </label>
                                <input
                                  type="month"
                                  value={structureEndMonth}
                                  onChange={(e) => setStructureEndMonth(e.target.value)}
                                  className={`w-full h-10 rounded-xl px-3 font-bold text-xs outline-none border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const y = new Date().getFullYear();
                                  setStructureStartMonth(`${y}-01`);
                                  setStructureEndMonth(`${y}-12`);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-colors ${isDark ? 'bg-slate-900 border-slate-700 text-[#42f5e9] hover:bg-slate-700' : 'bg-white border-slate-200 text-[#0fb5ab] hover:bg-[#e0fdfb]'}`}
                              >
                                {lang === 'bn' ? 'পুরো বছর (জানু - ডিসে)' : 'Full Year (Jan - Dec)'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const now = new Date();
                                  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                  setStructureStartMonth(ym);
                                  setStructureEndMonth(`${now.getFullYear()}-12`);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-colors ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                              >
                                {lang === 'bn' ? 'চলতি মাস থেকে' : 'From Current Month'}
                              </button>
                            </div>
                          </div>
                        )}
                     </div>

                     <button
                        type="button"
                        onClick={handleSaveStructure}
                        disabled={isSaving || !structureCategoryId}
                        className="w-full py-4 bg-gradient-to-r from-[#0fb5ab] to-[#0d948b] text-white font-black rounded-2xl shadow-lg shadow-[#0fb5ab]/25 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : (editingStructure ? (lang === 'bn' ? 'আপডেট করুন' : 'Update') : (lang === 'bn' ? 'সেভ করুন' : 'Save'))}
                     </button>
                  </div>
               </div>
            </div>
          )}
       </div>
    );
  }

  return null;
};
