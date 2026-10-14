import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Meeting, Member, MeetingSubject, Institution, SeatAssignment } from '../types';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import { MinutesSheetTemplate } from '../components/pdf/MinutesSheetTemplate';
import { DepartmentMinutesTemplate } from '../components/pdf/DepartmentMinutesTemplate';
import { DepartmentSubscriptionReportTemplate } from '../components/pdf/DepartmentSubscriptionReportTemplate';
import { SubscriptionReceiptTemplate } from '../components/pdf/SubscriptionReceiptTemplate';
import { FinalMinutesTemplate } from '../components/pdf/FinalMinutesTemplate';
import { SeatingPlanTemplate } from '../components/pdf/SeatingPlanTemplate';
import { MemberFormTemplate } from '../components/pdf/MemberFormTemplate';

let bengaliFontBase64: string | null = null;

const loadBengaliFont = async (doc: jsPDF) => {
    if (!bengaliFontBase64) {
        try {
            const response = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/unhinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf');
            if (!response.ok) {
                console.error("Failed to fetch Bengali font, status:", response.status);
                return;
            }
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            bengaliFontBase64 = window.btoa(binary);
            console.log("Bengali font loaded successfully, base64 length:", bengaliFontBase64.length);
        } catch (e) {
            console.error("Failed to load Bengali font", e);
            return;
        }
    }
    doc.addFileToVFS('NotoSansBengali.ttf', bengaliFontBase64);
    doc.addFont('NotoSansBengali.ttf', 'NotoSansBengali', 'normal');
    doc.setFont('NotoSansBengali');
};

// Helper: Load Image
const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
    });
};

// --- ADMIT CARD GENERATOR ---
// --- SEAT PLAN GENERATOR ---
export const generateSeatingPlanPDF = async (
    assignments: any[],
    madrasah: { name: string },
    templateId: string = 'list',
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<SeatingPlanTemplate assignments={assignments} madrasah={madrasah} templateId={templateId} lang={lang} />);
        setTimeout(resolve, 500); // Give more time for fonts/images
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // The template groups by room, so we can iterate over the room divs
    const wrapper = container.firstElementChild;
    if (wrapper && wrapper.children.length > 0) {
        const roomDivs = Array.from(wrapper.children);
        
        for (let i = 0; i < roomDivs.length; i++) {
            const roomElement = roomDivs[i] as HTMLElement;
            
            const imgData = await toPng(roomElement, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: 794, // A4 width at 96 DPI
                height: 1123, // A4 height at 96 DPI
            });

            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        }
    } else {
        // Fallback if structure is different
        const imgData = await toPng(container.firstElementChild as HTMLElement, {
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        });
        doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`seat-plan-${templateId}.pdf`);
};

// --- MINUTES GENERATOR ---
export const generateMinutesPDF = async (
    student: any,
    meeting: any,
    marks: any[],
    madrasah: { name: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<MinutesSheetTemplate student={student} exam={meeting} marks={marks} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Minutes_${student.name}.pdf`);
};

// --- DEPARTMENT MINUTES GENERATOR ---
export const generateDepartmentMinutesPDF = async (
    meeting: any,
    subjects: any[],
    students: any[],
    marksData: any,
    madrasah: { name: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<DepartmentMinutesTemplate exam={meeting} subjects={subjects} students={students} marksData={marksData} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 1123,
        height: 794,
    });

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Department_Minutes_${meeting.title}.pdf`);
};

// --- DEPARTMENT SUBSCRIPTION REPORT GENERATOR ---
export const generateDepartmentSubscriptionReportPDF = async (
    departmentName: string,
    month: string,
    students: any[],
    madrasah: { name: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<DepartmentSubscriptionReportTemplate className={departmentName} month={month} students={students} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Subscription-Report-${departmentName}-${month}.pdf`);
};

// --- INDIVIDUAL SUBSCRIPTION RECEIPT GENERATOR ---
export const generateSubscriptionReceiptPDF = async (
    member: any,
    month: string,
    madrasah: { name: string; address?: string; phone?: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<SubscriptionReceiptTemplate student={member} month={month} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Receipt-${member.name}-${month}.pdf`);
};

// --- FINAL MINUTES GENERATOR ---
export const generateFinalMinutesPDF = async (
    title: string,
    departmentName: string,
    subjects: string[],
    students: any[],
    madrasah: { name: string },
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<FinalMinutesTemplate title={title} className={departmentName} subjects={subjects} students={students} madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 1123,
        height: 794,
    });

    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Final_Minutes_${departmentName}.pdf`);
};

// --- BLANK OFFLINE MEMBER REGISTRATION FORM GENERATOR ---
export const generateMemberFormPDF = async (
    madrasah: Institution | null,
    lang: 'en' | 'bn' = 'en'
) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
        root.render(<MemberFormTemplate madrasah={madrasah} lang={lang} />);
        setTimeout(resolve, 500);
    });

    const imgData = await toPng(container.firstElementChild as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    
    root.unmount();
    document.body.removeChild(container);
    
    doc.save(`Blank-Member-Registration-Form.pdf`);
};

// --- MEETING SUMMARY & RESOLUTIONS PDF GENERATOR ---
export const generateMeetingMinutesPDF = async (
    meeting: any,
    madrasah: Institution | null,
    lang: 'en' | 'bn' = 'bn',
    agendas: any[] = [],
    decisions: any[] = [],
    attendanceMembers: any[] = [],
    attendanceRecords: Record<string, string> = {}
) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    await loadBengaliFont(doc);

    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header Title
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); // #1E3A8A
    const orgName = madrasah?.name || (lang === 'bn' ? 'কমিটি ব্যবস্থাপনা পরিষদ' : 'Committee Management Council');
    doc.text(orgName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.setTextColor(51, 65, 85);
    const docTitle = lang === 'bn' ? `মিটিং কার্যবিবরণী ও রেজোলিউশন` : `Meeting Minutes & Resolutions`;
    doc.text(docTitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Horizontal divider
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 8;

    // Meeting Info Box
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${lang === 'bn' ? 'সভার নাম:' : 'Meeting:'} ${meeting.title || 'N/A'}`, 15, yPos);
    yPos += 6;

    const formattedDate = meeting.date ? new Date(meeting.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US') : 'N/A';
    doc.text(`${lang === 'bn' ? 'তারিখ:' : 'Date:'} ${formattedDate}    |    ${lang === 'bn' ? 'সময়:' : 'Time:'} ${meeting.time || '10:00 AM'}`, 15, yPos);
    yPos += 6;

    doc.text(`${lang === 'bn' ? 'স্থান:' : 'Venue:'} ${meeting.venue || (lang === 'bn' ? 'প্রধান সভাকক্ষ' : 'Main Hall')}    |    ${lang === 'bn' ? 'কমিটি/শাখা:' : 'Group:'} ${meeting.departments?.name || (lang === 'bn' ? 'সাধারণ পরিষদ' : 'General')}`, 15, yPos);
    yPos += 10;

    // Attendance Summary
    const totalMem = attendanceMembers.length;
    const presentMem = attendanceMembers.filter(m => attendanceRecords[m.id] === 'present').length;
    const rate = totalMem > 0 ? Math.round((presentMem / totalMem) * 100) : 0;
    
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(15, yPos, pageWidth - 30, 12, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const attendanceSummaryText = lang === 'bn' 
        ? `মোট সদস্য: ${totalMem} জন | উপস্থিত: ${presentMem} জন | উপস্থিতির হার: ${rate}%`
        : `Total Members: ${totalMem} | Present: ${presentMem} | Attendance Rate: ${rate}%`;
    doc.text(attendanceSummaryText, pageWidth / 2, yPos + 7.5, { align: 'center' });
    yPos += 18;

    // Description / Objective
    if (meeting.description) {
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(lang === 'bn' ? 'মিটিং এর উদ্দেশ্য ও বিবরণ:' : 'Objective & Description:', 15, yPos);
        yPos += 6;

        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        const descLines = doc.splitTextToSize(meeting.description.replace(/---METADATA---[\s\S]*?---METADATA---/, '').trim(), pageWidth - 30);
        doc.text(descLines, 15, yPos);
        yPos += descLines.length * 5 + 6;
    }

    // Agendas
    if (agendas.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(lang === 'bn' ? 'আলোচ্য সূচি (Agendas):' : 'Agendas:', 15, yPos);
        yPos += 6;

        const agendaRows = agendas.map((ag, idx) => [
            (idx + 1).toString(),
            ag.topic || '',
            ag.is_completed ? (lang === 'bn' ? 'সম্পন্ন' : 'Completed') : (lang === 'bn' ? 'চলমান' : 'Pending')
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [[lang === 'bn' ? 'ক্রম' : '#', lang === 'bn' ? 'আলোচ্য বিষয়' : 'Topic', lang === 'bn' ? 'অবস্থা' : 'Status']],
            body: agendaRows,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, font: 'NotoSansBengali', fontSize: 9 },
            styles: { font: 'NotoSansBengali', fontSize: 9 },
            margin: { left: 15, right: 15 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Decisions / Resolutions
    if (decisions.length > 0) {
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text(lang === 'bn' ? 'গৃহীত সিদ্ধান্তসমূহ (Decisions):' : 'Decisions & Resolutions:', 15, yPos);
        yPos += 6;

        const decisionRows = decisions.map((dec, idx) => [
            (idx + 1).toString(),
            dec.title || dec.decision || '',
            dec.description || dec.responsible_person || (lang === 'bn' ? 'সাধারণ' : 'General')
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [[lang === 'bn' ? 'ক্রম' : '#', lang === 'bn' ? 'সিদ্ধান্ত' : 'Decision', lang === 'bn' ? 'দায়িত্বপ্রাপ্ত' : 'Assignee']],
            body: decisionRows,
            theme: 'grid',
            headStyles: { fillColor: [14, 165, 233], textColor: 255, font: 'NotoSansBengali', fontSize: 9 },
            styles: { font: 'NotoSansBengali', fontSize: 9 },
            margin: { left: 15, right: 15 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
    }

    // Signatures
    if (yPos > 245) { doc.addPage(); yPos = 20; }
    yPos = Math.max(yPos, 245);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(lang === 'bn' ? 'সাধারণ সম্পাদক' : 'General Secretary', 35, yPos, { align: 'center' });
    doc.text(lang === 'bn' ? 'সভাপতি / সভাপতিমন্ডলী' : 'President / Chairperson', pageWidth - 45, yPos, { align: 'center' });

    doc.save(`Meeting-Minutes-${(meeting.title || 'report').replace(/[^a-zA-Z0-9\u0980-\u09FF_-]/g, '_')}.pdf`);
};
