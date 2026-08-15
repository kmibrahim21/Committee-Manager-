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
