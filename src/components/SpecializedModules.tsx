import React, { useState, useEffect } from 'react';
import { Institution, Language, Profile } from 'types';
import { supabase } from 'supabase';
import { 
  PiggyBank, Landmark, Users, Briefcase, Award, Heart, Clipboard, HelpCircle, 
  MapPin, Shield, CheckCircle2, AlertCircle, Calendar, Plus, Trash2, Edit2, 
  Search, Save, X, ChevronRight, FileText, Smartphone, DollarSign, Vote, 
  Building2, GraduationCap, Gift, Loader2, Play, Check, Send
} from 'lucide-react';

interface SpecializedModulesProps {
  lang: Language;
  madrasah: Institution | null;
  profile?: Profile | null;
  onBack: () => void;
  initialTab?: string;
}

export const SpecializedModules: React.FC<SpecializedModulesProps> = ({ lang, madrasah, profile, onBack, initialTab }) => {
  const isDark = madrasah?.theme === 'dark';
  const instType = madrasah?.institution_type || 'committee';
  const availableSubmodules = React.useMemo(() => {
    if (!madrasah) return [];

    // For association (Samity) type, we explicitly remove other features and ONLY show qard_hasan module directly
    if (madrasah?.institution_type === 'association') {
      return ['qard_hasan'];
    }

    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    const mods = (config && typeof config === 'object') ? (config.modules || {}) : {};
    return Object.entries(mods)
      .filter(([key, value]) => value === true && ![
        'departments', 'attendance', 'meetings', 'minutes', 'events', 
        'accounting', 'voice_broadcast', 'sms', 'results', 'polls', 'notices',
        'admit_card', 'seat_plan', 'subscriptions'
      ].includes(key))
      .map(([key]) => key);
  }, [madrasah]);

  const [activeSubTab, setActiveSubTab] = useState<string>(initialTab || '');

  // Auto-select first available specialized submodule
  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    } else if (availableSubmodules.length > 0 && !activeSubTab) {
      setActiveSubTab(availableSubmodules[0]);
    }
  }, [availableSubmodules, activeSubTab, initialTab]);

  // Unified dynamic mock-backed state with cloud syncing / local fallback
  const getStoredData = (key: string, defaultValue: any) => {
    if (!madrasah?.id) return defaultValue;
    const stored = localStorage.getItem(`special_${key}_${madrasah.id}`);
    return stored ? JSON.parse(stored) : defaultValue;
  };

  const setStoredData = (key: string, data: any) => {
    if (!madrasah?.id) return;
    localStorage.setItem(`special_${key}_${madrasah.id}`, JSON.stringify(data));
  };

  // --- 1. Association State (Savings, Loans, EMIs) ---
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>(() => getStoredData('savings', [
    { id: '1', name: 'মোঃ আব্দুর রহমান', accNo: 'SAV-101', balance: 5400, phone: '01711112222', monthlyGoal: 500 },
    { id: '2', name: 'আলমগীর হোসেন', accNo: 'SAV-102', balance: 12500, phone: '01822223333', monthlyGoal: 1000 }
  ]));
  const [loans, setLoans] = useState<any[]>(() => getStoredData('loans', [
    { id: '1', name: 'মোঃ কবির মিয়া', amount: 30000, interestRate: 0, type: 'Qard Hasan', status: 'approved', paid: 15000, duration: 12, installmentAmount: 2500, nextDueDate: '2026-08-01' },
    { id: '2', name: 'মোঃ আব্দুল বাতেন', amount: 50000, interestRate: 8, type: 'Murabaha', status: 'approved', paid: 10000, duration: 10, installmentAmount: 5400, nextDueDate: '2026-08-05' }
  ]));

  // --- 2. Organization / NGO / Foundation / Volunteers State ---
  const [volunteers, setVolunteers] = useState<any[]>(() => getStoredData('volunteers', [
    { id: '1', name: 'হাসান মাহমুদ', designation: 'রিলিফ কো-অর্ডিনেটর', phone: '01912345678', area: 'ঢাকা', status: 'Active' },
    { id: '2', name: 'সায়েদ আনোয়ার', designation: 'মেডিকেল ভলান্টিয়ার', phone: '01511223344', area: 'সিলেট', status: 'Active' }
  ]));
  const [employees, setEmployees] = useState<any[]>(() => getStoredData('employees', [
    { id: '1', name: 'রহমত উল্লাহ', designation: 'অফিস ম্যানেজার', phone: '01712121212', salary: 18000, joined: '2025-01-10' }
  ]));
  const [projects, setProjects] = useState<any[]>(() => getStoredData('projects', [
    { id: '1', title: 'ভূমি ক্রয় ও হাউজিং প্রজেক্ট (হালাল)', budget: 500000, spent: 380000, status: 'Ongoing' },
    { id: '2', title: 'মাদরাসা লিল্লাহ ফান্ড ও সমাজসেবা', budget: 150000, spent: 90000, status: 'Completed' }
  ]));
  const [donations, setDonations] = useState<any[]>(() => getStoredData('donations', [
    { id: '1', donor: 'হাজী মোঃ কাসেম', amount: 20000, project: 'মাদরাসা লিল্লাহ ফান্ড ও সমাজসেবা', date: '2026-07-10' }
  ]));

  // --- 3. Club / Sports State ---
  const [tournaments, setTournaments] = useState<any[]>(() => getStoredData('tournaments', [
    { id: '1', title: 'বার্ষিক ক্রীড়া ও কুইজ প্রতিযোগিতা', date: '2026-08-15', teams: 8, prize: 'ইসলামিক বই ও ট্রফি' }
  ]));

  // --- 4. Trust / Property State ---
  const [properties, setProperties] = useState<any[]>(() => getStoredData('properties', [
    { id: '1', title: 'সমিতি ও ট্রাস্ট মার্কেট ভবন', type: 'Building', value: '৮০,০০,০০০ ৳', annualRent: '৪,৮০,০০০ ৳', location: 'মিরপুর ১০' }
  ]));

  // --- 5. Council / Election / Forum State ---
  const [elections, setElections] = useState<any[]>(() => getStoredData('elections', [
    { id: '1', position: 'আমীর / সভাপতি', candidates: [{ name: 'মুফতি আব্দুর রহমান', votes: 12 }, { name: 'মাওলানা আব্দুল কাদের', votes: 8 }], status: 'Active' },
    { id: '2', position: 'সাধারণ সম্পাদক', candidates: [{ name: 'মাওলানা কামরুল হাসান', votes: 15 }, { name: 'হাফেজ তারেক রহমান', votes: 14 }], status: 'Active' }
  ]));

  const [discussions, setDiscussions] = useState<any[]>(() => getStoredData('discussions', [
    { id: '1', author: 'মুফতি আব্দুর রহমান', content: 'সমিতির উদ্যোগে একটি নতুন জমি ক্রয়ের পরিকল্পনা রয়েছে। সবাই মতামত দিন।', votes: 12, date: '2026-07-15' }
  ]));

  const [boardMembers, setBoardMembers] = useState<any[]>(() => getStoredData('board_members', [
    { id: '1', name: 'মাওলানা আব্দুল হাই', role: 'শূরা সদস্য প্রধান', eiin: '134567', phone: '01710101010' }
  ]));

  // --- 6. Islamic Profit Distribution (লভ্যাংশ বণ্টন) ---
  const [profitDistributions, setProfitDistributions] = useState<any[]>(() => getStoredData('profit_distributions', [
    { id: '1', date: '2026-06-30', totalProfit: 25000, distributedTo: 2, ratePerThousand: 1.4 }
  ]));

  // --- 7. Islamic Welfare & Zakat Fund (কল্যাণ ও যাকাত তহবিল) ---
  const [welfareRecords, setWelfareRecords] = useState<any[]>(() => getStoredData('welfare_records', [
    { id: '1', type: 'Zakat', category: 'Income', amount: 50000, donor: 'হাজী মোঃ ইউসুফ', date: '2026-07-01', description: 'যাকাত ফান্ডের এককালীন সংগ্রহ' },
    { id: '2', type: 'Sadaqah', category: 'Expense', amount: 8000, beneficiary: 'এতিম ও অসহায় পরিবার', date: '2026-07-05', description: 'অসহায়দের চিকিৎসা ও চাল সহায়তা' },
    { id: '3', type: 'Ushr', category: 'Income', amount: 12000, donor: 'কৃষক আব্দুর রহিম', date: '2026-07-10', description: 'ফসলের ওশর আদায়' }
  ]));

  // Sync to localstorage whenever state changes
  useEffect(() => { setStoredData('savings', savingsAccounts); }, [savingsAccounts]);
  useEffect(() => { setStoredData('loans', loans); }, [loans]);
  useEffect(() => { setStoredData('volunteers', volunteers); }, [volunteers]);
  useEffect(() => { setStoredData('employees', employees); }, [employees]);
  useEffect(() => { setStoredData('projects', projects); }, [projects]);
  useEffect(() => { setStoredData('donations', donations); }, [donations]);
  useEffect(() => { setStoredData('tournaments', tournaments); }, [tournaments]);
  useEffect(() => { setStoredData('properties', properties); }, [properties]);
  useEffect(() => { setStoredData('elections', elections); }, [elections]);
  useEffect(() => { setStoredData('discussions', discussions); }, [discussions]);
  useEffect(() => { setStoredData('board_members', boardMembers); }, [boardMembers]);
  useEffect(() => { setStoredData('profit_distributions', profitDistributions); }, [profitDistributions]);
  useEffect(() => { setStoredData('welfare_records', welfareRecords); }, [welfareRecords]);

  // --- 8. Qard Hasan Applications & Management (সুদবিহীন ঋণ) ---
  const [qardHasanApplications, setQardHasanApplications] = useState<any[]>(() => getStoredData('qard_hasan', [
    {
      id: 'qard-1',
      name: 'মুহাম্মদ আসাদুল্লাহ',
      phone: '01712345678',
      amount: 50000,
      installmentType: 'monthly',
      totalInstallments: 10,
      installmentAmount: 5000,
      purpose: 'ক্ষুদ্র কুটির শিল্প ব্যবসা সম্প্রসারণ',
      status: 'approved',
      guarantorName: 'মাওলানা আব্দুল হাকিম',
      guarantorPhone: '01812345679',
      verifiedBy: 'হাফেজ আবু বকর',
      verifiedChecklist: { address: true, income: true, guarantor: true },
      agreementDate: '2026-07-01',
      repayments: [
        { id: 'r-1', date: '2026-08-01', amount: 5000, receiptNo: 'RECP-201' }
      ],
      createdAt: '2026-07-01'
    },
    {
      id: 'qard-2',
      name: 'মোঃ ইব্রাহিম খলিল',
      phone: '01598765432',
      amount: 30000,
      installmentType: 'monthly',
      totalInstallments: 6,
      installmentAmount: 5000,
      purpose: 'কৃষি কাজের জন্য বীজ ও সার ক্রয়',
      status: 'verified',
      guarantorName: 'মুফতি শফিউল্লাহ',
      guarantorPhone: '01711223344',
      verifiedBy: 'হাফেজ আবু বকর',
      verifiedChecklist: { address: true, income: true, guarantor: true },
      repayments: [],
      createdAt: '2026-07-10'
    },
    {
      id: 'qard-3',
      name: 'আব্দুর রহমান',
      phone: '01311223344',
      amount: 25000,
      installmentType: 'weekly',
      totalInstallments: 25,
      installmentAmount: 1000,
      purpose: 'চিকিৎসা সেবার জন্য করজ',
      status: 'pending',
      guarantorName: 'মোঃ ইউসুফ আলী',
      guarantorPhone: '01911223344',
      verifiedBy: '',
      verifiedChecklist: { address: false, income: false, guarantor: false },
      repayments: [],
      createdAt: '2026-07-15'
    }
  ]));

  useEffect(() => { setStoredData('qard_hasan', qardHasanApplications); }, [qardHasanApplications]);

  // Qard Hasan Tab and UI states
  const [qardTab, setQardTab] = useState<'overview' | 'apply' | 'verify' | 'active' | 'repayments' | 'guarantors' | 'agreements'>('overview');
  const [qardName, setQardName] = useState('');
  const [qardPhone, setQardPhone] = useState('');
  const [qardAmount, setQardAmount] = useState('');
  const [qardPeriod, setQardPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [qardInstallments, setQardInstallments] = useState('10');
  const [qardPurpose, setQardPurpose] = useState('');
  const [qardGuarantorName, setQardGuarantorName] = useState('');
  const [qardGuarantorPhone, setQardGuarantorPhone] = useState('');
  const [qardVerificationOfficer, setQardVerificationOfficer] = useState('');

  // Repayment form state
  const [selectedQardForRepayment, setSelectedQardForRepayment] = useState<any | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayReceipt, setRepayReceipt] = useState('');

  // Active Agreement state
  const [selectedQardForAgreement, setSelectedQardForAgreement] = useState<any | null>(null);

  // Verification state
  const [selectedQardForVerification, setSelectedQardForVerification] = useState<any | null>(null);
  const [verifyAddress, setVerifyAddress] = useState(false);
  const [verifyIncome, setVerifyIncome] = useState(false);
  const [verifyGuarantor, setVerifyGuarantor] = useState(false);

  // Form handlers & temporary states
  const [showAddForm, setShowAddForm] = useState(false);
  const [savName, setSavName] = useState('');
  const [savAcc, setSavAcc] = useState('');
  const [savPhone, setSavPhone] = useState('');
  const [savGoal, setSavGoal] = useState('500');

  const [loanName, setLoanName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanRate, setLoanRate] = useState('5');
  const [loanDuration, setLoanDuration] = useState('12');
  const [loanType, setLoanType] = useState('Qard Hasan'); // Qard Hasan, Murabaha, Mudarabah

  const [profTotal, setProfTotal] = useState('');

  const [welfType, setWelfType] = useState('Zakat'); // Zakat, Sadaqah, Ushr, Fitrah, General
  const [welfCat, setWelfCat] = useState('Income'); // Income, Expense
  const [welfAmount, setWelfAmount] = useState('');
  const [welfPerson, setWelfPerson] = useState('');
  const [welfDesc, setWelfDesc] = useState('');

  const [volName, setVolName] = useState('');
  const [volRole, setVolRole] = useState('');
  const [volPhone, setVolPhone] = useState('');
  const [volArea, setVolArea] = useState('');

  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empSalary, setEmpSalary] = useState('');

  const [projTitle, setProjTitle] = useState('');
  const [projBudget, setProjBudget] = useState('');

  const [donDonor, setDonDonor] = useState('');
  const [donAmount, setDonAmount] = useState('');
  const [donProj, setDonProj] = useState('');

  const [propTitle, setPropTitle] = useState('');
  const [propType, setPropType] = useState('Building');
  const [propValue, setPropValue] = useState('');
  const [propRent, setPropRent] = useState('');
  const [propLoc, setPropLoc] = useState('');

  const [discContent, setDiscContent] = useState('');
  const [votePosition, setVotePosition] = useState('');
  const [voteCandidates, setVoteCandidates] = useState('');

  const handleAddSavings = () => {
    if (!savName.trim() || !savAcc.trim()) return;
    const next = [...savingsAccounts, {
      id: Date.now().toString(),
      name: savName.trim(),
      accNo: savAcc.trim(),
      phone: savPhone.trim(),
      balance: 0,
      monthlyGoal: parseFloat(savGoal) || 500
    }];
    setSavingsAccounts(next);
    setSavName(''); setSavAcc(''); setSavPhone('');
    setShowAddForm(false);
  };

  const handleDepositSavings = (id: string, amount: number) => {
    const next = savingsAccounts.map(sav => {
      if (sav.id === id) {
        return { ...sav, balance: sav.balance + amount };
      }
      return sav;
    });
    setSavingsAccounts(next);
  };

  const handleAddLoan = () => {
    if (!loanName.trim() || !loanAmount.trim()) return;
    const amt = parseFloat(loanAmount);
    const months = parseInt(loanDuration) || 12;
    // For Qard Hasan, rate is always 0
    const rate = loanType === 'Qard Hasan' ? 0 : (parseFloat(loanRate) || 0);
    const installment = Math.round((amt + (amt * (rate/100))) / months);

    const next = [...loans, {
      id: Date.now().toString(),
      name: loanName.trim(),
      amount: amt,
      interestRate: rate,
      type: loanType,
      status: 'approved',
      paid: 0,
      duration: months,
      installmentAmount: installment,
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }];
    setLoans(next);
    setLoanName(''); setLoanAmount('');
    setShowAddForm(false);
  };

  const handleDistributeProfit = () => {
    if (!profTotal.trim()) return;
    const totalProfitAmount = parseFloat(profTotal);
    if (isNaN(totalProfitAmount) || totalProfitAmount <= 0) return;

    // Sum of all savings account balances
    const totalSavings = savingsAccounts.reduce((acc, curr) => acc + curr.balance, 0);
    if (totalSavings === 0) {
      alert(lang === 'bn' ? 'সঞ্চয় অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!' : 'No savings balance available to distribute profit!');
      return;
    }

    // Rate per thousand Taka
    const ratePerThousand = Math.round((totalProfitAmount / totalSavings) * 1000 * 100) / 100;

    // Distribute proportionally to each savings account
    const updatedSavings = savingsAccounts.map(sav => {
      const share = Math.round((sav.balance / totalSavings) * totalProfitAmount);
      return {
        ...sav,
        balance: sav.balance + share
      };
    });

    setSavingsAccounts(updatedSavings);

    const newDist = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      totalProfit: totalProfitAmount,
      distributedTo: savingsAccounts.length,
      ratePerThousand: ratePerThousand
    };

    setProfitDistributions([newDist, ...profitDistributions]);
    setProfTotal('');
    setShowAddForm(false);
    alert(lang === 'bn' ? `সফলভাবে ${totalProfitAmount} ৳ লভ্যাংশ সকল সঞ্চয়কারীর মাঝে বণ্টন করা হয়েছে!` : `Successfully distributed ${totalProfitAmount} BDT profit to all savers!`);
  };

  const handleAddWelfareRecord = () => {
    if (!welfAmount.trim() || !welfPerson.trim()) return;
    const amt = parseFloat(welfAmount);
    if (isNaN(amt) || amt <= 0) return;

    const next = [...welfareRecords, {
      id: Date.now().toString(),
      type: welfType, // Zakat, Sadaqah, Ushr, Fitrah, General
      category: welfCat, // Income, Expense
      amount: amt,
      donor: welfCat === 'Income' ? welfPerson.trim() : undefined,
      beneficiary: welfCat === 'Expense' ? welfPerson.trim() : undefined,
      date: new Date().toISOString().split('T')[0],
      description: welfDesc.trim() || 'কল্যাণমূলক কার্যক্রম'
    }];
    setWelfareRecords(next);
    setWelfAmount(''); setWelfPerson(''); setWelfDesc('');
    setShowAddForm(false);
  };

  const handlePayEMI = (id: string) => {
    const next = loans.map(ln => {
      if (ln.id === id) {
        const nextPaid = Math.min(ln.amount, ln.paid + ln.installmentAmount);
        return {
          ...ln,
          paid: nextPaid,
          nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      }
      return ln;
    });
    setLoans(next);
  };

  const handleAddVolunteer = () => {
    if (!volName.trim() || !volPhone.trim()) return;
    const next = [...volunteers, {
      id: Date.now().toString(),
      name: volName.trim(),
      designation: volRole.trim() || 'স্বেচ্ছাসেবক',
      phone: volPhone.trim(),
      area: volArea.trim() || 'আঞ্চলিক',
      status: 'Active'
    }];
    setVolunteers(next);
    setVolName(''); setVolRole(''); setVolPhone(''); setVolArea('');
    setShowAddForm(false);
  };

  const handleAddEmployee = () => {
    if (!empName.trim() || !empPhone.trim() || !empSalary.trim()) return;
    const next = [...employees, {
      id: Date.now().toString(),
      name: empName.trim(),
      designation: empRole.trim() || 'স্টাফ',
      phone: empPhone.trim(),
      salary: parseFloat(empSalary),
      joined: new Date().toISOString().split('T')[0]
    }];
    setEmployees(next);
    setEmpName(''); setEmpRole(''); setEmpPhone(''); setEmpSalary('');
    setShowAddForm(false);
  };

  const handleAddProject = () => {
    if (!projTitle.trim() || !projBudget.trim()) return;
    const next = [...projects, {
      id: Date.now().toString(),
      title: projTitle.trim(),
      budget: parseFloat(projBudget),
      spent: 0,
      status: 'Ongoing'
    }];
    setProjects(next);
    setProjTitle(''); setProjBudget('');
    setShowAddForm(false);
  };

  const handleAddDonation = () => {
    if (!donDonor.trim() || !donAmount.trim()) return;
    const amt = parseFloat(donAmount);
    const next = [...donations, {
      id: Date.now().toString(),
      donor: donDonor.trim(),
      amount: amt,
      project: donProj || 'সাধারণ ফান্ড',
      date: new Date().toISOString().split('T')[0]
    }];
    setDonations(next);

    // If matches any project, add to project spent/tracking dynamically!
    if (donProj) {
      setProjects(prev => prev.map(p => {
        if (p.title === donProj) {
          return { ...p, spent: Math.min(p.budget, p.spent + amt) };
        }
        return p;
      }));
    }

    setDonDonor(''); setDonAmount(''); setDonProj('');
    setShowAddForm(false);
  };

  const handleAddProperty = () => {
    if (!propTitle.trim() || !propRent.trim()) return;
    const next = [...properties, {
      id: Date.now().toString(),
      title: propTitle.trim(),
      type: propType,
      value: propValue.trim() || 'N/A',
      annualRent: propRent.trim(),
      location: propLoc.trim() || 'N/A'
    }];
    setProperties(next);
    setPropTitle(''); setPropValue(''); setPropRent(''); setPropLoc('');
    setShowAddForm(false);
  };

  const handleAddDiscussion = () => {
    if (!discContent.trim()) return;
    const next = [{
      id: Date.now().toString(),
      author: profile?.full_name || 'সদস্য',
      content: discContent.trim(),
      votes: 0,
      date: new Date().toISOString().split('T')[0]
    }, ...discussions];
    setDiscussions(next);
    setDiscContent('');
  };

  const handleVoteDiscussion = (id: string) => {
    setDiscussions(prev => prev.map(d => {
      if (d.id === id) return { ...d, votes: d.votes + 1 };
      return d;
    }));
  };

  const handleAddElection = () => {
    if (!votePosition.trim() || !voteCandidates.trim()) return;
    const candidatesList = voteCandidates.split(',').map(c => ({ name: c.trim(), votes: 0 }));
    const next = [...elections, {
      id: Date.now().toString(),
      position: votePosition.trim(),
      candidates: candidatesList,
      status: 'Active'
    }];
    setElections(next);
    setVotePosition(''); setVoteCandidates('');
    setShowAddForm(false);
  };

  const handleCastVote = (electionId: string, candidateName: string) => {
    setElections(prev => prev.map(el => {
      if (el.id === electionId) {
        return {
          ...el,
          candidates: el.candidates.map((c: any) => {
            if (c.name === candidateName) return { ...c, votes: c.votes + 1 };
            return c;
          })
        };
      }
      return el;
    }));
  };

  const handleDeleteItem = (tab: string, id: string) => {
    if (confirm(lang === 'bn' ? 'আপনি কি এটি ডিলিট করতে চান?' : 'Are you sure you want to delete?')) {
      if (tab === 'savings') setSavingsAccounts(prev => prev.filter(x => x.id !== id));
      if (tab === 'loans') setLoans(prev => prev.filter(x => x.id !== id));
      if (tab === 'qard_hasan') setQardHasanApplications(prev => prev.filter(x => x.id !== id));
      if (tab === 'volunteers') setVolunteers(prev => prev.filter(x => x.id !== id));
      if (tab === 'employees') setEmployees(prev => prev.filter(x => x.id !== id));
      if (tab === 'projects') setProjects(prev => prev.filter(x => x.id !== id));
      if (tab === 'donations') setDonations(prev => prev.filter(x => x.id !== id));
      if (tab === 'properties') setProperties(prev => prev.filter(x => x.id !== id));
      if (tab === 'elections') setElections(prev => prev.filter(x => x.id !== id));
      if (tab === 'profit_distributions') setProfitDistributions(prev => prev.filter(x => x.id !== id));
      if (tab === 'welfare_records') setWelfareRecords(prev => prev.filter(x => x.id !== id));
    }
  };

  // --- Qard Hasan Event Handlers ---
  const handleApplyQard = () => {
    if (!qardName.trim() || !qardPhone.trim() || !qardAmount.trim()) {
      alert(lang === 'bn' ? 'আবেদনকারীর নাম, মোবাইল এবং ঋণের পরিমাণ আবশ্যিক।' : 'Name, phone, and loan amount are required.');
      return;
    }
    const amt = parseFloat(qardAmount);
    const instCount = parseInt(qardInstallments) || 10;
    const instAmt = Math.round(amt / instCount);

    const newApp = {
      id: `qard-${Date.now()}`,
      name: qardName.trim(),
      phone: qardPhone.trim(),
      amount: amt,
      installmentType: qardPeriod,
      totalInstallments: instCount,
      installmentAmount: instAmt,
      purpose: qardPurpose.trim() || 'ব্যক্তিগত প্রয়োজন',
      status: 'pending',
      guarantorName: qardGuarantorName.trim(),
      guarantorPhone: qardGuarantorPhone.trim(),
      verifiedBy: '',
      verifiedChecklist: { address: false, income: false, guarantor: false },
      repayments: [],
      createdAt: new Date().toISOString().split('T')[0]
    };

    setQardHasanApplications(prev => [...prev, newApp]);
    
    // Reset Form
    setQardName('');
    setQardPhone('');
    setQardAmount('');
    setQardPurpose('');
    setQardGuarantorName('');
    setQardGuarantorPhone('');
    setQardInstallments('10');
    
    alert(lang === 'bn' ? 'করজে হাসানা আবেদন সফলভাবে সাবমিট হয়েছে।' : 'Qard Hasan application submitted successfully.');
    setQardTab('apply');
  };

  const handleStartVerification = (app: any) => {
    setSelectedQardForVerification(app);
    setVerifyAddress(app.verifiedChecklist?.address || false);
    setVerifyIncome(app.verifiedChecklist?.income || false);
    setVerifyGuarantor(app.verifiedChecklist?.guarantor || false);
    setQardVerificationOfficer(app.verifiedBy || profile?.full_name || 'মুফতি সাহেব');
  };

  const handleSaveVerification = () => {
    if (!selectedQardForVerification) return;
    
    const isAllChecked = verifyAddress && verifyIncome && verifyGuarantor;
    
    setQardHasanApplications(prev => prev.map(app => {
      if (app.id === selectedQardForVerification.id) {
        return {
          ...app,
          status: isAllChecked ? 'verified' : 'pending',
          verifiedBy: qardVerificationOfficer || 'তদন্তকারী কর্মকর্তা',
          verifiedChecklist: {
            address: verifyAddress,
            income: verifyIncome,
            guarantor: verifyGuarantor
          }
        };
      }
      return app;
    }));

    alert(lang === 'bn' ? 'যাচাইকরণ ডাটা সফলভাবে আপডেট হয়েছে।' : 'Verification updated successfully.');
    setSelectedQardForVerification(null);
  };

  const handleApproveQard = (id: string) => {
    setQardHasanApplications(prev => prev.map(app => {
      if (app.id === id) {
        return {
          ...app,
          status: 'approved',
          agreementDate: new Date().toISOString().split('T')[0]
        };
      }
      return app;
    }));
    alert(lang === 'bn' ? 'করজে হাসানা আবেদন অনুমোদন করা হয়েছে।' : 'Qard Hasan application approved successfully.');
  };

  const handleRejectQard = (id: string) => {
    if (confirm(lang === 'bn' ? 'আপনি কি এই আবেদনটি প্রত্যাখ্যান করতে চান?' : 'Are you sure you want to reject this application?')) {
      setQardHasanApplications(prev => prev.map(app => {
        if (app.id === id) {
          return {
            ...app,
            status: 'rejected'
          };
        }
        return app;
      }));
    }
  };

  const handleRecordRepayment = () => {
    if (!selectedQardForRepayment || !repayAmount.trim()) {
      alert(lang === 'bn' ? 'পরিশোধের পরিমাণ আবশ্যিক।' : 'Repayment amount is required.');
      return;
    }
    const amt = parseFloat(repayAmount);
    const receipt = repayReceipt.trim() || `RCP-${Date.now().toString().slice(-5)}`;

    setQardHasanApplications(prev => prev.map(app => {
      if (app.id === selectedQardForRepayment.id) {
        const repayments = app.repayments || [];
        return {
          ...app,
          repayments: [
            ...repayments,
            {
              id: `r-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              amount: amt,
              receiptNo: receipt
            }
          ]
        };
      }
      return app;
    }));

    setRepayAmount('');
    setRepayReceipt('');
    setSelectedQardForRepayment(null);
    alert(lang === 'bn' ? 'কিস্তি পরিশোধের রসিদ সফলভাবে এন্ট্রি হয়েছে।' : 'Repayment recorded successfully.');
  };

  const getSubTabLabel = (key: string) => {
    const mapping: Record<string, string> = {
      savings: lang === 'bn' ? 'সঞ্চয় হিসাব (সুদ-মুক্ত)' : 'Savings (Halal)',
      loans: lang === 'bn' ? 'বিনিয়োগ ও করজে হাসানা' : 'Investment & Qard',
      qard_hasan: lang === 'bn' ? 'করজে হাসানা' : 'Qard Hasan (0% Loan)',
      installments: lang === 'bn' ? 'কিস্তি আদায়' : 'Daily Collection',
      profit_distribution: lang === 'bn' ? 'লভ্যাংশ বণ্টন' : 'Profit Distribution',
      employees: lang === 'bn' ? 'কর্মকর্তা তালিকা' : 'Employees',
      volunteers: lang === 'bn' ? 'স্বেচ্ছাসেবক' : 'Volunteers',
      tasks: lang === 'bn' ? 'প্রকল্পের দায়িত্ব' : 'Task Assign',
      projects: lang === 'bn' ? 'প্রজেক্ট ও ভূমি ক্রয়' : 'Halal Projects',
      payroll: lang === 'bn' ? 'বেতন ও পে-রোল' : 'Payroll Management',
      donations: lang === 'bn' ? 'অনুদান সংগ্রহ' : 'Donations',
      beneficiaries: lang === 'bn' ? 'উপকারভোগী' : 'Beneficiaries',
      relief_mgmt: lang === 'bn' ? 'ত্রাণ ও চিকিৎসা' : 'Relief & Support',
      tournaments: lang === 'bn' ? 'খেলাধুলা ও সাংস্কৃতিক' : 'Events & Sports',
      certificates: lang === 'bn' ? 'সার্টিফিকেট' : 'Certificates',
      gallery: lang === 'bn' ? 'গ্যালারি' : 'Gallery Board',
      trustees: lang === 'bn' ? 'শূরা ও ট্রাস্টি বোর্ড' : 'Shura & Trustees',
      properties: lang === 'bn' ? 'ভূমি ও ভবন লিজ' : 'Land & Lease',
      assets: lang === 'bn' ? 'সম্পদ বিবরণী' : 'Assets Book',
      legal_documents: lang === 'bn' ? 'আইনি নথি' : 'Legal Documents',
      regional_mgmt: lang === 'bn' ? 'আঞ্চলিক শাখা' : 'Branches',
      election: lang === 'bn' ? 'নির্বাচন ও ভোট' : 'Election & Polls',
      welfare_fund: lang === 'bn' ? 'কল্যাণ ও যাকাত তহবিল' : 'Welfare & Zakat',
      legal_support: lang === 'bn' ? 'আইনি সহায়তা' : 'Legal Support',
      training: lang === 'bn' ? 'প্রশিক্ষণ কোর্স' : 'Trainings',
      discussions: lang === 'bn' ? 'শূরা ও ফোরাম মতামত' : 'Discussion Forum',
      board_members: lang === 'bn' ? 'বোর্ড মেম্বার' : 'Board Members',
    };
    return mapping[key] || key.replace('_', ' ').toUpperCase();
  };

  return (
    <div className={`space-y-6 ${isDark ? 'text-white' : 'text-slate-800'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 rounded-3xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-[#42f5e9]/30'} border`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#42f5e9]/10 rounded-2xl flex items-center justify-center text-[#0fb5ab]">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black font-noto tracking-tight">
              {lang === 'bn' ? 'বিশেষায়িত মডিউল ও ফিচার' : 'Specialized Modules'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {lang === 'bn' ? `${madrasah?.name} (${instType.toUpperCase()}) এর অ্যাডভান্সড টুলস` : `Advanced management for ${instType}`}
            </p>
          </div>
        </div>
        <button onClick={onBack} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'} border`}>
          {lang === 'bn' ? 'ফিরে যান' : 'Back'}
        </button>
      </div>

      {/* Grid Layout */}
      {availableSubmodules.length === 0 ? (
        <div className="text-center py-24 bg-white/40 border border-[#42f5e9]/20 rounded-3xl">
          <HelpCircle size={48} className="mx-auto text-slate-300 mb-3" />
          <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">No Active Submodules</h4>
          <p className="text-xs text-slate-400 mt-2 font-noto">সুপার এডমিন প্যানেল থেকে প্রয়োজনীয় মডিউলগুলো চালু করুন।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Submodules Sidebar Tab selector */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-3">মডিউল সমূহ</h3>
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-3 lg:pb-0 no-scrollbar">
              {availableSubmodules.map(key => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSubTab(key);
                    setShowAddForm(false);
                  }}
                  className={`px-4 py-3.5 rounded-2xl border text-xs font-black text-left uppercase tracking-wider transition-all shrink-0 w-auto lg:w-full flex items-center justify-between ${
                    activeSubTab === key 
                      ? (isDark ? 'bg-[#42f5e9]/10 border-[#42f5e9]/20 text-[#42f5e9]' : 'bg-[#42f5e9]/10 border-[#42f5e9]/30 text-[#0fb5ab]')
                      : (isDark ? 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
                  }`}
                >
                  <span>{getSubTabLabel(key)}</span>
                  <ChevronRight size={14} className="hidden lg:block opacity-60" />
                </button>
              ))}
            </div>
          </div>

          {/* Submodule Work Content Panel */}
          <div className="lg:col-span-3">
            <div className={`p-6 md:p-8 rounded-[2.5rem] border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100/80 shadow-bubble'} space-y-6`}>
              
              {/* SAVINGS SUBMODULE */}
              {activeSubTab === 'savings' && (
                <div className="space-y-6">
                  {/* Shariah Compliance Alert Banner */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200/50 rounded-2xl flex items-start gap-3 text-emerald-800">
                    <div className="mt-0.5 text-emerald-600">
                      <Shield size={18} />
                    </div>
                    <div className="text-xs space-y-1 font-noto">
                      <strong className="font-bold">শতভাগ সুদমুক্ত শরীয়াহ নীতিমালা (ওয়াদিয়া ও মুদারাবাহ):</strong>
                      <p className="text-emerald-700 leading-relaxed font-medium">
                        সংগৃহীত সঞ্চয় আমানতসমূহ কোনো সুদভিত্তিক প্রকল্পে খাটানো হয় না। সদস্যদের সঞ্চিত অর্থ দিয়ে হালাল ব্যবসা, কল্যাণমূলক প্রজেক্ট এবং জমি/সম্পত্তি ক্রয়ের মত লাভজনক কাজে বিনিয়োগ করা হয় এবং অর্জিত প্রকৃত মুনাফা সদস্যদের মাঝে আনুপাতিক হারে বণ্টন করা হয়।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">সঞ্চয় হিসাব ও লেজার</h2>
                      <p className="text-[10px] text-slate-400 font-bold">সমিতির সকল সদস্যের ওয়াদিয়া ও মুদারাবাহ সঞ্চয় অ্যাকাউন্ট ট্র্যাকিং</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন অ্যাকাউন্ট'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন সঞ্চয় হিসাব খুলুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="সদস্যের নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={savName} onChange={(e) => setSavName(e.target.value)} />
                        <input type="text" placeholder="অ্যাকাউন্ট নম্বর (যেমন: SAV-103)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={savAcc} onChange={(e) => setSavAcc(e.target.value)} />
                        <input type="tel" placeholder="মোবাইল নম্বর" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={savPhone} onChange={(e) => setSavPhone(e.target.value)} />
                        <input type="number" placeholder="মাসিক সঞ্চয় লক্ষ্যমাত্রা (৳)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={savGoal} onChange={(e) => setSavGoal(e.target.value)} />
                      </div>
                      <button onClick={handleAddSavings} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">নিশ্চিত করুন</button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savingsAccounts.map(sav => (
                      <div key={sav.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{sav.accNo} (মুদারাবাহ)</span>
                            <h4 className="text-sm font-black text-slate-800 mt-1 font-noto">{sav.name}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">{sav.phone || 'মোবাইল নেই'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] font-black text-slate-400 uppercase">মোট সঞ্চয় ব্যালেন্স</span>
                            <h3 className="text-lg font-black text-[#0fb5ab]">{sav.balance} ৳</h3>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                          <span className="text-[9px] font-bold text-slate-400">লক্ষ্যমাত্রা: {sav.monthlyGoal}৳ / মাস</span>
                          <div className="flex gap-2">
                            <button onClick={() => handleDepositSavings(sav.id, 500)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider">+ ৫০০ ৳</button>
                            <button onClick={() => handleDepositSavings(sav.id, 1000)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider">+ ১০০০ ৳</button>
                            <button onClick={() => handleDeleteItem('savings', sav.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LOANS SUBMODULE */}
              {activeSubTab === 'loans' && (
                <div className="space-y-6">
                  {/* Shariah Compliance Alert Banner */}
                  <div className="p-4 bg-sky-50 border border-sky-200/50 rounded-2xl flex items-start gap-3 text-sky-800">
                    <div className="mt-0.5 text-sky-600">
                      <Shield size={18} />
                    </div>
                    <div className="text-xs space-y-1 font-noto">
                      <strong className="font-bold">সুদ-মুক্ত আর্থিক সাহায্য ও হালাল বিনিয়োগ নীতি:</strong>
                      <p className="text-sky-700 leading-relaxed font-medium">
                        ইসলামে সুদের লেনদেন কঠোরভাবে নিষিদ্ধ। তাই এই মডিউলে প্রচলিত সুদভিত্তিক ঋণের পরিবর্তে কল্যাণমূলক <strong className="underline">করজে হাসানা (০% সুদের ঋণ)</strong> অথবা ক্রয়-বিক্রয় ভিত্তিক <strong className="underline">মুরাবাহা</strong> এবং অংশীদারিত্ব ভিত্তিক <strong className="underline">মুদারাবাহ</strong> বিনিয়োগ রেজিস্টার ও ট্র্যাকিং করা হয়।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">বিনিয়োগ ও করজে হাসানা ট্র্যাকিং</h2>
                      <p className="text-[10px] text-slate-400 font-bold">সদস্যদের করজে হাসানা প্রদান, হালাল বিনিয়োগ ও কিস্তি আদায়</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন বিনিয়োগ'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন বিনিয়োগ বা করজে হাসানা অনুমোদন</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">বিনিয়োগের ধরণ (Investment Type)</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { key: 'Qard Hasan', title: 'করজে হাসানা', desc: '০% সুদ/ফি কল্যাণ ঋণ' },
                              { key: 'Murabaha', title: 'মুরাবাহা', desc: 'লাভ-সহ কিস্তিতে বিক্রয়' },
                              { key: 'Mudarabah', title: 'মুদারাবাহ', desc: 'ব্যবসা অংশীদারিত্ব' }
                            ].map(t => (
                              <button
                                key={t.key}
                                type="button"
                                onClick={() => {
                                  setLoanType(t.key);
                                  if (t.key === 'Qard Hasan') setLoanRate('0');
                                }}
                                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                  loanType === t.key 
                                    ? 'bg-[#0fb5ab]/10 border-[#0fb5ab] text-[#0fb5ab]' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                              >
                                <span className="text-xs font-black font-noto">{t.title}</span>
                                <span className="text-[8px] text-slate-400 mt-0.5 leading-tight">{t.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">গ্রহীতার নাম</label>
                          <input type="text" placeholder="গ্রহীতার নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={loanName} onChange={(e) => setLoanName(e.target.value)} />
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">বিনিয়োগ/ঋণের পরিমাণ (৳)</label>
                          <input type="number" placeholder="পরিমাণ" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
                        </div>

                        {loanType !== 'Qard Hasan' ? (
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-slate-400">নির্ধারিত লভ্যাংশ / মুনাফার হার (%)</label>
                            <input type="number" placeholder="মুনাফার হার" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={loanRate} onChange={(e) => setLoanRate(e.target.value)} />
                          </div>
                        ) : (
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center text-center text-[10px] text-emerald-800 font-bold font-noto">
                            ✓ করজে হাসানা সম্পূর্ণ সুদ-মুক্ত কল্যাণ ঋণ। এতে কোনো লভ্যাংশ বা মুনাফা যোগ হবে না।
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">পরিশোধের মেয়াদ (মাস)</label>
                          <input type="number" placeholder="মেয়াদ" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={loanDuration} onChange={(e) => setLoanDuration(e.target.value)} />
                        </div>
                      </div>
                      <button onClick={handleAddLoan} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">বিনিয়োগ রেজিস্টার করুন</button>
                    </div>
                  )}

                  <div className="space-y-4">
                    {loans.map(loan => {
                      const percent = Math.min(100, Math.round((loan.paid / loan.amount) * 100));
                      const isQard = loan.type === 'Qard Hasan' || !loan.interestRate;
                      return (
                        <div key={loan.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-slate-800 font-noto">{loan.name}</h4>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                                  isQard ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'
                                }`}>
                                  {loan.type === 'Qard Hasan' ? 'করজে হাসানা' : loan.type === 'Murabaha' ? 'মুরাবাহা' : loan.type === 'Mudarabah' ? 'মুদারাবাহ' : 'বিনিয়োগ'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {isQard ? 'সুদ-মুক্ত কল্যাণ ঋণ' : `মুনাফার হার: ${loan.interestRate}%`} • মেয়াদ: {loan.duration} মাস
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] font-black text-slate-400 uppercase">বিনিয়োগকৃত অর্থ</span>
                              <h3 className="text-base font-black text-slate-800">{loan.amount} ৳</h3>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>পরিশোধিত: {loan.paid}৳</span>
                              <span>{percent}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-50 pt-3 flex-wrap gap-2">
                            <div>
                              <span className="text-[8px] font-black text-slate-400 uppercase">পরবর্তী কিস্তি</span>
                              <p className="text-xs font-black text-[#0fb5ab]">{loan.installmentAmount} ৳ ({loan.nextDueDate})</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handlePayEMI(loan.id)} className="px-4 py-2 bg-[#42f5e9]/10 text-[#0fb5ab] border border-[#42f5e9]/20 rounded-xl text-[10px] font-black uppercase tracking-wider">কিস্তি আদায়</button>
                              <button onClick={() => handleDeleteItem('loans', loan.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VOLUNTEERS SUBMODULE */}
              {activeSubTab === 'volunteers' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">স্বেচ্ছাসেবক ম্যানেজমেন্ট</h2>
                      <p className="text-[10px] text-slate-400 font-bold">সংস্থার স্বেচ্ছাসেবকদের তালিকা, যোগাযোগ ও দায়িত্ব বন্টন</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন স্বেচ্ছাসেবক'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন স্বেচ্ছাসেবক যুক্ত করুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="স্বেচ্ছাসেবকের নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={volName} onChange={(e) => setVolName(e.target.value)} />
                        <input type="text" placeholder="দায়িত্ব / পদবী" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={volRole} onChange={(e) => setVolRole(e.target.value)} />
                        <input type="tel" placeholder="মোবাইল নম্বর" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={volPhone} onChange={(e) => setVolPhone(e.target.value)} />
                        <input type="text" placeholder="কার্য এলাকা (আঞ্চলিক)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={volArea} onChange={(e) => setVolArea(e.target.value)} />
                      </div>
                      <button onClick={handleAddVolunteer} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">স্বেচ্ছাসেবক যুক্ত করুন</button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {volunteers.map(vol => (
                      <div key={vol.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-xl flex items-center justify-center">
                            <Users size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 font-noto leading-tight">{vol.name}</h4>
                            <p className="text-[10px] text-[#0fb5ab] font-bold mt-0.5">{vol.designation}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">এলাকা: {vol.area} • {vol.phone}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleDeleteItem('volunteers', vol.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EMPLOYEES SUBMODULE */}
              {activeSubTab === 'employees' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">কর্মকর্তা ও কর্মচারী তালিকা</h2>
                      <p className="text-[10px] text-slate-400 font-bold">সংস্থার বেতনভুক্ত কর্মকর্তা-কর্মচারীদের প্রোফাইল ও বেতন ট্র্যাকিং</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন কর্মকর্তা'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন কর্মকর্তা যুক্ত করুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="কর্মকর্তার নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={empName} onChange={(e) => setEmpName(e.target.value)} />
                        <input type="text" placeholder="পদবী" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={empRole} onChange={(e) => setEmpRole(e.target.value)} />
                        <input type="tel" placeholder="মোবাইল নম্বর" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} />
                        <input type="number" placeholder="মাসিক বেতন (৳)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={empSalary} onChange={(e) => setEmpSalary(e.target.value)} />
                      </div>
                      <button onClick={handleAddEmployee} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">নিশ্চিত করুন</button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employees.map(emp => (
                      <div key={emp.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                            <Briefcase size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 font-noto leading-tight">{emp.name}</h4>
                            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{emp.designation}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">যোগদান: {emp.joined} • ফোন: {emp.phone}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <h4 className="text-sm font-black text-[#0fb5ab]">{emp.salary} ৳/মাস</h4>
                          <button onClick={() => handleDeleteItem('employees', emp.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PROJECTS SUBMODULE */}
              {activeSubTab === 'projects' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">প্রজেক্ট বাজেট ও কার্যক্রম ট্র্যাকিং</h2>
                      <p className="text-[10px] text-slate-400 font-bold">সংস্থার বিভিন্ন চলমান প্রজেক্টের বাজেট ও খরচের হিসাব</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন প্রজেক্ট'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন প্রজেক্ট যুক্ত করুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="প্রজেক্টের নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={projTitle} onChange={(e) => setProjTitle(e.target.value)} />
                        <input type="number" placeholder="বাজেট (৳)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={projBudget} onChange={(e) => setProjBudget(e.target.value)} />
                      </div>
                      <button onClick={handleAddProject} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">প্রজেক্ট তৈরি করুন</button>
                    </div>
                  )}

                  <div className="space-y-4">
                    {projects.map(proj => {
                      const percent = Math.min(100, Math.round((proj.spent / proj.budget) * 100));
                      return (
                        <div key={proj.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-black text-slate-800 font-noto">{proj.title}</h4>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-2 inline-block ${proj.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{proj.status}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] font-black text-slate-400 uppercase">মোট বাজেট</span>
                              <h3 className="text-base font-black text-slate-800">{proj.budget} ৳</h3>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>ব্যয় হয়েছে: {proj.spent}৳</span>
                              <span>{percent}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DONATIONS SUBMODULE */}
              {activeSubTab === 'donations' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">অনুদান সংগ্রহ ও রেজিস্টার</h2>
                      <p className="text-[10px] text-slate-400 font-bold">দাতাদের অনুদান সংগ্রহ এবং স্বচ্ছভাবে ট্র্যাকিং</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন অনুদান'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন অনুদান রেকর্ড করুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="দাতার নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={donDonor} onChange={(e) => setDonDonor(e.target.value)} />
                        <input type="number" placeholder="অনুদানের পরিমাণ (৳)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={donAmount} onChange={(e) => setDonAmount(e.target.value)} />
                        <select className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold outline-none" value={donProj} onChange={(e) => setDonProj(e.target.value)}>
                          <option value="">জেনারেল ফান্ড</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.title}>{p.title}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={handleAddDonation} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">অনুমোদন দিন</button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {donations.map(don => (
                      <div key={don.id} className="p-4 bg-white border border-slate-50 rounded-2xl shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                            <Gift size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 font-noto leading-tight">{don.donor}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">{don.project} • {don.date}</p>
                          </div>
                        </div>
                        <h4 className="text-base font-black text-emerald-600">+{don.amount} ৳</h4>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PROPERTIES SUBMODULE */}
              {activeSubTab === 'properties' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">ভূমি ও ভবন (মার্কেট ভাড়া) ব্যবস্থাপনা</h2>
                      <p className="text-[10px] text-slate-400 font-bold">ট্রাস্টের জমি ও ভবন লিজ এবং ভাড়া আয়ের বিবরণী</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন সম্পত্তি'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন সম্পত্তি রেকর্ড করুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="সম্পত্তির বিবরণ / নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={propTitle} onChange={(e) => setPropTitle(e.target.value)} />
                        <select className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold outline-none" value={propType} onChange={(e) => setPropType(e.target.value)}>
                          <option value="Building">বিল্ডিং / দোকান</option>
                          <option value="Land">জমি / প্লট</option>
                        </select>
                        <input type="text" placeholder="আনুমানিক বাজার মূল্য (৳)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={propValue} onChange={(e) => setPropValue(e.target.value)} />
                        <input type="text" placeholder="বাৎসরিক ভাড়া আয় (৳)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={propRent} onChange={(e) => setPropRent(e.target.value)} />
                        <input type="text" placeholder="অবস্থান / ঠিকানা" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold lg:col-span-2" value={propLoc} onChange={(e) => setPropLoc(e.target.value)} />
                      </div>
                      <button onClick={handleAddProperty} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">নিশ্চিত করুন</button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {properties.map(prop => (
                      <div key={prop.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">{prop.type}</span>
                            <button onClick={() => handleDeleteItem('properties', prop.id)} className="text-red-400 hover:bg-red-50 p-1 rounded-lg"><Trash2 size={13} /></button>
                          </div>
                          <h4 className="text-sm font-black text-slate-800 mt-2 font-noto">{prop.title}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">ঠিকানা: {prop.location}</p>
                        </div>
                        <div className="border-t border-slate-50 pt-3 flex justify-between items-center text-xs">
                          <div>
                            <span className="text-[8px] text-slate-400 block">আনুমানিক মূল্য</span>
                            <span className="font-bold text-slate-700">{prop.value}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] text-slate-400 block">বাৎসরিক ভাড়া আয়</span>
                            <span className="font-black text-[#0fb5ab]">{prop.annualRent}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DISCUSSION BOARD & OPINION FORUM */}
              {activeSubTab === 'discussions' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-black text-[#0fb5ab] font-noto">ফোরাম ও অনলাইন ডিসকাশন বোর্ড</h2>
                    <p className="text-[10px] text-slate-400 font-bold">সংস্থার গুরুত্বপূর্ণ নীতি এবং সিদ্ধান্তের উপর সকল সদস্যের মুক্ত মতামত</p>
                  </div>

                  <div className="space-y-3">
                    <textarea 
                      placeholder="আপনার প্রশ্ন বা আলোচনার বিষয় লিখুন..." 
                      className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-[#42f5e9]/50"
                      value={discContent}
                      onChange={(e) => setDiscContent(e.target.value)}
                    />
                    <button onClick={handleAddDiscussion} className="px-6 py-3 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 shadow-md">
                      <Send size={14} />
                      <span>মতামত পোস্ট করুন</span>
                    </button>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    {discussions.map(disc => (
                      <div key={disc.id} className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-600 font-noto">{disc.author}</span>
                          <span className="text-[9px] text-slate-400">{disc.date}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 leading-relaxed font-noto">{disc.content}</p>
                        <div className="flex justify-end pt-2 border-t border-slate-100/50">
                          <button onClick={() => handleVoteDiscussion(disc.id)} className="flex items-center gap-1.5 px-3 py-1 bg-[#42f5e9]/10 text-[#0fb5ab] border border-[#42f5e9]/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            <Heart size={10} fill="#0fb5ab" />
                            <span>সহমত ({disc.votes})</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ELECTION POLLS & VOTING */}
              {activeSubTab === 'election' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">নির্বাচন ও কার্যনির্বাহী ভোটিং</h2>
                      <p className="text-[10px] text-slate-400 font-bold">নতুন কার্যনির্বাহী পরিষদ নির্বাচন ও ভোটার পোল</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন পোল'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন নির্বাচনী পোল তৈরি করুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="পদের নাম (যেমন: সভাপতি)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={votePosition} onChange={(e) => setVotePosition(e.target.value)} />
                        <input type="text" placeholder="প্রার্থীদের নাম (কমা দিয়ে আলাদা করুন)" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={voteCandidates} onChange={(e) => setVoteCandidates(e.target.value)} />
                      </div>
                      <button onClick={handleAddElection} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">পোল পাবলিশ করুন</button>
                    </div>
                  )}

                  <div className="space-y-4">
                    {elections.map(el => (
                      <div key={el.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-800 font-noto flex items-center gap-2">
                            <Vote size={18} className="text-[#0fb5ab]" /> {el.position} নির্বাচন
                          </h4>
                          <button onClick={() => handleDeleteItem('elections', el.id)} className="text-red-400 hover:text-red-100 p-1 rounded-md"><Trash2 size={13} /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {el.candidates.map((cand: any, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
                              <div>
                                <h5 className="text-xs font-black text-slate-700 font-noto">{cand.name}</h5>
                                <span className="text-[9px] text-slate-400 mt-1 block">প্রাপ্ত ভোট: {cand.votes}</span>
                              </div>
                              <button onClick={() => handleCastVote(el.id, cand.name)} className="px-3 py-1.5 bg-[#0fb5ab] text-white rounded-lg text-[9px] font-black uppercase tracking-widest">ভোট দিন</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PROFIT DISTRIBUTION SUBMODULE */}
              {activeSubTab === 'profit_distribution' && (
                <div className="space-y-6">
                  {/* Shariah banner */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200/50 rounded-2xl flex items-start gap-3 text-emerald-800">
                    <div className="mt-0.5 text-emerald-600">
                      <Shield size={18} />
                    </div>
                    <div className="text-xs space-y-1 font-noto">
                      <strong className="font-bold">হালাল অংশীদারিত্ব ও লভ্যাংশ বণ্টন নীতিমালা:</strong>
                      <p className="text-emerald-700 leading-relaxed font-medium">
                        ইসলামে পূর্ব-নির্ধারিত কোনো নির্দিষ্ট হারের মুনাফা বা সুদ হারাম। এখানে ব্যবসা বা জমি উন্নয়নের মাধ্যমে অর্জিত বাস্তব মুনাফা সকল সঞ্চয়কারীর মোট জমার অনুপাত অনুযায়ী বণ্টন করা হয়।
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">মোট সঞ্চয় পুল</span>
                      <h3 className="text-xl font-black text-[#0fb5ab] mt-1">
                        {savingsAccounts.reduce((acc, curr) => acc + curr.balance, 0)} ৳
                      </h3>
                      <p className="text-[9px] text-slate-400 mt-1">এই জমার উপর ভিত্তি করে লভ্যাংশ হিসাব করা হবে</p>
                    </div>
                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">সঞ্চয়কারী সদস্য</span>
                      <h3 className="text-xl font-black text-slate-800 mt-1">{savingsAccounts.length} জন</h3>
                      <p className="text-[9px] text-slate-400 mt-1">সক্রিয় সঞ্চয় হিসাবধারী</p>
                    </div>
                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">সর্বশেষ লভ্যাংশ হার</span>
                      <h3 className="text-xl font-black text-emerald-600 mt-1">
                        {profitDistributions[0]?.ratePerThousand || 0} ৳
                      </h3>
                      <p className="text-[9px] text-slate-400 mt-1">প্রতি ১০০০ ৳ সঞ্চয়ের বিপরীতে মুনাফা</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">প্রজেক্ট লভ্যাংশ বণ্টন বোর্ড</h2>
                      <p className="text-[10px] text-slate-400 font-bold">হালাল প্রজেক্ট বা জমি থেকে অর্জিত মোট মুনাফা বণ্টন করুন</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন বণ্টন'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">নতুন লভ্যাংশ বণ্টন ক্যালকুলেটর</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">মোট বণ্টনযোগ্য অর্জিত মুনাফা (৳)</label>
                          <input 
                            type="number" 
                            placeholder="যেমন: ২৫০০০" 
                            className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" 
                            value={profTotal} 
                            onChange={(e) => setProfTotal(e.target.value)} 
                          />
                        </div>
                        {profTotal && savingsAccounts.reduce((acc, curr) => acc + curr.balance, 0) > 0 && (
                          <div className="p-3 bg-emerald-50 rounded-xl flex flex-col justify-center text-xs font-noto text-emerald-800">
                            <strong>প্রাক্কলিত হিসাব:</strong>
                            <p className="text-[10px] text-emerald-700 mt-0.5">
                              প্রতি ১০০০ ৳ জমার বিপরীতে লভ্যাংশ প্রায়: <strong className="underline">
                                {Math.round((parseFloat(profTotal) / savingsAccounts.reduce((acc, curr) => acc + curr.balance, 0)) * 1000 * 100) / 100} ৳
                              </strong> হবে।
                            </p>
                          </div>
                        )}
                      </div>
                      <button onClick={handleDistributeProfit} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">মুনাফা ডিস্ট্রিবিউট করুন</button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">বণ্টন ইতিহাস (Distribution Ledger)</h4>
                    {profitDistributions.map(dist => (
                      <div key={dist.id} className="p-4 bg-white border border-slate-50 rounded-2xl shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                            <PiggyBank size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 font-noto leading-tight">লভ্যাংশ বণ্টন - {dist.date}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {dist.distributedTo} জন সঞ্চয়কারীর মাঝে বণ্টনকৃত • প্রতি হাজারে হার: {dist.ratePerThousand} ৳
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-black text-emerald-600">+{dist.totalProfit} ৳</h4>
                          <button onClick={() => handleDeleteItem('profit_distributions', dist.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WELFARE & ZAKAT FUND SUBMODULE */}
              {activeSubTab === 'welfare_fund' && (
                <div className="space-y-6">
                  {/* Islamic Welfare Header and Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                      const zakatCollected = welfareRecords.filter(r => r.type === 'Zakat' && r.category === 'Income').reduce((a, c) => a + c.amount, 0);
                      const sadaqahCollected = welfareRecords.filter(r => r.type === 'Sadaqah' && r.category === 'Income').reduce((a, c) => a + c.amount, 0);
                      const otherCollected = welfareRecords.filter(r => ['Ushr', 'Fitrah', 'General'].includes(r.type) && r.category === 'Income').reduce((a, c) => a + c.amount, 0);
                      const totalExpenses = welfareRecords.filter(r => r.category === 'Expense').reduce((a, c) => a + c.amount, 0);
                      const netBalance = (zakatCollected + sadaqahCollected + otherCollected) - totalExpenses;
                      
                      return (
                        <>
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">মোট যাকাত সংগৃহীত</span>
                            <h4 className="text-base font-black text-emerald-600 mt-1">{zakatCollected} ৳</h4>
                          </div>
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">সাদাকাহ ও সাধারণ ফান্ড</span>
                            <h4 className="text-base font-black text-[#0fb5ab] mt-1">{sadaqahCollected} ৳</h4>
                          </div>
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">মোট বিতরণ ও সহায়তা</span>
                            <h4 className="text-base font-black text-red-500 mt-1">{totalExpenses} ৳</h4>
                          </div>
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">তহবিলে অবশিষ্ট</span>
                            <h4 className="text-base font-black text-slate-800 mt-1">{netBalance} ৳</h4>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#0fb5ab] font-noto">কল্যাণ, যাকাত ও ওশর তহবিল</h2>
                      <p className="text-[10px] text-slate-400 font-bold">দরিদ্র, অভাবগ্রস্ত ও লিল্লাহ সমাজসেবা খাতের আয়-ব্যয় ট্র্যাকিং</p>
                    </div>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2.5 bg-[#42f5e9] text-[#0e8a84] font-black text-xs uppercase tracking-widest rounded-xl shadow-premium">
                      {showAddForm ? <X size={16} /> : <Plus size={16} />}
                      <span>{showAddForm ? 'বাতিল' : 'নতুন এন্ট্রি'}</span>
                    </button>
                  </div>

                  {showAddForm && (
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-4 border border-slate-100 animate-in slide-in-from-top-4">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">কল্যাণ তহবিল ট্রানজেকশন যুক্ত করুন</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">লেনদেনের ধরণ</label>
                          <select className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold outline-none" value={welfCat} onChange={(e) => setWelfCat(e.target.value)}>
                            <option value="Income">জমা / সংগ্রহ (Income)</option>
                            <option value="Expense">বিতরণ / সহায়তা (Expense)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">তহবিলের খাত (Ledger Sector)</label>
                          <select className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold outline-none" value={welfType} onChange={(e) => setWelfType(e.target.value)}>
                            <option value="Zakat">যাকাত (Zakat)</option>
                            <option value="Sadaqah">সাদাকাহ ও দান (Sadaqah)</option>
                            <option value="Ushr">ফসলের ওশর (Ushr)</option>
                            <option value="Fitrah">ফিতরা (Fitrah)</option>
                            <option value="General">সাধারণ সমাজকল্যাণ</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">পরিমাণ (৳)</label>
                          <input type="number" placeholder="৳" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={welfAmount} onChange={(e) => setWelfAmount(e.target.value)} />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400">
                            {welfCat === 'Income' ? 'দাতা / সংগ্রহকারীর নাম' : 'গ্রহীতা / সহায়তাপ্রাপ্ত ব্যক্তির নাম'}
                          </label>
                          <input type="text" placeholder="নাম" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={welfPerson} onChange={(e) => setWelfPerson(e.target.value)} />
                        </div>

                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400">সংক্ষিপ্ত বিবরণ</label>
                          <input type="text" placeholder="যেমন: বিধবা ফাতেমা বেগমকে সাহায্য" className="h-12 bg-white px-4 rounded-xl border border-slate-200 text-xs font-bold" value={welfDesc} onChange={(e) => setWelfDesc(e.target.value)} />
                        </div>
                      </div>
                      <button onClick={handleAddWelfareRecord} className="w-full h-12 bg-[#0fb5ab] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md">রেকর্ড সংরক্ষণ করুন</button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">তহবিলের খতিয়ান (Welfare Ledger Book)</h4>
                    {welfareRecords.map(rec => (
                      <div key={rec.id} className="p-4 bg-white border border-slate-50 rounded-2xl shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${
                            rec.category === 'Income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                          } rounded-xl flex items-center justify-center`}>
                            <Gift size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-800 font-noto leading-tight">
                                {rec.category === 'Income' ? `আদায়কৃত ওশর/যাকাত/দান: ${rec.donor}` : `বিতরণকৃত সাহায্য: ${rec.beneficiary}`}
                              </h4>
                              <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                {rec.type === 'Zakat' ? 'যাকাত' : rec.type === 'Sadaqah' ? 'সাদাকাহ' : rec.type === 'Ushr' ? 'ওশর' : rec.type === 'Fitrah' ? 'ফিতরা' : 'সাধারণ'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{rec.description} • {rec.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <h4 className={`text-base font-black ${rec.category === 'Income' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {rec.category === 'Income' ? '+' : '-'}{rec.amount} ৳
                          </h4>
                          <button onClick={() => handleDeleteItem('welfare_records', rec.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TOURNAMENTS SUBMODULE */}
              {activeSubTab === 'tournaments' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-black text-[#0fb5ab] font-noto">টুর্নামেন্ট ও কালচারাল প্রজেক্ট</h2>
                    <p className="text-[10px] text-slate-400 font-bold">ক্লাবের বার্ষিক স্পোর্টস, খেলাধুলা ও সাংস্কৃতিক উৎসব ট্র্যাকিং</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tournaments.map(t => (
                      <div key={t.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2">
                        <span className="text-[8px] font-black bg-[#42f5e9]/20 text-[#0fb5ab] px-2 py-0.5 rounded-full">UPCOMING</span>
                        <h4 className="text-sm font-black text-slate-800 font-noto leading-tight">{t.title}</h4>
                        <p className="text-[10px] text-slate-500">তারিখ: {t.date} • মোট দল: {t.teams}</p>
                        <p className="text-[10px] text-indigo-600 font-black mt-2">পুরস্কার: {t.prize}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* QARD HASAN SUBMODULE */}
              {activeSubTab === 'qard_hasan' && (
                <div className="space-y-6">
                  {/* Shariah-compliance declaration banner */}
                  <div className={`p-5 rounded-3xl flex items-start gap-4 ${isDark ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-800'} border shadow-inner`}>
                    <div className="text-emerald-500 mt-1 shrink-0">
                      <Shield size={24} />
                    </div>
                    <div className="text-xs space-y-1.5 font-noto">
                      <h4 className="font-black text-[13px] uppercase tracking-wider">১০০% সুদমুক্ত ও শরীয়াহ-সম্মত ঋণ (করজে হাসানা) নীতিমালা</h4>
                      <p className="leading-relaxed font-bold opacity-90">
                        মুমিনদের পারস্পরিক ভ্রাতৃত্ব ও সামাজিক কল্যাণ কামনায় করজে হাসানা একটি অনন্য ইবাদত। এই মডিউলের মাধ্যমে সম্পূর্ণ সুদ ও প্রসেসিং ফি বিহীন ঋণ কার্যক্রম পরিচালনা করা হয়। কোনো অবস্থাতেই বকেয়া বা কিস্তি পরিশোধে বিলম্বের জন্য জরিমানা বা অতিরিক্ত সুদ যোগ করা হয় না, যা শতভাগ হালাল ও শরীয়াহ-সম্মত।
                      </p>
                    </div>
                  </div>

                  {/* Sub-tabs menu inside Qard Hasan */}
                  <div className="flex overflow-x-auto gap-2 pb-3 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-none border-b border-slate-100/80">
                    {[
                      { key: 'overview', label: 'ঋণের চিত্র (Overview)', icon: Landmark },
                      { key: 'apply', label: 'নতুন আবেদন (Apply)', icon: Plus },
                      { key: 'verify', label: 'যাচাই ও অনুমোদন', icon: Clipboard },
                      { key: 'active', label: 'সক্রিয় ঋণ ও বকেয়া', icon: CheckCircle2 },
                      { key: 'repayments', label: 'পরিশোধের ইতিহাস', icon: FileText },
                      { key: 'guarantors', label: 'জামিনদার', icon: Users },
                      { key: 'agreements', label: 'চুক্তিপত্র (Deed)', icon: Shield }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = qardTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setQardTab(tab.key as any);
                            setShowAddForm(false);
                          }}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            isActive
                              ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white shadow-md'
                              : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <Icon size={14} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* OVERVIEW SUB-TAB */}
                  {qardTab === 'overview' && (() => {
                    const approvedLoans = qardHasanApplications.filter(a => a.status === 'approved');
                    const totalLoanAmt = approvedLoans.reduce((sum, a) => sum + a.amount, 0);
                    const totalRepaid = approvedLoans.reduce((sum, a) => sum + (a.repayments || []).reduce((s: number, r: any) => s + r.amount, 0), 0);
                    const totalOutstanding = totalLoanAmt - totalRepaid;
                    const pendingCount = qardHasanApplications.filter(a => a.status === 'pending').length;
                    const verifiedCount = qardHasanApplications.filter(a => a.status === 'verified').length;

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-5 bg-gradient-to-br from-[#0fb5ab]/10 to-[#0fb5ab]/5 border border-[#0fb5ab]/20 rounded-3xl relative overflow-hidden">
                            <div className="absolute right-4 bottom-4 text-[#0fb5ab]/10"><Landmark size={48} /></div>
                            <span className="text-[10px] font-black uppercase text-[#0fb5ab] tracking-widest block">মোট অনুমোদিত ঋণ</span>
                            <h2 className="text-2xl font-black text-[#0fb5ab] mt-1">৳{totalLoanAmt.toLocaleString('bn-BD')}</h2>
                            <p className="text-[9px] text-slate-400 font-bold mt-1">সুদ বা অতিরিক্ত চার্জ: ৳০ (০%)</p>
                          </div>
                          <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-3xl relative overflow-hidden">
                            <div className="absolute right-4 bottom-4 text-emerald-500/10"><CheckCircle2 size={48} /></div>
                            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest block">মোট পরিশোধিত কিস্তি</span>
                            <h2 className="text-2xl font-black text-emerald-600 mt-1">৳{totalRepaid.toLocaleString('bn-BD')}</h2>
                            <p className="text-[9px] text-slate-400 font-bold mt-1">সদস্যদের নিয়মিত পরিশোধিত কিস্তি</p>
                          </div>
                          <div className="p-5 bg-gradient-to-br from-rose-500/10 to-rose-500/5 border border-rose-500/20 rounded-3xl relative overflow-hidden">
                            <div className="absolute right-4 bottom-4 text-rose-500/10"><Shield size={48} /></div>
                            <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest block">মোট বকেয়া করজ</span>
                            <h2 className="text-2xl font-black text-rose-600 mt-1">৳{totalOutstanding.toLocaleString('bn-BD')}</h2>
                            <p className="text-[9px] text-slate-400 font-bold mt-1">অবशिष्ट পরিশোধযোগ্য করজে হাসানা</p>
                          </div>
                        </div>

                        {/* Visual Loan recovery meter */}
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                          <div className="flex items-center justify-between text-xs font-black font-noto">
                            <span className="text-slate-500">ঋণ আদায়ের হার (Recovery Rate)</span>
                            <span className="text-[#0fb5ab]">
                              {totalLoanAmt > 0 ? Math.round((totalRepaid / totalLoanAmt) * 100) : 0}%
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-[#42f5e9] to-[#0fb5ab] rounded-full transition-all duration-500"
                              style={{ width: `${totalLoanAmt > 0 ? (totalRepaid / totalLoanAmt) * 100 : 0}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold font-noto">
                            <span>পরিশোধিত: ৳{totalRepaid.toLocaleString('bn-BD')}</span>
                            <span>লক্ষ্যমাত্রা: ৳{totalLoanAmt.toLocaleString('bn-BD')}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider font-noto">নতুন আবেদন পেন্ডিং</h4>
                              <p className="text-2xl font-black text-[#0fb5ab] mt-1">{pendingCount} জন</p>
                            </div>
                            <button type="button" onClick={() => setQardTab('verify')} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black hover:bg-slate-100 transition-colors flex items-center gap-1">
                              <span>যাচাই করুন</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                          <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider font-noto">যাচাইকৃত (অনুমোদনের অপেক্ষায়)</h4>
                              <p className="text-2xl font-black text-emerald-600 mt-1">{verifiedCount} জন</p>
                            </div>
                            <button type="button" onClick={() => setQardTab('verify')} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black hover:bg-slate-100 transition-colors flex items-center gap-1">
                              <span>অনুমোদন দিন</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* APPLY NEW LOAN SUB-TAB */}
                  {qardTab === 'apply' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-black text-[#0fb5ab] font-noto">নতুন করজে হাসানা আবেদন</h3>
                          <p className="text-[10px] text-slate-400 font-bold">সুদবিহীন ঋণের জন্য আবেদনপত্র ও সদস্য তালিকা</p>
                        </div>
                        <button type="button" onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2 bg-[#0fb5ab] text-white rounded-xl text-xs font-black active:scale-95 transition-all">
                          {showAddForm ? <X size={14} /> : <Plus size={14} />}
                          <span>{showAddForm ? 'ফর্ম বন্ধ করুন' : 'আবেদন ফরম'}</span>
                        </button>
                      </div>

                      {showAddForm && (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-6 animate-in slide-in-from-top-4">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest font-noto">করজে হাসানা আবেদন ফরম</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">আবেদনকারীর নাম</label>
                              <input type="text" placeholder="মোঃ আব্দুর রহমান" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardName} onChange={(e) => setQardName(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">মোবাইল নম্বর</label>
                              <input type="tel" placeholder="017xxxxxxxx" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardPhone} onChange={(e) => setQardPhone(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ঋণের পরিমাণ (৳)</label>
                              <input type="number" placeholder="50000" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardAmount} onChange={(e) => setQardAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">কিস্তি আদায়ের ধরণ</label>
                              <select className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardPeriod} onChange={(e: any) => setQardPeriod(e.target.value)}>
                                <option value="monthly">মাসিক কিস্তি (Monthly)</option>
                                <option value="weekly">সাপ্তাহিক কিস্তি (Weekly)</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">কিস্তি সংখ্যা (মাস/সপ্তাহ)</label>
                              <input type="number" placeholder="10" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardInstallments} onChange={(e) => setQardInstallments(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ঋণের উদ্দেশ্য</label>
                              <input type="text" placeholder="হস্তশিল্প ক্ষুদ্র ব্যবসা সম্প্রসারণ" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardPurpose} onChange={(e) => setQardPurpose(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">জামিনদারের নাম (Guarantor Name)</label>
                              <input type="text" placeholder="মাওলানা কাসেম আলী" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardGuarantorName} onChange={(e) => setQardGuarantorName(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">জামিনদারের মোবাইল নম্বর</label>
                              <input type="tel" placeholder="018xxxxxxxx" className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold focus:border-[#0fb5ab] outline-none" value={qardGuarantorPhone} onChange={(e) => setQardGuarantorPhone(e.target.value)} />
                            </div>
                          </div>

                          {/* Calculated Installment Example Box */}
                          {qardAmount && (
                            <div className="p-4 bg-[#0fb5ab]/5 border border-[#0fb5ab]/10 rounded-2xl space-y-2">
                              <h5 className="text-[11px] font-black text-[#0fb5ab] uppercase tracking-wider">কিস্তি হিসাব ক্যালকুলেশন (Interest-Free Plan)</h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold text-slate-700">
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase block font-noto">ঋণের পরিমাণ</span>
                                  <span className="text-slate-800">৳{parseFloat(qardAmount).toLocaleString('bn-BD')}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase block font-noto">কিস্তির পরিমাণ</span>
                                  <span className="text-slate-800">৳{Math.round(parseFloat(qardAmount) / (parseInt(qardInstallments) || 10)).toLocaleString('bn-BD')} / {qardPeriod === 'monthly' ? 'মাস' : 'সপ্তাহ'}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase block font-noto">মোট ফেরত</span>
                                  <span className="text-emerald-600">৳{parseFloat(qardAmount).toLocaleString('bn-BD')}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase block font-noto">মোট সুদ (সুদবিহীন ঋণ)</span>
                                  <span className="text-red-500">৳০ (০%)</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <button type="button" onClick={handleApplyQard} className="w-full h-12 bg-[#0fb5ab] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md">সাবমিট করুন</button>
                        </div>
                      )}

                      {/* List of Applications */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider font-noto">ঋণ আবেদন তালিকা</h4>
                        {qardHasanApplications.length === 0 ? (
                          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                            <p className="text-xs text-slate-400 font-noto">কোনো করজে হাসানা আবেদন পাওয়া যায়নি।</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {qardHasanApplications.map(app => (
                              <div key={app.id} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      app.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                      app.status === 'verified' ? 'bg-sky-50 text-sky-600' :
                                      app.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                      {app.status === 'approved' ? 'অনুমোদিত' :
                                       app.status === 'verified' ? 'যাচাইকৃত' :
                                       app.status === 'rejected' ? 'বাতিলকৃত' : 'আবেদনকৃত (পেন্ডিং)'}
                                    </span>
                                    <h4 className="text-sm font-black text-slate-800 font-noto mt-1.5">{app.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-medium">{app.phone}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[8px] font-black text-slate-400 uppercase">ঋণের পরিমাণ</span>
                                    <h3 className="text-base font-black text-[#0fb5ab]">৳{app.amount.toLocaleString('bn-BD')}</h3>
                                    <p className="text-[9px] text-slate-400 mt-0.5">সুদ: ৳০</p>
                                  </div>
                                </div>
                                <div className="border-t border-slate-50 pt-3 text-[11px] text-slate-600 space-y-1 font-noto">
                                  <p><strong className="text-slate-400 font-medium">ঋণের উদ্দেশ্য:</strong> {app.purpose}</p>
                                  <p><strong className="text-slate-400 font-medium">কিস্তি পরিকল্পনা:</strong> {app.installmentAmount}৳ / {app.installmentType === 'monthly' ? 'মাস' : 'সপ্তাহ'} ({app.totalInstallments} কিস্তি)</p>
                                  <p><strong className="text-slate-400 font-medium">জামিনদার:</strong> {app.guarantorName || 'নেই'} ({app.guarantorPhone || 'নেই'})</p>
                                </div>
                                <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
                                  {app.status === 'pending' && (
                                    <button type="button" onClick={() => handleStartVerification(app)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-black rounded-lg">যাচাই করুন</button>
                                  )}
                                  <button type="button" onClick={() => handleDeleteItem('qard_hasan', app.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* VERIFICATION AND APPROVAL TAB */}
                  {qardTab === 'verify' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div>
                        <h3 className="text-base font-black text-[#0fb5ab] font-noto">আবেদন যাচাই ও অনুমোদন</h3>
                        <p className="text-[10px] text-slate-400 font-bold">কমিটির জন্য আবেদন তদন্ত প্রতিবেদন এবং চূড়ান্ত ঋণ অনুমোদন প্যানেল</p>
                      </div>

                      <div className="space-y-4">
                        {qardHasanApplications.filter(a => a.status === 'pending' || a.status === 'verified').length === 0 ? (
                          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50">
                            <p className="text-xs text-slate-400 font-noto">যাচাই বা অনুমোদনের জন্য এই মুহূর্তে কোনো পেন্ডিং আবেদন নেই।</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {qardHasanApplications.filter(a => a.status === 'pending' || a.status === 'verified').map(app => (
                              <div key={app.id} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        app.status === 'verified' ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600'
                                      }`}>
                                        {app.status === 'verified' ? 'যাচাই সম্পন্ন' : 'যাচাই পেন্ডিং'}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold">{app.createdAt}</span>
                                    </div>
                                    <h4 className="text-sm font-black text-slate-800 font-noto mt-1">{app.name} ({app.phone})</h4>
                                    <p className="text-xs text-slate-500 mt-1 font-noto"><strong className="text-slate-400 font-medium">উদ্দেশ্য:</strong> {app.purpose}</p>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                                    <div className="flex sm:flex-col justify-between items-center sm:items-end w-full sm:w-auto">
                                      <span className="text-[8px] font-black text-slate-400 uppercase block">আবেদিত করজ</span>
                                      <div className="text-right">
                                        <h3 className="text-base sm:text-lg font-black text-[#0fb5ab]">৳{app.amount.toLocaleString('bn-BD')}</h3>
                                        <p className="text-[9px] text-slate-400">সুদ: ৳০ (সুদবিহীন)</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                      {app.status === 'pending' ? (
                                        <button type="button" onClick={() => handleStartVerification(app)} className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black shadow-sm text-center">যাচাই করুন</button>
                                      ) : (
                                        <button type="button" onClick={() => handleApproveQard(app.id)} className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm text-center">অনুমোদন দিন</button>
                                      )}
                                      <button type="button" onClick={() => handleRejectQard(app.id)} className="px-4 py-2.5 bg-red-50 text-red-500 border border-red-100 rounded-xl text-xs font-black">বাতিল</button>
                                    </div>
                                  </div>
                                </div>

                                {/* Verification Checklist Status if verified */}
                                {app.verifiedChecklist && (
                                  <div className="p-3.5 bg-slate-50 rounded-2xl grid grid-cols-3 gap-2 text-[10px] font-black text-slate-500 font-noto">
                                    <div className="flex items-center gap-1.5">
                                      <span className={app.verifiedChecklist.address ? "text-emerald-500" : "text-slate-300"}>●</span>
                                      <span>ঠিকানা ও পরিচয় সত্যতা: {app.verifiedChecklist.address ? 'সঠিক' : 'অসম্পূর্ণ'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={app.verifiedChecklist.income ? "text-emerald-500" : "text-slate-300"}>●</span>
                                      <span>আয়ের উৎস সত্যতা: {app.verifiedChecklist.income ? 'সঠিক' : 'অসম্পূর্ণ'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={app.verifiedChecklist.guarantor ? "text-emerald-500" : "text-slate-300"}>●</span>
                                      <span>জামিনদারের দায়িত্ব স্বীকার: {app.verifiedChecklist.guarantor ? 'হ্যাঁ' : 'না'}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ACTIVE LOANS & OUTSTANDING SUB-TAB */}
                  {qardTab === 'active' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div>
                        <h3 className="text-base font-black text-[#0fb5ab] font-noto">সক্রিয় ঋণ ও কিস্তি আদায়</h3>
                        <p className="text-[10px] text-slate-400 font-bold">অনুমোদিত করজে হাসানার কিস্তি আদায় এবং লাইভ বকেয়া ট্র্যাকার</p>
                      </div>

                      <div className="space-y-4">
                        {qardHasanApplications.filter(a => a.status === 'approved').length === 0 ? (
                          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                            <p className="text-xs text-slate-400 font-noto">এই মুহূর্তে কোনো সক্রিয় বা অনুমোদিত ঋণ নেই।</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {qardHasanApplications.filter(a => a.status === 'approved').map(app => {
                              const repayments = app.repayments || [];
                              const totalPaid = repayments.reduce((sum: number, r: any) => sum + r.amount, 0);
                              const outstanding = app.amount - totalPaid;
                              const isCompleted = outstanding <= 0;

                              return (
                                <div key={app.id} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                          isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-[#0fb5ab]/10 text-[#0fb5ab]'
                                        }`}>
                                          {isCompleted ? 'পরিশোধিত' : 'চলমান করজ'}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-bold">চুক্তি তারিখ: {app.agreementDate}</span>
                                      </div>
                                      <h4 className="text-sm font-black text-slate-800 font-noto leading-tight">{app.name}</h4>
                                      <p className="text-[10px] text-slate-400 font-medium">মোবাইল: {app.phone} | জামিনদার: {app.guarantorName}</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 sm:gap-6 text-center sm:text-right border-t border-b border-slate-50 py-3 lg:border-none lg:py-0">
                                      <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase block">ঋণের পরিমাণ</span>
                                        <h4 className="text-xs sm:text-sm font-black text-slate-700 mt-0.5">৳{app.amount.toLocaleString('bn-BD')}</h4>
                                      </div>
                                      <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase block">মোট পরিশোধিত</span>
                                        <h4 className="text-xs sm:text-sm font-black text-emerald-600 mt-0.5">৳{totalPaid.toLocaleString('bn-BD')}</h4>
                                      </div>
                                      <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase block">অবशिष्ट বকেয়া</span>
                                        <h4 className="text-xs sm:text-sm font-black text-rose-600 mt-0.5">৳{outstanding.toLocaleString('bn-BD')}</h4>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 w-full lg:w-auto">
                                      {!isCompleted && (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setSelectedQardForRepayment(app);
                                            setRepayAmount(app.installmentAmount.toString());
                                          }} 
                                          className="flex-1 lg:flex-none px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md text-center"
                                        >
                                          পরিশোধ রিসিভ
                                        </button>
                                      )}
                                      <button type="button" onClick={() => setSelectedQardForAgreement(app)} className="flex-1 lg:flex-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs font-black text-center">চুক্তিপত্র</button>
                                    </div>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="space-y-1">
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                        style={{ width: `${(totalPaid / app.amount) * 100}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold font-noto">
                                      <span>কিস্তি সম্পন্ন: {repayments.length} টি / {app.totalInstallments} টি</span>
                                      <span>বকেয়া: {outstanding.toLocaleString('bn-BD')} ৳</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* REPAYMENT HISTORY LEDGER */}
                  {qardTab === 'repayments' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div>
                        <h3 className="text-base font-black text-[#0fb5ab] font-noto">পরিশোধের ইতিহাস (Repayments Ledger)</h3>
                        <p className="text-[10px] text-slate-400 font-bold">ঋণ পরিশোধের সকল রসিদ এবং প্রাপ্ত কিস্তির খতিয়ান বিবরণী</p>
                      </div>

                      {/* Mobile Card List */}
                      <div className="space-y-3 sm:hidden">
                        {(() => {
                          const approvedApps = qardHasanApplications.filter(a => a.repayments && a.repayments.length > 0);
                          const allReps: { app: any, rep: any }[] = [];
                          approvedApps.forEach(app => {
                            (app.repayments || []).forEach((rep: any) => {
                              allReps.push({ app, rep });
                            });
                          });
                          
                          if (allReps.length === 0) {
                            return (
                              <div className="text-center py-12 bg-white border border-slate-100 rounded-3xl font-noto text-xs text-slate-400">
                                কোনো কিস্তি পরিশোধের ইতিহাস পাওয়া যায়নি।
                              </div>
                            );
                          }

                          return allReps.map(({ app, rep }) => (
                            <div key={rep.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3 font-noto text-slate-700 text-xs font-bold">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400">{rep.date}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono text-[9px]">{rep.receiptNo}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="font-black text-slate-800 text-sm">{app.name}</h4>
                                  <p className="text-[10px] text-slate-400">{app.phone}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-400 block">প্রাপ্ত পরিমাণ</span>
                                  <h4 className="text-sm font-black text-emerald-600">৳{rep.amount.toLocaleString('bn-BD')}</h4>
                                  <span className="text-[8px] text-slate-400 font-mono">সুদ: ৳০ (০%)</span>
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>

                      {/* Desktop Table view */}
                      <div className="hidden sm:block overflow-x-auto rounded-3xl border border-slate-100 bg-white">
                        <table className="w-full text-left border-collapse text-xs text-slate-800">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-wider font-noto border-b border-slate-100">
                              <th className="p-4">তারিখ (Date)</th>
                              <th className="p-4">রসিদ নং (Receipt)</th>
                              <th className="p-4">আবেদনকারী (Borrower)</th>
                              <th className="p-4">মোবাইল</th>
                              <th className="p-4 text-right">প্রাপ্ত পরিমাণ</th>
                              <th className="p-4 text-right">সুদ / জরিমানা</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const approvedApps = qardHasanApplications.filter(a => a.repayments && a.repayments.length > 0);
                              return approvedApps.map(app => (
                                app.repayments.map((rep: any) => {
                                  return (
                                    <tr key={rep.id} className="border-b border-slate-50 hover:bg-slate-50 font-bold text-slate-700 font-noto">
                                      <td className="p-4">{rep.date}</td>
                                      <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono text-[10px]">{rep.receiptNo}</span></td>
                                      <td className="p-4 font-black text-slate-800">{app.name}</td>
                                      <td className="p-4">{app.phone}</td>
                                      <td className="p-4 text-right text-emerald-600 font-black">৳{rep.amount.toLocaleString('bn-BD')}</td>
                                      <td className="p-4 text-right text-slate-400 font-mono">৳০ (০%)</td>
                                    </tr>
                                  );
                                })
                              ));
                            })()}
                            {qardHasanApplications.every(a => !a.repayments || a.repayments.length === 0) && (
                              <tr>
                                <td colSpan={6} className="text-center p-12 text-slate-400 font-noto">কোনো কিস্তি পরিশোধের ইতিহাস পাওয়া যায়নি।</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* GUARANTOR DIRECTORY TAB */}
                  {qardTab === 'guarantors' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div>
                        <h3 className="text-base font-black text-[#0fb5ab] font-noto">জামিনদার তালিকা (Guarantor Directory)</h3>
                        <p className="text-[10px] text-slate-400 font-bold">ঋণগ্রহীতাদের শরীয়াহ চুক্তির অধীন জামিনদার ব্যক্তিবর্গের খতিয়ান</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {qardHasanApplications.filter(a => a.guarantorName).map(app => (
                          <div key={app.id} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-3 font-noto text-slate-700">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#0fb5ab]/10 rounded-xl flex items-center justify-center text-[#0fb5ab]">
                                <Users size={18} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-800">{app.guarantorName}</h4>
                                <p className="text-[10px] text-slate-400 font-bold">মোবাইল: {app.guarantorPhone}</p>
                              </div>
                            </div>
                            <div className="border-t border-slate-50 pt-2 text-xs text-slate-500 leading-relaxed font-bold">
                              <span>জামিনদার কর্তৃক দায়বদ্ধ ব্যক্তি: </span>
                              <strong className="text-slate-800">{app.name}</strong>
                              <br />
                              <span>মোট জামিনের পরিমাণ: </span>
                              <strong className="text-[#0fb5ab]">৳{app.amount.toLocaleString('bn-BD')} (সুদ-মুক্ত)</strong>
                            </div>
                          </div>
                        ))}
                        {qardHasanApplications.filter(a => a.guarantorName).length === 0 && (
                          <div className="col-span-2 text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                            <p className="text-xs text-slate-400">এই মুহূর্তে কোনো জামিনদার রেজিস্ট্রি করা নেই।</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ISLAMIC AGREEMENTS DEEDS TAB */}
                  {qardTab === 'agreements' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div>
                        <h3 className="text-base font-black text-[#0fb5ab] font-noto">চুক্তিপত্র ও দলিল রেজিস্টার (Agreement Deeds)</h3>
                        <p className="text-[10px] text-slate-400 font-bold">শরীয়াহ-সম্মত সুদবিহীন করজে হাসানা চুক্তিপত্র বিবরণী</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {qardHasanApplications.filter(a => a.status === 'approved' || a.status === 'verified').map(app => (
                          <div key={app.id} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between text-slate-800">
                            <div className="font-noto">
                              <span className="text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Deed Code: {app.id.toUpperCase()}</span>
                              <h4 className="text-sm font-black text-slate-800 mt-2">{app.name} এর চুক্তিপত্র</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">পরিমাণ: ৳{app.amount.toLocaleString('bn-BD')} | সুদ: ৳০</p>
                            </div>
                            <button type="button" onClick={() => setSelectedQardForAgreement(app)} className="px-4 py-2 bg-slate-50 border border-slate-200 text-[#0fb5ab] rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-slate-100">
                              <FileText size={14} />
                              <span>দেখুন ও মুদ্রণ</span>
                            </button>
                          </div>
                        ))}
                        {qardHasanApplications.filter(a => a.status === 'approved' || a.status === 'verified').length === 0 && (
                          <div className="col-span-2 text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                            <p className="text-xs text-slate-400">চুক্তিপত্র দেখার জন্য কোনো অনুমোদিত বা যাচাইকৃত ঋণগ্রহীতা নেই।</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {selectedQardForRepayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[1.8rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 text-slate-800 overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-[#0fb5ab] font-noto">কিস্তি পরিশোধ রিসিভ</h3>
              <button type="button" onClick={() => setSelectedQardForRepayment(null)} className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-4 font-noto">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <span className="text-[9px] text-slate-400 uppercase font-black block">ঋণগ্রহীতার নাম</span>
                <span className="text-sm font-black text-slate-800">{selectedQardForRepayment.name}</span>
                <span className="text-[9px] text-slate-400 uppercase font-black block mt-2">নির্ধারিত কিস্তির পরিমাণ</span>
                <span className="text-sm font-black text-[#0fb5ab]">৳{selectedQardForRepayment.installmentAmount.toLocaleString('bn-BD')}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">পরিশোধের পরিমাণ (৳)</label>
                <input 
                  type="number" 
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-sm outline-none" 
                  value={repayAmount} 
                  onChange={(e) => setRepayAmount(e.target.value)} 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">রসিদ / ভাউচার নম্বর (ঐচ্ছিক)</label>
                <input 
                  type="text" 
                  placeholder=" RCP-101" 
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-sm outline-none" 
                  value={repayReceipt} 
                  onChange={(e) => setRepayReceipt(e.target.value)} 
                />
              </div>

              <button 
                type="button"
                onClick={handleRecordRepayment}
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-full shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest mt-6"
              >
                <CheckCircle2 size={16} />
                <span>পরিশোধ নিশ্চিত করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agreement Modal */}
      {selectedQardForAgreement && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 shadow-2xl border border-slate-100 my-4 sm:my-8 text-slate-800">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 no-print">
              <div className="flex items-center gap-2">
                <Shield className="text-[#0fb5ab]" size={20} />
                <h3 className="text-base font-black text-slate-800 font-noto">ইসলামী করজে হাসানা চুক্তিপত্র (Deed)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => window.print()} 
                  className="px-4 py-2 bg-[#0fb5ab] text-white rounded-xl text-xs font-black hover:bg-[#0e8a84] transition-colors"
                >
                  মুদ্রণ করুন (Print)
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedQardForAgreement(null)} 
                  className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Print Friendly Deed */}
            <div className="space-y-6 font-noto text-xs leading-relaxed text-slate-800 printable-deed p-4 border border-slate-200 rounded-3xl bg-slate-50/50">
              <div className="text-center space-y-2">
                <h2 className="text-lg font-black text-slate-900 font-noto">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</h2>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-noto">করজে হাসানা (সুদবিহীন ঋণ) চুক্তিপত্র ও অঙ্গীকারনামা</h3>
                <p className="text-[10px] text-slate-400 font-bold">দলিল আইডি: {selectedQardForAgreement.id.toUpperCase()}</p>
              </div>

              <div className="space-y-4 pt-4 text-justify font-noto">
                <p>
                  <strong>প্রথম পক্ষ (ঋণদাতা):</strong> {madrasah?.name || 'ইসলামী কল্যাণ সমিতি'}, ঠিকানা: {madrasah?.address || 'বাংলাদেশ'}।
                </p>
                <p>
                  <strong>দ্বিতীয় পক্ষ (ঋণগ্রহীতা):</strong> {selectedQardForAgreement.name}, মোবাইল নম্বর: {selectedQardForAgreement.phone}।
                </p>
                <p>
                  <strong>তৃতীয় পক্ষ (জামিনদার/গ্যারান্টর):</strong> {selectedQardForAgreement.guarantorName || 'N/A'}, মোবাইল নম্বর: {selectedQardForAgreement.guarantorPhone || 'N/A'}।
                </p>
                
                <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-1 mt-4">
                  <p><strong>১. ঋণের বিবরণী:</strong></p>
                  <p>ঋণের মোট পরিমাণ: <strong>৳{selectedQardForAgreement.amount.toLocaleString('bn-BD')}</strong></p>
                  <p>কিস্তি পরিশোধের ধরণ: <strong>{selectedQardForAgreement.installmentType === 'monthly' ? 'মাসিক' : 'সাপ্তাহিক'} কিস্তি</strong></p>
                  <p>কিস্তি সংখ্যা: <strong>{selectedQardForAgreement.totalInstallments} টি</strong></p>
                  <p>প্রতি কিস্তির পরিমাণ: <strong>৳{selectedQardForAgreement.installmentAmount.toLocaleString('bn-BD')}</strong></p>
                </div>

                <div className="space-y-2.5 mt-4">
                  <p><strong>২. শর্তাবলী ও ঘোষণা:</strong></p>
                  <p>ক) দ্বিতীয় পক্ষ (ঋণগ্রহীতা) স্বীকার করিতেছেন যে, তিনি প্রথম পক্ষের নিকট হইতে উপরোক্ত পরিমাণ করজে হাসানা (সুদবিহীন কল্যাণ ঋণ) গ্রহণ করিলেন এবং কিস্তির পরিকল্পনা অনুযায়ী নির্ধারিত সময়ে উহা পরিশোধ করিতে সম্পূর্ণ বাধ্য থাকিবেন।</p>
                  <p>খ) এই করজটি সম্পূর্ণ সুদবিহীন। প্রথম পক্ষ কখনো কোনো অবস্থাতেই অতিরিক্ত কোনো প্রকার সুদ, ফি, জরিমানা বা দণ্ডঋণ (Penalty) দাবি করিবে না, কারণ ইসলামে সকল প্রকার সুদের আদান-প্রদান এবং অতিরিক্ত জরিমানা আরোপ করা হারাম ও নিষিদ্ধ।</p>
                  <p>গ) দ্বিতীয় পক্ষ নির্ধারিত সময়ে কিস্তি পরিশোধে ব্যর্থ হইলে বা কোনো সমস্যার সম্মুখীন হইলে তাহা কমিটিকে জানাইবেন এবং শরীয়াহর নির্দেশ অনুযায়ী কিস্তি পরিশোধের সময় বৃদ্ধির সুযোগ প্রদান করা হইবে।</p>
                  <p>ঘ) তৃতীয় পক্ষ (জামিনদার) এই মর্মে অঙ্গীকার করিতেছেন যে, দ্বিতীয় পক্ষ নির্ধারিত সময়ে করজের টাকা পরিশোধে অসমর্থ বা ব্যর্থ হইলে, জামিনদার উহার সম্পূর্ণ দায়ভার বহন করিবেন এবং বকেয়া করজ পরিশোধের ব্যবস্থা করিবেন।</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8 pt-12 text-center text-[10px] font-black mt-12 border-t border-slate-100 font-noto">
                <div className="space-y-6">
                  <div className="h-10 border-b border-dashed border-slate-300" />
                  <p>দ্বিতীয় পক্ষ (ঋণগ্রহীতা)</p>
                </div>
                <div className="space-y-6">
                  <div className="h-10 border-b border-dashed border-slate-300" />
                  <p>তৃতীয় পক্ষ (জামিনদার)</p>
                </div>
                <div className="space-y-6">
                  <div className="h-10 border-b border-dashed border-slate-300" />
                  <p>প্রথম পক্ষ (কমিটি সভাপতি)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {selectedQardForVerification && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[1.8rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 text-slate-800 overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-[#0fb5ab] font-noto">আবেদন তথ্য যাচাই ও ফিল্ড রিপোর্ট</h3>
              <button type="button" onClick={() => setSelectedQardForVerification(null)} className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-5 font-noto">
              <div className="p-4 bg-slate-50 rounded-2xl text-xs font-bold text-slate-600">
                <p>আবেদনকারী: <strong className="text-slate-800">{selectedQardForVerification.name}</strong></p>
                <p>মোবাইল: <strong className="text-slate-800">{selectedQardForVerification.phone}</strong></p>
                <p>ঋণের পরিমাণ: <strong className="text-[#0fb5ab]">৳{selectedQardForVerification.amount.toLocaleString('bn-BD')}</strong></p>
              </div>

              <div className="space-y-3 pt-2">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">যাচাইকরণ চেকলিস্ট (Checklist)</h5>
                
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-[#0fb5ab]" 
                    checked={verifyAddress} 
                    onChange={(e) => setVerifyAddress(e.target.checked)} 
                  />
                  <div className="text-xs">
                    <p className="font-black text-slate-700">ঠিকানা ও সামাজিক পরিচয় সঠিক</p>
                    <p className="text-[9px] text-slate-400 font-bold">ঘর ও স্থায়ী ঠিকানা সরজমিনে সত্য পাওয়া গেছে</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-[#0fb5ab]" 
                    checked={verifyIncome} 
                    onChange={(e) => setVerifyIncome(e.target.checked)} 
                  />
                  <div className="text-xs">
                    <p className="font-black text-slate-700">আয়ের উৎস ও সততা সঠিক</p>
                    <p className="text-[9px] text-slate-400 font-bold">আয় এবং পরিশোধ ক্ষমতা শরীয়াহ অনুযায়ী হালাল ও সন্তোষজনক</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-[#0fb5ab]" 
                    checked={verifyGuarantor} 
                    onChange={(e) => setVerifyGuarantor(e.target.checked)} 
                  />
                  <div className="text-xs">
                    <p className="font-black text-slate-700">জামিনদারের অঙ্গীকার যাচাইকৃত</p>
                    <p className="text-[9px] text-slate-400 font-bold">জামিনদার দায়বদ্ধতা ও মোবাইল যাচাই সম্পন্ন হয়েছে</p>
                  </div>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-bold">تদন্তকারী কর্মকর্তার নাম / পদবী</label>
                <input 
                  type="text" 
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold outline-none" 
                  value={qardVerificationOfficer} 
                  onChange={(e) => setQardVerificationOfficer(e.target.value)} 
                />
              </div>

              <button 
                type="button"
                onClick={handleSaveVerification}
                className="w-full h-12 bg-[#0fb5ab] hover:bg-[#0e8a84] text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md mt-4"
              >
                রিপোর্ট সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
