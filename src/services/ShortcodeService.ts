
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

    // 2. Fetch Subscriptions (Current Month)
    const { data: fees } = await supabase
      .from('subscriptions')
      .select('member_id, amount_due, amount_paid')
      .eq('period', currentMonth)
      .in('member_id', studentIds);

    // 3. Fetch Latest Meeting
    const { data: latestMeeting } = await supabase
      .from('meetings')
      .select('title, date, time, location')
      .eq('institution_id', institutionId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Fetch Latest Event
    const { data: latestEvent } = await supabase
      .from('events')
      .select('title, date')
      .eq('institution_id', institutionId)
      .order('date', { ascending: false })
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
    return students.map(s => {
      const studentFees = fees?.find(f => f.member_id === s.id);
      
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
        due_amount: studentFees?.amount_due,
        paid_amount: studentFees?.amount_paid,
        meeting_title: latestMeeting?.title || '-',
        meeting_date: latestMeeting?.date || '-',
        meeting_time: latestMeeting?.time || '-',
        meeting_location: latestMeeting?.location || '-',
        event_title: latestEvent?.title || '-',
        event_date: latestEvent?.date || '-',
        month: currentMonth
      };
    });
  }
};
