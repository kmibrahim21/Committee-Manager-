
import { supabase } from 'lib/supabase';

export const ShortcodeService = {
  /**
   * Replaces shortcodes in a message with student-specific data.
   */
  replaceShortcodes: (message: string, data: any): string => {
    if (!message) return '';
    
    const shortcodes: Record<string, any> = {
      '{name}': data.name || '-',
      '{member_id}': data.member_id_number || data.roll || '-',
      '{designation}': data.member_type_label || data.member_type || '-',
      '{due_amount}': data.due_amount !== undefined ? data.due_amount : '-',
      '{paid_amount}': data.paid_amount !== undefined ? data.paid_amount : '-',
      '{meeting_title}': data.meeting_title || '-',
      '{meeting_date}': data.meeting_date || '-',
      '{meeting_time}': data.meeting_time || '-',
      '{meeting_location}': data.meeting_location || '-',
      '{event_title}': data.event_title || '-',
      '{event_date}': data.event_date || '-',
      '{institution_name}': data.institution_name || '-',
    };

    let finalMessage = message;
    Object.entries(shortcodes).forEach(([code, value]) => {
      const regex = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      finalMessage = finalMessage.replace(regex, String(value));
    });

    return finalMessage;
  },

  /**
   * Fetches all necessary data for shortcode replacement for a list of students.
   */
  fetchShortcodeData: async (institutionId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return [];

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // 1. Fetch Members, Departments, and Institution Info
    const { data: students, error: studentError } = await supabase
      .from('members')
      .select(`
        id,
        name,
        roll,
        department_id,
        member_id_number,
        member_type,
        departments (name),
        institutions (name)
      `)
      .in('id', studentIds);

    if (studentError) {
      console.error('Error fetching member data for shortcodes:', studentError);
      return [];
    }

    // 2. Fetch Fees & Fee Structures (with fallback to subscriptions & subscription_structures)
    let feeStructures: any[] = [];
    const { data: fsData } = await supabase
      .from('fee_structures')
      .select('department_id, amount')
      .eq('institution_id', institutionId);
    if (fsData && fsData.length > 0) {
      feeStructures = fsData;
    } else {
      const { data: ssData } = await supabase
        .from('subscription_structures')
        .select('department_id, amount')
        .eq('institution_id', institutionId);
      if (ssData) feeStructures = ssData;
    }

    let fees: any[] = [];
    const { data: feesTableData } = await supabase
      .from('fees')
      .select('member_id, amount_paid, discount')
      .eq('month', currentMonth)
      .in('member_id', studentIds);

    if (feesTableData && feesTableData.length > 0) {
      fees = feesTableData;
    } else {
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('member_id, amount_due, amount_paid, discount')
        .eq('period', currentMonth)
        .in('member_id', studentIds);
      if (subsData) fees = subsData;
    }

    // 3. Fetch Latest Meeting
    const { data: latestMeeting } = await supabase
      .from('meetings')
      .select('title, date, time, venue')
      .eq('institution_id', institutionId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Fetch Latest Event
    const { data: latestEvent } = await supabase
      .from('events')
      .select('title, start_date')
      .eq('institution_id', institutionId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Mapping helper for member types in Bengali
    const memberTypeLabels: Record<string, string> = {
      'president': 'সভাপতি',
      'vice_president': 'সহ-সভাপতি',
      'secretary': 'সাধারণ সম্পাদক',
      'joint_secretary': 'যুগ্ম সাধারণ সম্পাদক',
      'organizing_secretary': 'সাংগঠনিক সম্পাদক',
      'treasurer': 'কোষাধ্যক্ষ',
      'member': 'কার্যকরী সদস্য',
      'general': 'সাধারণ সদস্য',
      'executive': 'নির্বাহী সদস্য',
      'adviser': 'উপদেষ্টা'
    };

    // Combine all data
    return students.map((s: any) => {
      const studentFeeRows = fees?.filter(f => f.member_id === s.id) || [];
      const paidAmount = studentFeeRows.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
      const discountAmount = studentFeeRows.reduce((sum, f) => sum + (Number(f.discount) || 0), 0);

      const applicableStructures = feeStructures.filter(
        fs => fs.department_id === s.department_id || fs.department_id === null
      );
      const totalPayable = applicableStructures.reduce((sum, fs) => sum + (Number(fs.amount) || 0), 0);

      const explicitDue = studentFeeRows.find(f => f.amount_due !== undefined)?.amount_due;
      const dueAmount = explicitDue !== undefined
        ? Number(explicitDue)
        : Math.max(0, totalPayable - (paidAmount + discountAmount));

      const mType = s.member_type || 'general';
      const mTypeLabel = memberTypeLabels[mType.toLowerCase()] || mType;

      return {
        id: s.id,
        name: s.name,
        roll: s.roll,
        member_id_number: s.member_id_number,
        member_type: s.member_type,
        member_type_label: mTypeLabel,
        department_name: (s.departments as any)?.name,
        institution_name: (s.institutions as any)?.name,
        due_amount: dueAmount,
        paid_amount: paidAmount,
        meeting_title: latestMeeting?.title || '-',
        meeting_date: latestMeeting?.date || '-',
        meeting_time: latestMeeting?.time || '-',
        meeting_location: latestMeeting?.venue || '-',
        event_title: latestEvent?.title || '-',
        event_date: latestEvent?.start_date ? new Date(latestEvent.start_date).toLocaleDateString('bn-BD') : '-',
        month: currentMonth
      };
    });
  }
};
