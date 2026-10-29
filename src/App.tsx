/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, LogOut, Settings, Search, Plus, Printer, 
  Trash2, FileSpreadsheet, Download, Upload, AlertTriangle, 
  ArrowRight, Save, X, FileText, CheckCircle2,
  AlertCircle, ArrowUp, RotateCcw, Info, Calendar, 
  ArrowLeft, Palette, Loader2, BarChart3, Moon, Sun, 
  Mic, Maximize2, Minimize2, WifiOff, Share2, 
  MessageSquare, CheckSquare, Check, Filter
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, persistentLocalCache, collection, 
  getDocs, addDoc, doc, updateDoc, deleteDoc, writeBatch, 
  onSnapshot, query, where, getCountFromServer, 
  enableNetwork, disableNetwork 
} from "firebase/firestore";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  signOut, User 
} from "firebase/auth";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==========================================
// FIREBASE CONFIG
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyC3Hyi-tVMui0ZyPsezvoxxSFjCJQBme9Q",
  authDomain: "ss-app-87ac7.firebaseapp.com",
  projectId: "ss-app-87ac7",
  storageBucket: "ss-app-87ac7.firebasestorage.app",
  messagingSenderId: "7671656513",
  appId: "1:7671656513:web:21b51edb450bddd1aad6c0",
  measurementId: "G-LQPLFRBGKH"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with Persistent Local Cache
const db = initializeFirestore(app, {
    localCache: persistentLocalCache()
});

const auth = getAuth(app);
const studentsCollection = collection(db, "students");

export interface Student {
  id: string;
  firstName: string;
  lastName?: string;
  regNumber: string;
  pageNumber: string;
  status?: 'active' | 'transferred' | 'left' | 'graduated';
  docDate?: string;          // تاريخ الوثيقة
  docDestination?: string;   // الجهة الصادرة إليها
  docPurpose?: string;       // الغرض من الوثيقة
  transferGrade?: string;    // الصف الذي انتقل فيه
  notes?: string;
  isDeleted?: boolean;
  createdAt: number;
  printIndex?: number;
}

// ==========================================
// UTILS
// ==========================================
const cleanName = (name?: string) => {
    if (!name) return "";
    return name.replace(/\s+\d+$/, '').trim();
};

const formatDateForInput = (timestamp?: number) => {
    if (!timestamp) return new Date().toISOString().split('T')[0];
    return new Date(timestamp).toISOString().split('T')[0];
};

const exportToExcel = (students: Student[]) => {
  const statusMap: Record<string, string> = { 'active': 'مستمر', 'transferred': 'منقول', 'left': 'تارك', 'graduated': 'متخرج' };
  const data = students.map(s => ({
    'الاسم الرباعي': cleanName(s.firstName),
    'العائلة': s.lastName || '',
    'رقم الصفحة': s.pageNumber,
    'رقم القيد': s.regNumber,
    'الحالة الدراسية': statusMap[s.status || 'active'] || 'مستمر',
    'تاريخ الوثيقة': s.docDate || '',
    'الصف الذي انتقل فيه': s.transferGrade || '',
    'الجهة الصادرة إليها': s.docDestination || '',
    'الغرض من الوثيقة': s.docPurpose || '',
    'ملاحظات': s.notes || '',
    'تاريخ التسجيل': new Date(s.createdAt).toLocaleDateString('ar-EG')
  }));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");
  XLSX.writeFile(workbook, "سجل_القيود_العام.xlsx");
};

const exportToPDF = (students: Student[], title = "سجل القيد العام") => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true
  });
  
  (doc as any).setLanguage?.("ar");
  (doc as any).setDirection?.("rtl");
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.text(title, 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}`, 105, 22, { align: 'center' });
  
  const statusMap: Record<string, string> = { 'active': 'مستمر', 'transferred': 'منقول', 'left': 'تارك', 'graduated': 'متخرج' };
  
  const tableData = students.map((s, index) => [
    index + 1,
    cleanName(s.firstName) + (s.lastName ? ` / ${s.lastName}` : ''),
    s.pageNumber,
    s.regNumber,
    statusMap[s.status || 'active']
  ]);
  
  autoTable(doc, {
    head: [['#', 'الاسم الكامل', 'رقم الصفحة', 'رقم القيد', 'الحالة']],
    body: tableData,
    startY: 30,
    styles: { font: 'helvetica', fontSize: 8, halign: 'right' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { top: 30, right: 10, bottom: 10, left: 10 },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.1,
  });
  
  doc.save(`سجل_الطلاب_${new Date().getTime()}.pdf`);
};


const readExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
        resolve(jsonData);
      } catch (err) { reject(err); }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

// ==========================================
// UI COMPONENTS
// ==========================================
const SkeletonLoader = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 h-20"></div>
      ))}
    </div>
    <div className="bg-white p-2 rounded-xl border border-slate-100 h-12"></div>
  </div>
);

const Modal = ({ children, onClose, zIndex = "z-50" }: { children: React.ReactNode; onClose: () => void; zIndex?: string }) => (
  <div 
    className={`fixed inset-0 bg-slate-900/60 ${zIndex} flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm overflow-y-auto modal-overlay`} 
    onClick={onClose}
    style={{ left: 0, top: 0, right: 0, bottom: 0, width: '100%', minHeight: '100%' }}
  >
    <div 
      className="w-full max-w-lg relative my-auto mx-auto" 
      onClick={e => e.stopPropagation()}
    >
        <button 
            onClick={onClose} 
            className="absolute top-2.5 left-2.5 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full shadow-md transition-all z-[60]"
            title="إغلاق"
            type="button"
        >
            <X size={18} />
        </button>
        {children}
    </div>
  </div>
);

const AlertModal = ({ message, type, onClose }: { message: string; type: 'error' | 'success' | 'warning'; onClose: () => void }) => (
  <Modal onClose={onClose} zIndex="z-[60]">
    <div className="bg-white rounded-2xl p-5 text-center shadow-2xl animate-slide-up">
      <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3 ${type === 'error' ? 'bg-red-100 text-red-500' : type === 'warning' ? 'bg-amber-100 text-amber-500' : 'bg-green-100 text-green-500'}`}>
        {type === 'error' ? <AlertCircle size={24} /> : type === 'warning' ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
      </div>
      <p className="text-slate-800 font-bold mb-5 text-sm">{message}</p>
      <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm">حسناً</button>
    </div>
  </Modal>
);

const ConfirmModal = ({ title, message, onConfirm, onCancel, isDestructive = false }: { title: string; message: string; onConfirm: () => void; onCancel: () => void; isDestructive?: boolean }) => (
  <Modal onClose={onCancel} zIndex="z-[60]">
    <div className="bg-white rounded-2xl p-5 text-center shadow-2xl animate-slide-up">
      <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 mb-6 text-sm">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm">إلغاء</button>
        <button onClick={onConfirm} className={`flex-1 py-2.5 text-white rounded-xl font-bold text-sm ${isDestructive ? 'bg-red-500' : 'bg-blue-600'}`}>تأكيد</button>
      </div>
    </div>
  </Modal>
);

const StatCard = ({ title, value, icon, colorClass, onClick, tooltip }: { title: string; value: number | string; icon: React.ReactNode; colorClass: string; onClick?: () => void; tooltip?: string }) => (
  <div 
    onClick={onClick} 
    data-tooltip={tooltip}
    className={`bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center gap-1.5 hover:shadow-md transition-all ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
  >
    <div className={`p-2 rounded-xl ${colorClass} text-white shadow-md`}>{icon}</div>
    <div>
      <div className="text-xl font-black text-slate-800 font-mono">{value}</div>
      <div className="text-[10px] text-slate-500 font-bold">{title}</div>
    </div>
  </div>
);

// Single Student Print (بطاقة الطالب الشخصية المطبوعة) - Swapped Page and Reg
const SingleStudentPrint = ({ student }: { student: Student }) => {
  const statusLabels: Record<string, string> = { 'active': 'مستمر', 'transferred': 'منقول', 'left': 'تارك', 'graduated': 'متخرج' };
  const printDate = new Date().toLocaleDateString('ar-EG');
  return (
    <div className="hidden print:flex flex-col items-center justify-start w-full h-screen bg-white p-0 overflow-hidden">
      <div className="w-[190mm] h-[250mm] border-[6px] border-double border-slate-800 p-6 rounded-none relative overflow-hidden flex flex-col justify-between mx-auto mt-0 shadow-none">
        <div className="absolute top-2 right-2 w-16 h-16 border-t-4 border-r-4 border-slate-900"></div>
        <div className="absolute top-2 left-2 w-16 h-16 border-t-4 border-l-4 border-slate-900"></div>
        <div className="absolute bottom-2 right-2 w-16 h-16 border-b-4 border-r-4 border-slate-900"></div>
        <div className="absolute bottom-2 left-2 w-16 h-16 border-b-4 border-l-4 border-slate-900"></div>

        <div className="text-center border-b-2 border-slate-900 pb-4 mb-4 relative z-10">
          <div className="flex justify-between items-start mb-2 px-2">
            <div className="text-sm font-bold leading-relaxed">جمهورية العراق<br/>وزارة التربية<br/>المديرية العامة للتربية</div>
            <div className="w-20 h-20 border-2 border-slate-800 rounded-full flex items-center justify-center bg-slate-50 shadow-sm"><span className="text-3xl">🎓</span></div>
            <div className="text-sm font-bold leading-relaxed text-left">التاريخ: {printDate}<br/>العدد: ............</div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mt-4 font-cairo tracking-wide">بطاقة الطالب الشخصية</h1>
          <p className="text-lg font-bold text-slate-600 mt-2 bg-slate-100 inline-block px-6 py-1 rounded-full border border-slate-300">نسخة طبق الأصل من سجل القيد</p>
        </div>

        <div className="flex-1 flex flex-col gap-4 justify-start pt-2 px-4 relative z-10">
           <div className="text-center space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-lg font-bold text-slate-500 block">الاسم الرباعي والعائلة</span>
              <div className="text-3xl font-black text-slate-900 pb-1">{cleanName(student.firstName)} {student.lastName || ''}</div>
           </div>

           {/* SWAPPED: Page Number first, then Registration Number */}
           <div className="grid grid-cols-2 gap-6 my-2">
              <div className="border-2 border-slate-800 p-4 text-center rounded-xl bg-white shadow-[2px_2px_0px_0px_rgba(30,41,59,1)]">
                <span className="text-base font-bold text-slate-600 uppercase block mb-1">رقم الصفحة</span>
                <div className="text-5xl font-mono font-black text-slate-900 tracking-wider">{student.pageNumber}</div>
              </div>
              <div className="border-2 border-slate-800 p-4 text-center rounded-xl bg-white shadow-[2px_2px_0px_0px_rgba(30,41,59,1)]">
                <span className="text-base font-bold text-slate-600 uppercase block mb-1">رقم القيد العام</span>
                <div className="text-5xl font-mono font-black text-slate-900 tracking-wider">{student.regNumber}</div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-6 text-right px-2 mt-2">
              <div className="flex flex-col border-b-2 border-slate-200 pb-2">
                 <span className="text-base font-bold text-slate-500 mb-1">الوضع الأكاديمي</span>
                 <span className="text-2xl font-bold text-slate-900">{statusLabels[student.status || 'active']}</span>
              </div>
              <div className="flex flex-col border-b-2 border-slate-200 pb-2">
                 <span className="text-base font-bold text-slate-500 mb-1">تاريخ القيد</span>
                 <span className="text-2xl font-bold text-slate-900 font-mono">{new Date(student.createdAt).toLocaleDateString('ar-EG')}</span>
              </div>
              {student.status === 'transferred' && (
                <div className="col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-300 mt-1 grid grid-cols-2 gap-3 text-right">
                   <div className="col-span-2 text-sm font-black text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
                     <span>بيانات النقل والوثيقة الصادرة</span>
                     <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded font-bold">طالب منقول</span>
                   </div>
                   <div>
                     <span className="text-xs font-bold text-slate-600 block">تاريخ الوثيقة:</span>
                     <span className="text-base font-bold text-slate-900 font-mono">{student.docDate || '—'}</span>
                   </div>
                   <div>
                     <span className="text-xs font-bold text-slate-600 block">الصف الذي انتقل فيه:</span>
                     <span className="text-base font-bold text-slate-900">{student.transferGrade || '—'}</span>
                   </div>
                   <div>
                     <span className="text-xs font-bold text-slate-600 block">الجهة الصادرة إليها:</span>
                     <span className="text-base font-bold text-slate-900">{student.docDestination || '—'}</span>
                   </div>
                   <div>
                     <span className="text-xs font-bold text-slate-600 block">الغرض من الوثيقة:</span>
                     <span className="text-base font-bold text-slate-900">{student.docPurpose || '—'}</span>
                   </div>
                </div>
              )}
              {student.notes && (
                <div className="col-span-2 flex flex-col bg-yellow-50 p-3 rounded-xl border border-yellow-200 mt-1">
                   <span className="text-xs font-bold text-yellow-700 mb-1">ملاحظات</span>
                   <span className="text-lg font-bold text-slate-800">{student.notes}</span>
                </div>
              )}
           </div>
        </div>

        <div className="mt-4 pt-4 border-t-2 border-slate-900 flex justify-between items-end px-8 pb-4 relative z-10">
           <div className="text-center"><div className="h-16"></div><div className="font-bold text-lg text-slate-900 border-t-2 border-slate-900 pt-2 w-40 mx-auto">توقيع الموظف المختص</div></div>
           <div className="text-center"><div className="h-16"></div><div className="font-bold text-lg text-slate-900 border-t-2 border-slate-900 pt-2 w-40 mx-auto">ختم وتوقيع المدير</div></div>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0 select-none">
             <div className="transform -rotate-45 text-[150px] font-black text-slate-900 whitespace-nowrap border-4 border-slate-900 p-12 rounded-3xl">وثيقة رسمية</div>
        </div>
      </div>
    </div>
  );
};

// General Print View - Swapped 'ص' and 'قيد'
const PrintView = ({ students, title, selectedFields = ['name', 'pageNumber', 'regNumber'] }: { students: Student[]; title?: string; selectedFields?: string[] }) => {
  const sortedStudents = useMemo(() => {
     return [...students].sort((a, b) => a.firstName.localeCompare(b.firstName)).map((s, i) => ({ ...s, printIndex: i + 1 }));
  }, [students]);

  const ROWS_PER_COLUMN_MAX = 31; 
  const COLUMNS_PER_PAGE = 2;
  const MAX_ITEMS_PER_PAGE = ROWS_PER_COLUMN_MAX * COLUMNS_PER_PAGE;
  const totalItems = sortedStudents.length;
  const totalPages = Math.ceil(totalItems / MAX_ITEMS_PER_PAGE) || 1;
  const printDate = new Date().toLocaleDateString('ar-EG');
  
  const pages = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(sortedStudents.slice(i * MAX_ITEMS_PER_PAGE, (i + 1) * MAX_ITEMS_PER_PAGE));
  }
  
  return (
    <div className="print-only text-[9.5pt] dir-rtl">
      {pages.map((pageStudents, pageIndex) => (
        <div key={pageIndex} className="print-page-container">
           <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-4 w-full h-[40px]">
              <div className="text-[10px] font-medium text-gray-500 w-32 text-right">صفحة {pageIndex + 1} من {totalPages}</div>
              <h1 className="text-xl font-bold flex-1 text-center">{title || "كشف القيد العام"}</h1>
              <div className="text-[10px] font-medium text-gray-500 w-32 text-left">تاريخ: {printDate}</div>
           </div>
           <div className="flex flex-row gap-[8mm] flex-1">
             {[0, 1].map((colIndex) => {
               const colStudents = pageStudents.slice(colIndex * ROWS_PER_COLUMN_MAX, (colIndex + 1) * ROWS_PER_COLUMN_MAX);
               return (
                 <div key={colIndex} className="flex-1 flex flex-col">
                   <table className="w-full border-collapse table-fixed">
                     <thead>
                       <tr className="bg-gray-100 h-[36px]">
                         <th className="p-1 text-center w-[35px] text-[8.5pt]">ت</th>
                         {selectedFields.includes('name') && <th className="p-1 text-right">الاسم الكامل</th>}
                         {selectedFields.includes('lastName') && <th className="p-1 text-right">اللقب</th>}
                         {/* SWAPPED: Page Number before Registration Number */}
                         {selectedFields.includes('pageNumber') && <th className="p-1 text-center w-[40px] font-bold text-[8.5pt]">ص</th>}
                         {selectedFields.includes('regNumber') && <th className="p-1 text-center w-[40px] font-bold text-[8.5pt]">قيد</th>}
                         {selectedFields.includes('status') && <th className="p-1 text-center w-[50px] font-bold text-[8.5pt]">الحالة</th>}
                        </tr>
                     </thead>
                     <tbody>
                       {Array.from({ length: ROWS_PER_COLUMN_MAX }).map((_, rowIndex) => {
                         const s = colStudents[rowIndex];
                         const statusMap: Record<string, string> = { 'active': 'م', 'transferred': 'ن', 'left': 'ت', 'graduated': 'خ' };
                         return (
                           <tr key={rowIndex} className="h-[31px]">
                             <td className="px-1 text-center font-medium whitespace-nowrap">{s ? s.printIndex : ''}</td>
                             {selectedFields.includes('name') && (
                               <td className="px-2 align-middle whitespace-nowrap overflow-hidden leading-relaxed font-bold">{s ? cleanName(s.firstName) : ''}</td>
                             )}
                             {selectedFields.includes('lastName') && (
                               <td className="px-2 align-middle whitespace-nowrap overflow-hidden leading-relaxed font-bold">{s ? s.lastName || '' : ''}</td>
                             )}
                             {/* SWAPPED: Page Number cell before Registration Number cell */}
                             {selectedFields.includes('pageNumber') && (
                               <td className="px-1 text-center font-bold font-mono text-[10.5pt] align-middle">{s ? s.pageNumber : ''}</td>
                             )}
                             {selectedFields.includes('regNumber') && (
                               <td className="px-1 text-center font-bold font-mono text-[10.5pt] align-middle">{s ? s.regNumber : ''}</td>
                             )}
                             {selectedFields.includes('status') && (
                               <td className="px-1 text-center font-bold font-mono text-[10.5pt] align-middle">{s ? statusMap[s.status || 'active'] : ''}</td>
                             )}
                            </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               );
             })}
           </div>
        </div>
      ))}
    </div>
  );
};

// Outgoing Documents Log Print View (طباعة صادر الوثائق - ث. ش. محمد عبدالعزيز الكنعان للبنين)
const DocsExportPrint = ({ 
  students, 
  selectedYear, 
  sortBy = 'byDate',
  orientation = 'landscape'
}: { 
  students: Student[]; 
  selectedYear: string; 
  sortBy?: 'byDate' | 'alphabetical' | 'byGradeAlpha';
  orientation?: 'portrait' | 'landscape';
}) => {
  const isPortrait = orientation === 'portrait';

  useEffect(() => {
    let styleEl = document.getElementById('docs-page-orientation-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'docs-page-orientation-style';
      document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = isPortrait 
      ? `@page { size: A4 portrait; margin: 4mm 4mm; }`
      : `@page { size: A4 landscape; margin: 4mm 5mm; }`;

    if (!isPortrait) {
      document.body.classList.add('print-landscape');
    } else {
      document.body.classList.remove('print-landscape');
    }
    return () => {
      document.body.classList.remove('print-landscape');
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [isPortrait]);

  const transferredStudents = useMemo(() => {
    let list = students.filter(s => !s.isDeleted && (s.status === 'transferred' || !!s.docDestination || !!s.docDate));
    if (selectedYear !== 'ALL') {
      list = list.filter(s => {
        const yearFromDoc = s.docDate ? s.docDate.substring(0, 4) : '';
        const yearFromCreated = new Date(s.createdAt).getFullYear().toString();
        return yearFromDoc === selectedYear || (!yearFromDoc && yearFromCreated === selectedYear);
      });
    }

    const gradeOrder: Record<string, number> = {
      'الأول متوسط': 1,
      'الثاني متوسط': 2,
      'الثالث متوسط': 3,
      'الرابع علمي': 4,
      'الخامس علمي': 5,
      'السادس علمي': 6,
      'الرابع أدبي': 7,
      'الخامس أدبي': 8,
      'السادس أدبي': 9,
    };

    return list.sort((a, b) => {
      if (sortBy === 'byDate') {
        const dateA = a.docDate || new Date(a.createdAt).toISOString().split('T')[0];
        const dateB = b.docDate || new Date(b.createdAt).toISOString().split('T')[0];
        const comp = dateA.localeCompare(dateB);
        if (comp !== 0) return comp;
        return cleanName(a.firstName).localeCompare(cleanName(b.firstName), 'ar');
      } else if (sortBy === 'alphabetical') {
        return cleanName(a.firstName).localeCompare(cleanName(b.firstName), 'ar');
      } else if (sortBy === 'byGradeAlpha') {
        const orderA = gradeOrder[a.transferGrade || ''] || 99;
        const orderB = gradeOrder[b.transferGrade || ''] || 99;
        if (orderA !== orderB) return orderA - orderB;
        const compGrade = (a.transferGrade || '').localeCompare(b.transferGrade || '', 'ar');
        if (compGrade !== 0) return compGrade;
        return cleanName(a.firstName).localeCompare(cleanName(b.firstName), 'ar');
      }
      return 0;
    });
  }, [students, selectedYear, sortBy]);

  // 30 names per page as requested by user
  const ROWS_PER_PAGE = 30;
  const totalItems = transferredStudents.length;
  const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE) || 1;
  const printDate = new Date().toLocaleDateString('ar-EG');
  
  const pages: Student[][] = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(transferredStudents.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE));
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <div className="print-only text-[10pt] dir-rtl font-cairo">
      <style>{`
        @page {
          size: ${isPortrait ? 'A4 portrait' : 'A4 landscape'};
          margin: ${isPortrait ? '4mm 4mm' : '4mm 5mm'};
        }
        @media print {
          html, body {
            width: ${isPortrait ? '210mm' : '297mm'} !important;
            max-width: ${isPortrait ? '210mm' : '297mm'} !important;
            min-width: ${isPortrait ? '210mm' : '297mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .docs-print-page {
            width: ${isPortrait ? '202mm' : '287mm'} !important;
            height: ${isPortrait ? '287mm' : '201mm'} !important;
            max-height: ${isPortrait ? '287mm' : '201mm'} !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: ${isPortrait ? '2mm 3mm' : '1.5mm 3mm'} !important;
            background: white !important;
            overflow: hidden !important;
          }
          .docs-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .docs-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .docs-table th, .docs-table td {
            border: 1px solid #0f172a !important;
            color: #0f172a !important;
            vertical-align: middle !important;
          }
          .docs-table th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
            font-size: ${isPortrait ? '8pt' : '8.5pt'} !important;
            height: ${isPortrait ? '22px' : '21px'} !important;
            padding: 1px 3px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .docs-table td {
            font-size: ${isPortrait ? '7.8pt' : '8.2pt'} !important;
            height: ${isPortrait ? '21px' : '19.8px'} !important;
            line-height: 1.15 !important;
            padding: 0 3px !important;
          }
          .docs-page-footer {
            height: 18px !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      
      {pages.map((pageRows, pageIdx) => (
        <div key={pageIdx} className="docs-print-page">
          <div className="flex-1 flex flex-col">
            {/* Official Header */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1.5 mb-1.5">
              {/* Right: Only Directorate and Department */}
              <div className="text-right text-[8.5pt] font-bold leading-tight text-slate-800 w-56">
                <div>جمهورية العراق</div>
                <div>وزارة التربية</div>
                <div>المديرية العامة لتربية البصرة</div>
                <div>قسم تربية أبي الخصيب</div>
              </div>

              {/* Center: Title + School Name + Years without word الدراسية */}
              <div className="text-center flex-1 px-2">
                <div className="text-xl font-black text-slate-900 tracking-wide font-cairo">
                  سجل صادر الوثائق
                </div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">
                  ث. ش. محمد عبدالعزيز الكنعان للبنين
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-[8.5pt] font-bold text-slate-700 bg-slate-100 inline-block px-3 py-0.5 rounded-full border border-slate-300">
                    {selectedYear === 'ALL' ? 'جميع السنوات' : `للسنة: ${selectedYear}`}
                  </span>
                  <span className="text-[8pt] font-bold text-slate-600 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    {sortBy === 'byDate' ? 'الترتيب: حسب تاريخ الوثيقة' : sortBy === 'alphabetical' ? 'الترتيب: حسب الأبجدية' : 'الترتيب: أبجدياً حسب الصف'}
                  </span>
                </div>
              </div>

              {/* Left: Date + Total count */}
              <div className="text-left text-[8.5pt] font-bold leading-tight text-slate-800 w-56">
                <div>تاريخ الطباعة: {printDate}</div>
                <div>إجمالي الوثائق: {totalItems}</div>
              </div>
            </div>

            {/* Official Table */}
            <table className="docs-table w-full">
              <thead>
                <tr className="bg-slate-100 text-center">
                  <th style={{ width: '30px' }} className="text-center font-bold">ت</th>
                  <th style={{ width: isPortrait ? '82px' : '92px' }} className="text-center font-bold">تاريخ الوثيقة</th>
                  <th style={{ width: isPortrait ? '195px' : '265px' }} className="text-right font-bold pr-2">اسم الطالب الرباعي</th>
                  <th style={{ width: isPortrait ? '150px' : '230px' }} className="text-right font-bold pr-2">الجهة الصادر إليها</th>
                  <th style={{ width: isPortrait ? '95px' : '130px' }} className="text-center font-bold">الغرض من الوثيقة</th>
                  <th style={{ width: isPortrait ? '95px' : '135px' }} className="text-center font-bold">الصف الذي انتقل فيه</th>
                  <th style={{ width: isPortrait ? '80px' : '130px' }} className="text-center font-bold">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROWS_PER_PAGE }).map((_, rIdx) => {
                  const s = pageRows[rIdx];
                  const serial = pageIdx * ROWS_PER_PAGE + rIdx + 1;
                  return (
                    <tr key={rIdx} style={{ height: isPortrait ? '21px' : '19.8px' }}>
                      <td className="text-center font-bold font-mono">{s ? serial : ''}</td>
                      <td className="text-center font-mono font-bold">{s ? (s.docDate || '—') : ''}</td>
                      <td className="text-right font-bold whitespace-nowrap overflow-hidden pr-2">
                        {s ? `${cleanName(s.firstName)} ${s.lastName || ''}`.trim() : ''}
                      </td>
                      <td className="text-right font-medium whitespace-nowrap overflow-hidden pr-2">{s ? (s.docDestination || '—') : ''}</td>
                      <td className="text-center font-medium">{s ? (s.docPurpose || '—') : ''}</td>
                      <td className="text-center font-bold">{s ? (s.transferGrade || '—') : ''}</td>
                      <td className="text-center"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Page Sequence Footer anchored on the SAME page */}
          <div className="docs-page-footer pt-1 border-t-2 border-slate-900 mt-0.5 flex justify-between items-center px-4 text-xs font-bold text-slate-700">
            <div className="text-[8.5pt] font-bold text-slate-800">سجل صادر الوثائق - ث. ش. محمد عبدالعزيز الكنعان للبنين</div>
            <div className="text-[9pt] font-black text-slate-900 bg-slate-100 px-3 py-0.5 rounded border border-slate-400 font-mono">
              صفحة {pageIdx + 1} من {totalPages}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch { setError('البريد الإلكتروني أو كلمة المرور غير صحيحة'); } 
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"><Users className="w-8 h-8 text-white" /></div>
          <h2 className="text-2xl font-bold text-slate-800">الدخول إلى النظام</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-left bg-slate-50" dir="ltr" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-left bg-slate-50" dir="ltr" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg transition-all">{loading ? 'جاري التحقق...' : 'دخول'}</button>
        </form>
      </div>
    </div>
  );
};

const themeColors: Record<string, { primary: string; hover: string; secondary: string; secondaryHover: string; ring: string; name: string }> = {
  slate: { primary: 'bg-slate-900', hover: 'hover:bg-slate-800', secondary: 'bg-blue-600', secondaryHover: 'hover:bg-blue-700', ring: 'focus:ring-blue-500', name: 'الأساسي (أزرق)' },
  purple: { primary: 'bg-violet-900', hover: 'hover:bg-violet-800', secondary: 'bg-purple-600', secondaryHover: 'hover:bg-purple-700', ring: 'focus:ring-purple-500', name: 'بنفسجي' },
  emerald: { primary: 'bg-teal-900', hover: 'hover:bg-teal-800', secondary: 'bg-emerald-600', secondaryHover: 'hover:bg-emerald-700', ring: 'focus:ring-emerald-500', name: 'أخضر' },
  rose: { primary: 'bg-rose-900', hover: 'hover:bg-rose-800', secondary: 'bg-red-600', secondaryHover: 'hover:bg-red-700', ring: 'focus:ring-red-500', name: 'أحمر' },
  amber: { primary: 'bg-amber-900', hover: 'hover:bg-amber-800', secondary: 'bg-orange-600', secondaryHover: 'hover:bg-orange-700', ring: 'focus:ring-orange-500', name: 'برتقالي' },
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'detail' | 'trash' | 'settings' | 'stats'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(''); 
  const [selectedRegFilter, setSelectedRegFilter] = useState(''); 
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printRegInput, setPrintRegInput] = useState('');
  const [visibleCount, setVisibleCount] = useState(150);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [printMode, setPrintMode] = useState<'list' | 'single' | 'selected' | 'docsExport'>('list');
  const [docsExportYear, setDocsExportYear] = useState<string>('ALL');
  const [docsExportSort, setDocsExportSort] = useState<'byDate' | 'alphabetical' | 'byGradeAlpha'>('byDate');
  const [docsOrientation, setDocsOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [alertConfig, setAlertConfig] = useState<{ message: string; type: 'error' | 'success' | 'warning' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void; isDestructive?: boolean } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [similarStudents, setSimilarStudents] = useState<Student[]>([]);
  const [colorTheme, setColorTheme] = useState(localStorage.getItem('appTheme') || 'slate');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [showThemeModal, setShowThemeModal] = useState(false);
  
  // Enhanced features
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isListening, setIsListening] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showPrintTemplateModal, setShowPrintTemplateModal] = useState(false);
  const [printTemplateFields, setPrintTemplateFields] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('printTemplateFields');
      return saved ? JSON.parse(saved) : ['name', 'pageNumber', 'regNumber'];
    } catch {
      return ['name', 'pageNumber', 'regNumber'];
    }
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('');
  const [shareStudents, setShareStudents] = useState<Student[]>([]);
  const [showPrintSelectedModal, setShowPrintSelectedModal] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [formStatus, setFormStatus] = useState<string>('active');
  const [formTransferGrade, setFormTransferGrade] = useState<string>('');
  const [docPurposeType, setDocPurposeType] = useState<string>('إكمال الدراسة');
  const [customDocPurpose, setCustomDocPurpose] = useState<string>('');
  const [customRegs, setCustomRegs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('customRegs') || '[]'); } catch { return []; }
  });
  const [showAddRegModal, setShowAddRegModal] = useState(false);
  const [newRegInput, setNewRegInput] = useState('');
  const [savedStudentName, setSavedStudentName] = useState<{ name: string; page: string; reg: string } | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showSearchFilters, setShowSearchFilters] = useState(false);

  const inSearchMode = isSearchActive || search.trim().length > 0;
  const currentTheme = themeColors[colorTheme] || themeColors.slate;

  // Group students by first letter for display only
  const filteredForGroups = useMemo(() => {
    let res = students.filter(s => view === 'trash' ? s.isDeleted : !s.isDeleted);
    if (selectedRegFilter) res = res.filter(s => s.regNumber === selectedRegFilter);
    if (yearFilter !== 'ALL') res = res.filter(s => new Date(s.createdAt).getFullYear().toString() === yearFilter);
    if (statusFilter !== 'ALL') res = res.filter(s => (s.status || 'active') === statusFilter);
    if (debouncedQuery) {
       const q = debouncedQuery.toLowerCase();
       res = res.filter(s => `${s.firstName} ${s.lastName || ''}`.toLowerCase().includes(q));
    }
    return res;
  }, [students, view, selectedRegFilter, yearFilter, statusFilter, debouncedQuery]);
  
  const studentsByLetter = useMemo(() => {
    const groups: Record<string, Student[]> = {};
    const sorted = [...filteredForGroups].sort((a, b) => a.firstName.localeCompare(b.firstName));
    
    sorted.forEach(student => {
      const firstChar = student.firstName.charAt(0);
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(student);
    });
    
    return groups;
  }, [filteredForGroups]);

  const alphabetLetters = useMemo(() => {
    return Object.keys(studentsByLetter).sort((a,b) => a.localeCompare(b));
  }, [studentsByLetter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setShowPrintModal(true);
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setSelectedId(null);
        setView('add');
        setSimilarStudents([]);
      }
      if (e.key === 'Escape') {
        setShowPrintModal(false);
        setShowThemeModal(false);
        setShowPrintTemplateModal(false);
        setShowShareModal(false);
        setShowPrintSelectedModal(false);
        setIsSearchActive(false);
        setShowSearchFilters(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      enableNetwork(db).then(() => {
        setAlertConfig({ message: 'تم الاتصال بالإنترنت، جاري المزامنة...', type: 'success' });
      });
    };
    const handleOffline = () => {
      setIsOffline(true);
      disableNetwork(db);
      setAlertConfig({ message: 'أنت الآن في وضع عدم الاتصال. سيتم المزامنة تلقائياً عند الاتصال.', type: 'warning' });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Voice search
  const startVoiceSearch = () => {
    const anyWindow = window as any;
    if (!('webkitSpeechRecognition' in anyWindow) && !('SpeechRecognition' in anyWindow)) {
      setAlertConfig({ message: 'متصفحك لا يدعم البحث الصوتي', type: 'error' });
      return;
    }
    
    const SpeechRecognition = anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearch(transcript);
      setIsListening(false);
    };
    
    recognition.onerror = () => {
      setIsListening(false);
      setAlertConfig({ message: 'فشل التعرف على الصوت، حاول مرة أخرى', type: 'error' });
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  const regsCount = useMemo(() => {
     return new Set(students.filter(s => !s.isDeleted).map(s => s.regNumber)).size;
  }, [students]);

  const regStats = useMemo(() => {
     const active = students.filter(s => !s.isDeleted);
     const statsMap: Record<string, { total: number; active: number; transferred: number; left: number; graduated: number }> = {};
     active.forEach(s => {
         const reg = s.regNumber;
         if (!statsMap[reg]) {
             statsMap[reg] = { total: 0, active: 0, transferred: 0, left: 0, graduated: 0 };
         }
         statsMap[reg].total++;
         const status = s.status || 'active';
         if (statsMap[reg][status] !== undefined) {
             statsMap[reg][status]++;
         }
     });
     return Object.entries(statsMap).map(([reg, counts]) => ({ reg, ...counts })).sort((a, b) => Number(a.reg) - Number(b.reg));
  }, [students]);

  const years = useMemo(() => {
     const y = new Set(students.map(s => {
        const d = new Date(s.createdAt);
        return isNaN(d.getFullYear()) ? null : d.getFullYear();
     }).filter(y => y !== null));
     return (Array.from(y) as number[]).sort((a,b) => b - a);
  }, [students]);

  const docYears = useMemo(() => {
     const ySet = new Set<string>();
     students
       .filter(s => !s.isDeleted && (s.status === 'transferred' || !!s.docDestination || !!s.docDate))
       .forEach(s => {
         if (s.docDate && s.docDate.length >= 4) {
           ySet.add(s.docDate.substring(0, 4));
         }
         const createdYear = new Date(s.createdAt).getFullYear();
         if (!isNaN(createdYear)) {
           ySet.add(createdYear.toString());
         }
       });
     years.forEach(y => ySet.add(y.toString()));
     return Array.from(ySet).sort((a, b) => Number(b) - Number(a));
  }, [students, years]);

  const transferredCountForYear = useMemo(() => {
    return students.filter(s => {
      if (s.isDeleted) return false;
      const isTrans = s.status === 'transferred' || !!s.docDestination || !!s.docDate;
      if (!isTrans) return false;
      if (docsExportYear === 'ALL') return true;
      const yearFromDoc = s.docDate ? s.docDate.substring(0, 4) : '';
      const yearFromCreated = new Date(s.createdAt).getFullYear().toString();
      return yearFromDoc === docsExportYear || (!yearFromDoc && yearFromCreated === docsExportYear);
    }).length;
  }, [students, docsExportYear]);

  const refreshStats = async () => {
     try {
         const baseConstraints = [where("isDeleted", "==", false)];
         if (selectedRegFilter) baseConstraints.push(where("regNumber", "==", selectedRegFilter));
         
         const totalQ = query(studentsCollection, ...baseConstraints);
         await getCountFromServer(totalQ);
     } catch (error) {
         console.error("Error fetching stats:", error);
     }
  };

  useEffect(() => {
     if (user) {
         refreshStats();
     }
  }, [user, selectedRegFilter]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = onSnapshot(studentsCollection, (snapshot) => {
       const data: Student[] = [];
       snapshot.forEach(d => {
          const raw = d.data() as any;
          const createdAt = raw.createdAt?.toMillis ? raw.createdAt.toMillis() : (raw.createdAt || Date.now());
          data.push({ id: d.id, ...raw, createdAt });
       });
       data.sort((a,b) => b.createdAt - a.createdAt);
       setStudents(data);
       setLoading(false);
    }, (error) => {
       console.error("Error fetching students:", error);
       setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
     const handleScroll = () => {
        setShowScrollTop(window.scrollY > 300);
     };
     window.addEventListener('scroll', handleScroll);
     return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    localStorage.setItem('appTheme', colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode));
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('customRegs', JSON.stringify(customRegs));
  }, [customRegs]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) setVisibleCount((prev) => prev + 50);
    }, { threshold: 0.1 });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [students.length]);

  // Set edit form data when editing
  useEffect(() => {
    if (view === 'edit' && selectedId) {
      const student = students.find(s => s.id === selectedId);
      if (student) {
        const initialGrade = (student.transferGrade || (student as any).grade || '').trim();
        setFormTransferGrade(initialGrade);
        setEditFormData({
          firstName: cleanName(student.firstName),
          lastName: student.lastName || '',
          pageNumber: student.pageNumber,
          regNumber: student.regNumber,
          status: student.status || 'active',
          docDate: student.docDate || '',
          docDestination: student.docDestination || '',
          docPurpose: student.docPurpose || '',
          transferGrade: initialGrade,
          notes: student.notes || '',
          createdAt: formatDateForInput(student.createdAt)
        });
        setFormStatus(student.status || 'active');
        const p = student.docPurpose || '';
        if (p && p !== 'إكمال الدراسة') {
          setDocPurposeType('أخرى');
          setCustomDocPurpose(p);
        } else {
          setDocPurposeType('إكمال الدراسة');
          setCustomDocPurpose('');
        }
      }
    } else if (view === 'add') {
      setFormStatus('active');
      setFormTransferGrade('');
      setDocPurposeType('إكمال الدراسة');
      setCustomDocPurpose('');
    }
  }, [view, selectedId, students]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress(0);
    let importedCount = 0;
    let skippedCount = 0;
    try {
      const rows = await readExcel(file);
      const totalRows = rows.length;
      let batch = writeBatch(db);
      let batchCount = 0;
      
      for (let i = 0; i < totalRows; i++) {
         const row = rows[i];
         const fName = row['الاسم الرباعي'] || row['الاسم الكامل'] || row['firstName'] || row['الاسم الأول'];
         const reg = row['رقم القيد'] || row['regNumber'];
         const page = row['رقم الصفحة'] || row['pageNumber'];
         
         if (!fName || !reg || !page) {
            skippedCount++;
            continue;
         }
         
         const regNum = String(reg).trim();
         const pageNum = String(page).trim();
         
         if (regNum === '' || pageNum === '') {
            skippedCount++;
            continue;
         }
         
         const ref = doc(studentsCollection);
         batch.set(ref, {
            firstName: String(fName).trim(),
            lastName: row['العائلة'] || '',
            regNumber: regNum,
            pageNumber: pageNum,
            status: 'active',
            isDeleted: false,
            createdAt: Date.now() + importedCount
         });
         importedCount++;
         batchCount++;
         
         if (batchCount === 400) {
             await batch.commit();
             batch = writeBatch(db);
             batchCount = 0;
             setImportProgress(Math.round((i / totalRows) * 100));
         }
      }
      
      if (batchCount > 0) {
          await batch.commit();
      }
      
      setImportProgress(100);
      await refreshStats();
      let msg = `تم استيراد ${importedCount} سجل بنجاح.`;
      if (skippedCount > 0) {
         msg += ` تم تخطي ${skippedCount} سجل لعدم احتوائها على رقم قيد أو رقم صفحة صحيح.`;
      }
      setAlertConfig({ message: msg, type: 'success' });
    } catch (err) { 
      console.error(err);
      setAlertConfig({ message: "فشل الاستيراد: تأكد من صيغة الملف وحاول مرة أخرى.", type: 'error' }); 
    }
    setImporting(false);
    setTimeout(() => setImportProgress(0), 500);
  };

  const executeDeleteAll = async () => {
     setConfirmConfig(null);
     setLoading(true);
     try {
       const snap = await getDocs(studentsCollection);
       const CHUNK_SIZE = 400;
       const allDocs = snap.docs;
       for (let i = 0; i < allDocs.length; i += CHUNK_SIZE) {
          const batch = writeBatch(db);
          const chunk = allDocs.slice(i, i + CHUNK_SIZE);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
       }
       await refreshStats();
       setAlertConfig({ message: 'تم حذف جميع البيانات بنجاح', type: 'success' });
       setView('list');
     } catch { setAlertConfig({ message: "فشل حذف البيانات", type: 'error' }); }
     finally { setLoading(false); }
  };

  const handleRestore = async (id: string) => {
    try {
        await updateDoc(doc(db, "students", id), { isDeleted: false });
        await refreshStats();
        setAlertConfig({ message: 'تمت استعادة السجل بنجاح', type: 'success' });
    } catch(e) { console.error(e); }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) {
      setAlertConfig({ message: 'الرجاء تحديد طلاب للحذف أولاً', type: 'warning' });
      return;
    }
    
    setConfirmConfig({
      title: "حذف مجموعة طلاب",
      message: `هل أنت متأكد من نقل (${selectedStudents.length}) طالب إلى سلة المحذوفات؟`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          selectedStudents.forEach(id => {
            const ref = doc(db, "students", id);
            batch.update(ref, { isDeleted: true });
          });
          await batch.commit();
          await refreshStats();
          setSelectedStudents([]);
          setConfirmConfig(null);
          setAlertConfig({ message: `تم نقل ${selectedStudents.length} طالب إلى سلة المحذوفات`, type: 'success' });
        } catch (error) {
          console.error("Error bulk deleting:", error);
          setAlertConfig({ message: "فشل في حذف الطلاب", type: 'error' });
        }
      }
    });
  };

  const handleDeleteForever = (id: string) => {
    setConfirmConfig({
        title: "حذف نهائي",
        message: "هل أنت متأكد من حذف هذا السجل نهائياً؟ لا يمكن التراجع عن هذا الإجراء.",
        isDestructive: true,
        onConfirm: async () => {
            await deleteDoc(doc(db, "students", id));
            await refreshStats();
            setConfirmConfig(null);
            setAlertConfig({ message: 'تم الحذف النهائي', type: 'success' });
        }
    });
  };

  const checkSimilarStudents = (val: string) => {
    const name = val.trim();
    if (name.length < 2) {
        setSimilarStudents([]);
        return;
    }
    const matches = students.filter(s => 
        !s.isDeleted && 
        s.id !== selectedId &&
        s.firstName.includes(name)
    );
    setSimilarStudents(matches);
  };

  // Voice input for form fields
  const startVoiceInput = (_fieldName: string, setter: (val: string) => void) => {
    const anyWindow = window as any;
    if (!('webkitSpeechRecognition' in anyWindow) && !('SpeechRecognition' in anyWindow)) {
      setAlertConfig({ message: 'متصفحك لا يدعم الإدخال الصوتي', type: 'error' });
      return;
    }
    
    const SpeechRecognition = anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setter(transcript);
      setIsListening(false);
    };
    
    recognition.onerror = () => {
      setIsListening(false);
      setAlertConfig({ message: 'فشل التعرف على الصوت، حاول مرة أخرى', type: 'error' });
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  const shareViaWhatsApp = (studentsToShare: Student[]) => {
    const statusMap: Record<string, string> = { 'active': 'مستمر', 'transferred': 'منقول', 'left': 'تارك', 'graduated': 'متخرج' };
    
    let text = "📋 *سجل القيد العام - بيانات الطلاب*\n\n";
    
    studentsToShare.forEach((s, index) => {
      text += `*${index + 1}. ${cleanName(s.firstName)} ${s.lastName || ''}*\n`;
      // SWAPPED: Page Number before Registration Number
      text += `└ 📄 رقم الصفحة: ${s.pageNumber}\n`;
      text += `└ 📌 رقم القيد: ${s.regNumber}\n`;
      text += `└ 🎓 الحالة: ${statusMap[s.status || 'active']}`;
      text += `\n└ 📅 تاريخ القيد: ${new Date(s.createdAt).toLocaleDateString('ar-EG')}\n`;
      
      if (s.status === 'transferred') {
        if (s.docDate) text += `└ 📅 تاريخ الوثيقة: ${s.docDate}\n`;
        if (s.transferGrade) text += `└ 🎒 الصف الذي انتقل فيه: ${s.transferGrade}\n`;
        if (s.docDestination) text += `└ 🏛️ الجهة الصادرة إليها: ${s.docDestination}\n`;
        if (s.docPurpose) text += `└ 🎯 الغرض من الوثيقة: ${s.docPurpose}\n`;
      }
      
      if (s.notes) {
        text += `└ 📝 ملاحظات: ${s.notes}\n`;
      }
      text += `\n`;
    });
    
    text += `📊 *إجمالي الطلاب: ${studentsToShare.length}*`;
    
    setShareText(text);
    setShareStudents(studentsToShare);
    setShowShareModal(true);
  };

  const filtered = useMemo(() => {
    let res = students.filter(s => view === 'trash' ? s.isDeleted : !s.isDeleted);
    if (selectedRegFilter) res = res.filter(s => s.regNumber === selectedRegFilter);
    if (yearFilter !== 'ALL') res = res.filter(s => new Date(s.createdAt).getFullYear().toString() === yearFilter);
    if (statusFilter !== 'ALL') res = res.filter(s => (s.status || 'active') === statusFilter);
    if (debouncedQuery) {
       const q = debouncedQuery.toLowerCase();
       res = res.filter(s => {
           const fullName = `${s.firstName} ${s.lastName || ''}`.toLowerCase();
           return fullName.includes(q);
       });
       res.sort((a, b) => {
           const aName = `${a.firstName} ${a.lastName || ''}`.toLowerCase();
           const bName = `${b.firstName} ${b.lastName || ''}`.toLowerCase();
           const aIndex = aName.indexOf(q);
           const bIndex = bName.indexOf(q);
           if (aIndex !== bIndex) return aIndex - bIndex;
           if (sortBy === 'alphabetical') return a.firstName.localeCompare(b.firstName);
           if (sortBy === 'byPage') return Number(a.pageNumber) - Number(b.pageNumber);
           return b.createdAt - a.createdAt;
       });
    } else {
       if (sortBy === 'alphabetical') res.sort((a,b) => a.firstName.localeCompare(b.firstName));
       else if (sortBy === 'byPage') res.sort((a,b) => Number(a.pageNumber) - Number(b.pageNumber));
       else res.sort((a,b) => b.createdAt - a.createdAt);
    }
    return res;
  }, [students, debouncedQuery, selectedRegFilter, statusFilter, sortBy, yearFilter, view]);

  const displayed = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const printSelectedStudents = () => {
    if (selectedStudents.length === 0) {
      setAlertConfig({ message: 'الرجاء تحديد طلاب للطباعة أولاً', type: 'warning' });
      return;
    }
    setPrintMode('selected');
    setTimeout(() => window.print(), 500);
    setShowPrintSelectedModal(false);
  };

  if (!user) return <Login />;

  return (
    <>
      <div className={`min-h-screen no-print pb-20 ${isFullscreen ? 'fullscreen-mode' : ''}`}>
        {/* Offline Indicator */}
        {isOffline && (
          <div className="offline-indicator flex items-center gap-2">
            <WifiOff size={16} />
            <span>وضع عدم الاتصال</span>
          </div>
        )}

        <header className="bg-white border-b sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/80">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-base text-slate-800 cursor-pointer" onClick={() => setView('list')}>
              <div className={`${currentTheme.primary} text-white p-1.5 rounded-lg shadow-lg transition-colors`}><Users size={18} /></div>
              <span>سجل القيد العام</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={toggleFullscreen} 
                data-tooltip={isFullscreen ? 'خروج من ملء الشاشة' : 'وضع ملء الشاشة'}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                type="button"
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <button 
                onClick={() => setShowThemeModal(true)} 
                data-tooltip="تغيير ألوان التطبيق"
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                type="button"
              >
                <Palette size={20} />
              </button>
              <button 
                onClick={() => setView('settings')} 
                data-tooltip="الإعدادات"
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                type="button"
              >
                <Settings size={20} />
              </button>
              <button 
                onClick={() => setConfirmConfig({ title: "تسجيل خروج", message: "هل أنت متأكد من تسجيل الخروج؟", onConfirm: () => signOut(auth) })} 
                data-tooltip="تسجيل الخروج"
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                type="button"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-4">
            {loading && students.length === 0 ? <SkeletonLoader /> : (
                <div className="animate-fade-in space-y-4">
                  {view === 'trash' && (
                    <div className="flex items-center justify-between bg-red-50 p-3 rounded-xl border border-red-100 animate-slide-up">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                            <Trash2 size={20} />
                            <span>سلة المحذوفات</span>
                        </div>
                        <button onClick={() => setView('list')} className="flex items-center gap-2 bg-white text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"><ArrowLeft size={16}/> العودة إلى الرئيسية</button>
                    </div>
                  )}

                  {view !== 'trash' && (
                    <div className={`${inSearchMode ? 'hidden' : 'grid'} grid-cols-2 lg:grid-cols-3 gap-3`}>
                        <StatCard 
                          title="إجمالي الطلاب" 
                          value={students.filter(s => !s.isDeleted).length} 
                          icon={<Users size={18}/>} 
                          colorClass={currentTheme.secondary}
                          tooltip="عدد الطلاب المسجلين في النظام"
                        />
                        <StatCard 
                          title="عدد القيود" 
                          value={regsCount} 
                          icon={<FileSpreadsheet size={18}/>} 
                          colorClass="bg-indigo-600" 
                          onClick={() => setView('stats')}
                          tooltip="عرض إحصائيات تفصيلية حسب رقم القيد"
                        />
                        <StatCard 
                          title="المحدد" 
                          value={selectedStudents.length} 
                          icon={<CheckSquare size={18}/>} 
                          colorClass="bg-purple-600"
                          tooltip="عدد الطلاب المحددين للمشاركة"
                        />
                    </div>
                  )}

                  {/* Search Bar with Clear (X) Button, Voice, and Filters Toggle */}
                  <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 transition-all mb-3">
                     <div className={`relative flex items-center bg-white rounded-lg border border-slate-200 px-3 py-1 focus-within:ring-2 ${currentTheme.ring} transition-all`}>
                         <Search className="text-slate-400 ml-1 shrink-0" size={16} />
                         <input 
                           ref={searchInputRef}
                           id="searchInput" 
                           className="flex-1 bg-transparent outline-none text-slate-700 h-8 font-bold text-xs" 
                           placeholder="ابحث باسم الطالب... (Ctrl+F)" 
                           value={search} 
                           onFocus={() => setIsSearchActive(true)}
                           onChange={(e) => {
                             setSearch(e.target.value);
                             if (e.target.value) setIsSearchActive(true);
                           }} 
                         />
                         {/* Clear X Button */}
                         {search.length > 0 && (
                           <button 
                             type="button"
                             onClick={() => {
                               setSearch('');
                               searchInputRef.current?.focus();
                             }}
                             data-tooltip="مسح البحث"
                             title="إزالة جميع الكتابة"
                             className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors mx-1 shrink-0"
                           >
                             <X size={15} />
                           </button>
                         )}
                         <button 
                           type="button"
                           onClick={startVoiceSearch}
                           data-tooltip="بحث صوتي"
                           className={`p-1.5 rounded-full transition-all shrink-0 ${isListening ? 'voice-listening bg-red-100 text-red-600' : 'hover:bg-slate-100 text-slate-400'}`}
                         >
                           {isListening ? <Mic size={16} className="text-red-600" /> : <Mic size={16} />}
                         </button>
                         {/* Filters Toggle Button inside Search Bar */}
                         <button 
                           type="button"
                           onClick={() => setShowSearchFilters(prev => !prev)}
                           data-tooltip={showSearchFilters ? "إخفاء الفلاتر" : "إظهار الفلاتر"}
                           title={showSearchFilters ? "إخفاء الفلاتر" : "إظهار الفلاتر"}
                           className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all shrink-0 text-xs font-bold border mx-1 ${
                             showSearchFilters 
                               ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs' 
                               : (selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL')
                                 ? 'bg-amber-50 border-amber-300 text-amber-700'
                                 : 'hover:bg-slate-100 text-slate-600 border-slate-200'
                           }`}
                         >
                           <Filter size={14} className="shrink-0" />
                           <span className="hidden sm:inline">{showSearchFilters ? 'إخفاء الفلاتر' : 'الفلاتر'}</span>
                           {(selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL') && (
                             <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                           )}
                         </button>
                         {/* Cancel Search Button (Desktop & Mobile) */}
                         {inSearchMode && (
                           <button
                             type="button"
                             onClick={() => {
                               setSearch('');
                               setIsSearchActive(false);
                               setShowSearchFilters(false);
                               searchInputRef.current?.blur();
                             }}
                             className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors shrink-0 mr-1 border border-blue-200"
                             title="إلغاء البحث واستعادة الشاشة الرئيسية"
                           >
                             إلغاء
                           </button>
                         )}
                     </div>
                  </div>

                  {/* Search Results & Filter Status Bar (Desktop & Mobile) */}
                  {inSearchMode && (
                    <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-600 font-bold bg-white rounded-xl border border-slate-200 shadow-xs mb-2 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span>{search.trim().length > 0 ? `نتائج البحث: ${filtered.length} طالب` : `قائمة الطلاب (${filtered.length})`}</span>
                        {(selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL') && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            فلاتر نشطة
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSearchFilters(prev => !prev)}
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border transition-colors ${
                            showSearchFilters 
                              ? 'bg-blue-50 border-blue-300 text-blue-700' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Filter size={12} />
                          <span>{showSearchFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setIsSearchActive(false);
                            setShowSearchFilters(false);
                            searchInputRef.current?.blur();
                          }}
                          className="text-red-500 hover:text-red-700 hover:underline text-xs"
                        >
                          إغلاق البحث
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Selection Actions */}
                  {selectedStudents.length > 0 && (
                    <div className={`${inSearchMode ? 'hidden' : 'flex'} bg-blue-50 p-3 rounded-xl border border-blue-200 flex-wrap items-center justify-between gap-2 animate-fade-in`}>
                      <span className="text-xs font-bold text-blue-700">تم تحديد {selectedStudents.length} طالب</span>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => shareViaWhatsApp(students.filter(s => selectedStudents.includes(s.id) && !s.isDeleted))}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-700"
                        >
                          <Share2 size={14} /> مشاركة نص
                        </button>
                        <button 
                          onClick={() => setShowPrintSelectedModal(true)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-700"
                        >
                          <Printer size={14} /> طباعة
                        </button>
                        <button 
                          onClick={handleBulkDelete}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-700"
                        >
                          <Trash2 size={14} /> حذف المحدد
                        </button>
                        <button 
                          onClick={() => setSelectedStudents([])}
                          className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Filters (Hidden during search by default, toggleable via button) */}
                  {(!inSearchMode || showSearchFilters) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center mb-4 animate-fade-in">
                        <select value={selectedRegFilter} onChange={(e) => setSelectedRegFilter(e.target.value)} className="bg-white rounded-lg px-2 py-2 border border-slate-200 text-xs font-bold outline-none h-9">
                            <option value="">جميع القيود</option>
                            {Array.from(new Set(students.filter(s => !s.isDeleted).map(s => s.regNumber))).sort((a,b) => Number(a)-Number(b)).map(r => (
                              <option key={r} value={r}>قيد {r}</option>
                            ))}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white rounded-lg px-2 py-2 border border-slate-200 text-xs font-bold outline-none h-9">
                            <option value="ALL">جميع الحالات</option>
                            <option value="active">مستمر</option>
                            <option value="transferred">منقول</option>
                            <option value="left">تارك</option>
                            <option value="graduated">متخرج</option>
                        </select>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-white rounded-lg px-2 py-2 border border-slate-200 text-xs font-bold outline-none h-9">
                            <option value="recent">الأحدث أولاً</option>
                            <option value="alphabetical">ترتيب أبجدي</option>
                            <option value="byPage">حسب الصفحة</option>
                        </select>
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="bg-white rounded-lg px-2 py-2 border border-slate-200 text-xs font-bold outline-none h-9">
                            <option value="ALL">جميع السنوات</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className={`${inSearchMode ? 'hidden' : 'flex'} flex-wrap gap-2`}>
                        <button 
                          onClick={() => { setSelectedId(null); setView('add'); setSimilarStudents([]); }} 
                          data-tooltip="إضافة طالب جديد (Ctrl+N)"
                          className={`flex-1 min-w-[120px] ${currentTheme.primary} ${currentTheme.hover} text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-colors`}
                        >
                          <Plus size={16} /> إضافة طالب
                        </button>
                        <button 
                          onClick={() => setShowPrintModal(true)} 
                          data-tooltip="طباعة السجل (Ctrl+P)"
                          className="flex-1 min-w-[120px] bg-white text-slate-700 border px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                        >
                          <Printer size={16} /> طباعة
                        </button>
                        <button 
                          onClick={() => setShowPrintTemplateModal(true)}
                          data-tooltip="تخصيص قالب الطباعة"
                          className="flex-1 min-w-[120px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors"
                        >
                          <FileText size={16} /> تخصيص
                        </button>
                  </div>

                  {/* ALPHABET NAVIGATION (Fast Letter Jump) */}
                  {sortBy === 'alphabetical' && !debouncedQuery && alphabetLetters.length > 0 && (
                    <div className={`${inSearchMode ? 'hidden' : 'flex'} alphabet-nav`}>
                      {alphabetLetters.map(letter => (
                        <button
                          key={letter}
                          onClick={() => {
                            const offset = 130;
                            const desktopSection = document.getElementById(`section-${letter}`);
                            const mobileSection = document.getElementById(`mobile-section-${letter}`);
                            const isMobile = window.innerWidth < 768;
                            const section = isMobile ? (mobileSection || desktopSection) : (desktopSection || mobileSection);
                            if (section) {
                              const top = section.getBoundingClientRect().top + window.pageYOffset - offset;
                              window.scrollTo({ top, behavior: 'smooth' });
                            }
                          }}
                          className="alphabet-nav-btn"
                          data-tooltip={`انتقل إلى حرف ${letter}`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Desktop Table View with Alphabet Sections (Swapped Page and Reg) */}
                  <div className="hidden md:block bg-white rounded-2xl border shadow-xl overflow-hidden mt-3">
                    {sortBy === 'alphabetical' && !debouncedQuery ? (
                      Object.keys(studentsByLetter).sort().map(letter => (
                        <div key={letter} id={`section-${letter}`} className="alphabet-section">
                          <div className="section-header flex items-center gap-2">
                            <span className={`${currentTheme.primary} text-white w-8 h-8 rounded-full flex items-center justify-center`}>
                              {letter}
                            </span>
                            <span>الطلاب الذين يبدأ اسمهم بحرف {letter}</span>
                            <span className="text-sm text-slate-400">({studentsByLetter[letter].length} طالب)</span>
                          </div>
                          <table className="w-full text-right border-collapse">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                                 <tr>
                                <th className="px-2 py-2 w-12 text-center">
                                  <input 
                                    type="checkbox" 
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedStudents(studentsByLetter[letter].map(s => s.id));
                                      } else {
                                        setSelectedStudents(selectedStudents.filter(id => !studentsByLetter[letter].some(s => s.id === id)));
                                      }
                                    }}
                                    checked={studentsByLetter[letter].length > 0 && studentsByLetter[letter].every(s => selectedStudents.includes(s.id))}
                                    className="rounded border-slate-300"
                                  />
                                </th>
                                <th className="px-4 py-2 w-12 text-center">#</th>
                                <th className="px-4 py-2">اسم الطالب</th>
                                {/* SWAPPED: الصفحة then رقم القيد */}
                                <th className="px-4 py-2 w-24 text-center">الصفحة</th>
                                <th className="px-4 py-2 w-28 text-center">رقم القيد</th>
                                <th className="px-4 py-2 w-20 text-center">الحالة</th>
                                {view === 'trash' && <th className="px-4 py-2 w-32 text-center">إجراءات</th>}
                                 </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {studentsByLetter[letter].map((s, idx) => (
                                <tr key={s.id} className={`hover:bg-blue-50/40 transition-all border-b border-slate-50 group h-10 ${view === 'trash' ? 'cursor-default' : ''}`}>
                                  <td className="px-2 py-2 text-center">
                                    <input 
                                      type="checkbox"
                                      checked={selectedStudents.includes(s.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (e.target.checked) {
                                          setSelectedStudents([...selectedStudents, s.id]);
                                        } else {
                                          setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                                        }
                                      }}
                                      className="rounded border-slate-300"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="px-4 py-2">
                                      <div 
                                        className="flex items-center gap-2 cursor-pointer" 
                                        onClick={() => { if(view !== 'trash') { setSelectedId(s.id); setView('detail'); }}}
                                      >
                                          <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'graduated' ? 'bg-blue-500' : s.status === 'left' ? 'bg-rose-500' : s.status === 'transferred' ? 'bg-amber-500' : 'bg-emerald-500'}`} title={s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}></div>
                                          <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                                              {cleanName(s.firstName)}{s.lastName ? ` / ${s.lastName}` : ''}
                                          </span>
                                      </div>
                                  </td>
                                  {/* SWAPPED: الصفحة cell before رقم القيد cell */}
                                  <td className="px-4 py-2 text-center"><span className="bg-[#FFA500] text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm text-[10px]">{s.pageNumber}</span></td>
                                  <td className="px-4 py-2 text-center"><span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm transition-colors text-[10px]`}>{s.regNumber}</span></td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 
                                      s.status === 'left' ? 'bg-rose-100 text-rose-700' : 
                                      s.status === 'transferred' ? 'bg-amber-100 text-amber-700' : 
                                      'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {s.status === 'graduated' ? 'خ' : s.status === 'left' ? 'ت' : s.status === 'transferred' ? 'ن' : 'م'}
                                    </span>
                                  </td>
                                  {view === 'trash' && (
                                    <td className="px-4 py-2 text-center flex gap-1 justify-center">
                                         <button onClick={(e) => { e.stopPropagation(); handleRestore(s.id); }} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200" title="استعادة"><RotateCcw size={14}/></button>
                                         <button onClick={(e) => { e.stopPropagation(); handleDeleteForever(s.id); }} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="حذف نهائي"><Trash2 size={14}/></button>
                                    </td>
                                  )}
                                 </tr>
                              ))}
                            </tbody>
                           </table>
                        </div>
                      ))
                    ) : (
                      <table className="w-full text-right border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                             <tr>
                            <th className="px-2 py-2 w-12 text-center">
                              <input 
                                type="checkbox" 
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudents(displayed.map(s => s.id));
                                  } else {
                                    setSelectedStudents([]);
                                  }
                                }}
                                checked={selectedStudents.length === displayed.length && displayed.length > 0}
                                className="rounded border-slate-300"
                              />
                            </th>
                            <th className="px-4 py-2 w-12 text-center">#</th>
                            <th className="px-4 py-2">اسم الطالب</th>
                            {/* SWAPPED: الصفحة then رقم القيد */}
                            <th className="px-4 py-2 w-24 text-center">الصفحة</th>
                            <th className="px-4 py-2 w-28 text-center">رقم القيد</th>
                            <th className="px-4 py-2 w-20 text-center">الحالة</th>
                            {view === 'trash' && <th className="px-4 py-2 w-32 text-center">إجراءات</th>}
                             </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {displayed.map((s, idx) => (
                            <tr key={s.id} className={`hover:bg-blue-50/40 transition-all border-b border-slate-50 group h-10 ${view === 'trash' ? 'cursor-default' : ''}`}>
                              <td className="px-2 py-2 text-center">
                                <input 
                                  type="checkbox"
                                  checked={selectedStudents.includes(s.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (e.target.checked) {
                                      setSelectedStudents([...selectedStudents, s.id]);
                                    } else {
                                      setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                                    }
                                  }}
                                  className="rounded border-slate-300"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="px-4 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="px-4 py-2">
                                  <div 
                                    className="flex items-center gap-2 cursor-pointer" 
                                    onClick={() => { if(view !== 'trash') { setSelectedId(s.id); setView('detail'); }}}
                                  >
                                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'graduated' ? 'bg-blue-500' : s.status === 'left' ? 'bg-rose-500' : s.status === 'transferred' ? 'bg-amber-500' : 'bg-emerald-500'}`} title={s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}></div>
                                      <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                                          {cleanName(s.firstName)}{s.lastName ? ` / ${s.lastName}` : ''}
                                      </span>
                                  </div>
                              </td>
                              {/* SWAPPED: الصفحة cell before رقم القيد cell */}
                              <td className="px-4 py-2 text-center"><span className="bg-[#FFA500] text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm text-[10px]">{s.pageNumber}</span></td>
                              <td className="px-4 py-2 text-center"><span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm transition-colors text-[10px]`}>{s.regNumber}</span></td>
                              <td className="px-4 py-2 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 
                                  s.status === 'left' ? 'bg-rose-100 text-rose-700' : 
                                  s.status === 'transferred' ? 'bg-amber-100 text-amber-700' : 
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {s.status === 'graduated' ? 'خ' : s.status === 'left' ? 'ت' : s.status === 'transferred' ? 'ن' : 'م'}
                                </span>
                              </td>
                              {view === 'trash' && (
                                  <td className="px-4 py-2 text-center flex gap-1 justify-center">
                                       <button onClick={(e) => { e.stopPropagation(); handleRestore(s.id); }} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200" title="استعادة"><RotateCcw size={14}/></button>
                                       <button onClick={(e) => { e.stopPropagation(); handleDeleteForever(s.id); }} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="حذف نهائي"><Trash2 size={14}/></button>
                                  </td>
                              )}
                             </tr>
                          ))}
                        </tbody>
                       </table>
                    )}
                  </div>

                  {/* Mobile Card View (Swapped Page and Reg) */}
                  <div className="md:hidden space-y-2 mt-3">
                    {sortBy === 'alphabetical' && !debouncedQuery ? (
                      Object.keys(studentsByLetter).sort().map(letter => (
                        <div key={letter} id={`mobile-section-${letter}`} className="alphabet-section">
                          <div className="section-header flex items-center gap-2 text-sm">
                            <span className={`${currentTheme.primary} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs`}>
                              {letter}
                            </span>
                            <span>({studentsByLetter[letter].length})</span>
                          </div>
                          {studentsByLetter[letter].map((s, idx) => (
                            <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 relative mb-2 hover:bg-slate-50 group transition-colors">
                              <div className="absolute top-2 right-2">
                                <input 
                                  type="checkbox"
                                  checked={selectedStudents.includes(s.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStudents([...selectedStudents, s.id]);
                                    } else {
                                      setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 ml-2"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div 
                                className={`${view === 'trash' ? 'cursor-default' : 'cursor-pointer'}`}
                                onClick={() => { if(view !== 'trash') { setSelectedId(s.id); setView('detail'); }}}
                              >
                                <div className={`absolute top-0 bottom-0 left-0 w-1 ${s.status === 'graduated' ? 'bg-blue-500' : s.status === 'left' ? 'bg-rose-500' : s.status === 'transferred' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                <div className="flex items-start gap-2 mr-8">
                                   <span className="text-slate-400 font-mono text-xs bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0 mt-0.5">#{idx + 1}</span>
                                   <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors leading-relaxed flex-1 min-w-0">
                                      <span>{cleanName(s.firstName)}</span>
                                      {s.lastName && (
                                        <span className="inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap align-middle">
                                          <span>/</span>
                                          <span>{s.lastName}</span>
                                        </span>
                                      )}
                                   </h3>
                                </div>
                                {/* SWAPPED: صفحة {s.pageNumber} before قيد {s.regNumber} */}
                                <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2 mr-8">
                                    <span className="bg-[#FFA500] text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">صفحة {s.pageNumber}</span>
                                    <span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm transition-colors`}>قيد {s.regNumber}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                      s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 
                                      s.status === 'left' ? 'bg-rose-100 text-rose-700' : 
                                      s.status === 'transferred' ? 'bg-amber-100 text-amber-700' : 
                                      'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}
                                    </span>
                                </div>
                                {view === 'trash' && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2 mr-8">
                                       <button onClick={(e) => { e.stopPropagation(); handleRestore(s.id); }} className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xs flex items-center justify-center gap-1"><RotateCcw size={14}/> استعادة</button>
                                       <button onClick={(e) => { e.stopPropagation(); handleDeleteForever(s.id); }} className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-xs flex items-center justify-center gap-1"><Trash2 size={14}/> حذف نهائي</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      displayed.map((s, idx) => (
                        <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 relative mb-2 hover:bg-slate-50 group transition-colors">
                          <div className="absolute top-2 right-2">
                            <input 
                              type="checkbox"
                              checked={selectedStudents.includes(s.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudents([...selectedStudents, s.id]);
                                } else {
                                  setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                                }
                              }}
                              className="rounded border-slate-300 ml-2"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div 
                            className={`${view === 'trash' ? 'cursor-default' : 'cursor-pointer'}`}
                            onClick={() => { if(view !== 'trash') { setSelectedId(s.id); setView('detail'); }}}
                          >
                            <div className={`absolute top-0 bottom-0 left-0 w-1 ${s.status === 'graduated' ? 'bg-blue-500' : s.status === 'left' ? 'bg-rose-500' : s.status === 'transferred' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                            <div className="flex items-start gap-2 mr-8">
                               <span className="text-slate-400 font-mono text-xs bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0 mt-0.5">#{idx + 1}</span>
                               <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors leading-relaxed flex-1 min-w-0">
                                  <span>{cleanName(s.firstName)}</span>
                                  {s.lastName && (
                                    <span className="inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap align-middle">
                                      <span>/</span>
                                      <span>{s.lastName}</span>
                                    </span>
                                  )}
                               </h3>
                            </div>
                            {/* SWAPPED: صفحة {s.pageNumber} before قيد {s.regNumber} */}
                            <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2 mr-8">
                                <span className="bg-[#FFA500] text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">صفحة {s.pageNumber}</span>
                                <span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm transition-colors`}>قيد {s.regNumber}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 
                                  s.status === 'left' ? 'bg-rose-100 text-rose-700' : 
                                  s.status === 'transferred' ? 'bg-amber-100 text-amber-700' : 
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}
                                </span>
                            </div>
                            {view === 'trash' && (
                              <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2 mr-8">
                                   <button onClick={(e) => { e.stopPropagation(); handleRestore(s.id); }} className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xs flex items-center justify-center gap-1"><RotateCcw size={14}/> استعادة</button>
                                   <button onClick={(e) => { e.stopPropagation(); handleDeleteForever(s.id); }} className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-xs flex items-center justify-center gap-1"><Trash2 size={14}/> حذف نهائي</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {filtered.length === 0 && (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs animate-fade-in">
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Search size={22} />
                        </div>
                        <div className="font-bold text-slate-700 text-sm">لا توجد نتائج مطابقة للبحث</div>
                        <div className="text-xs text-slate-400 mt-1">تأكد من كتابة الاسم بشكل صحيح</div>
                      </div>
                    )}
                  </div>
                  <div ref={loadMoreRef} className="h-10"></div>
                </div>
            )}
        </main>

        {showScrollTop && (
            <div className="fixed bottom-6 left-6 flex flex-col gap-3 z-50 animate-fade-in">
                <button 
                  onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => searchInputRef.current?.focus(), 500); }} 
                  className="bg-white text-slate-700 p-2.5 rounded-full shadow-xl border border-slate-200 hover:bg-slate-50 transition-all" 
                  data-tooltip="بحث"
                  type="button"
                >
                    <Search size={20} />
                </button>
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                  className={`${currentTheme.primary} ${currentTheme.hover} text-white p-2.5 rounded-full shadow-xl transition-all`}
                  data-tooltip="العودة للأعلى"
                  type="button"
                >
                    <ArrowUp size={20} />
                </button>
            </div>
        )}

        {/* Add/Edit Modal (SWAPPED: Page input before Reg input) */}
        {(view === 'add' || view === 'edit') && (
            <Modal onClose={() => { setView('list'); setSimilarStudents([]); setEditFormData(null); setSavedStudentName(null); setFormTransferGrade(''); }}>
              <div className="bg-white rounded-2xl shadow-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <h2 className="text-lg font-bold">{view === 'add' ? 'إضافة طالب جديد' : 'تعديل بيانات الطالب'}</h2>
                
                {savedStudentName && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 animate-fade-in">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check size={16} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">تم الحفظ بنجاح</div>
                      <div className="font-bold text-slate-800 text-sm">{savedStudentName.name}</div>
                      <div className="text-[10px] text-slate-500">صفحة {savedStudentName.page} · قيد {savedStudentName.reg}</div>
                    </div>
                  </div>
                )}
                
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const regNum = String(form.get('regNumber') || '').trim();
                    const pageNum = String(form.get('pageNumber') || '').trim();
                    
                    if (!regNum || !pageNum) {
                        setAlertConfig({ message: "يرجى إدخال رقم الصفحة ورقم القيد", type: 'error' });
                        return;
                    }
                    
                    const isDuplicate = students.some(s => 
                        !s.isDeleted && 
                        s.regNumber === regNum && 
                        s.pageNumber === pageNum && 
                        s.id !== selectedId
                    );

                    if (isDuplicate) {
                        setAlertConfig({ message: "خطأ: هذا القيد مسجل بالفعل في نفس الصفحة لطالب آخر", type: 'error' });
                        return;
                    }

                    const fName = String(form.get('firstName') || '');
                    const lName = String(form.get('lastName') || '');
                    const st = (form.get('status') as any) || 'active';
                    let purpose = '';
                    if (st === 'transferred') {
                      if (docPurposeType === 'أخرى') {
                        purpose = String(form.get('customDocPurpose') || '').trim() || 'أخرى';
                      } else {
                        purpose = 'إكمال الدراسة';
                      }
                    }
                    const data: any = {
                        firstName: fName,
                        lastName: lName,
                        pageNumber: pageNum,
                        regNumber: regNum,
                        notes: String(form.get('notes') || ''),
                        status: st,
                        docDate: st === 'transferred' ? String(form.get('docDate') || '').trim() : '',
                        docDestination: st === 'transferred' ? String(form.get('docDestination') || '').trim() : '',
                        docPurpose: purpose,
                        transferGrade: st === 'transferred' ? (formTransferGrade || String(form.get('transferGrade') || '')).trim() : '',
                        isDeleted: false,
                        createdAt: view === 'edit' ? new Date(String(form.get('createdAt'))).getTime() : Date.now()
                    };
                    try {
                        if (view === 'edit' && selectedId) {
                            await updateDoc(doc(db, "students", selectedId), data);
                            setSavedStudentName({ name: `${cleanName(fName)} ${lName}`.trim(), page: pageNum, reg: regNum });
                            setAlertConfig({ message: 'تم تعديل البيانات بنجاح', type: 'success' });
                            setView('list');
                            setSimilarStudents([]);
                            setEditFormData(null);
                            setFormTransferGrade('');
                        } else {
                            await addDoc(studentsCollection, data);
                            setSavedStudentName({ name: `${cleanName(fName)} ${lName}`.trim(), page: pageNum, reg: regNum });
                            setAlertConfig({ message: 'تم إضافة الطالب بنجاح', type: 'success' });
                            (e.target as HTMLFormElement).reset();
                            setFormStatus('active');
                            setFormTransferGrade('');
                            setDocPurposeType('إكمال الدراسة');
                            setCustomDocPurpose('');
                            setSimilarStudents([]);
                        }
                        await refreshStats();
                    } catch(err) { 
                        console.error(err);
                        setAlertConfig({ message: "حدث خطأ أثناء الحفظ", type: 'error' }); 
                    }
                }} className="space-y-3">
                   <div>
                       <div className="relative">
                         <input 
                           name="firstName" 
                           required 
                           defaultValue={editFormData?.firstName || ''} 
                           className={`w-full p-2.5 rounded-xl bg-slate-50 outline-none border ${currentTheme.ring} font-bold text-sm`} 
                           placeholder="الاسم الرباعي" 
                           onChange={(e) => checkSimilarStudents(e.target.value)} 
                           autoComplete="off"
                         />
                         <button
                           type="button"
                           onClick={() => startVoiceInput('firstName', (val) => {
                             const input = document.querySelector('input[name="firstName"]') as HTMLInputElement;
                             if (input) input.value = val;
                             checkSimilarStudents(val);
                           })}
                           className="absolute left-2 top-1/2 transform -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                           data-tooltip="إدخال صوتي"
                         >
                           <Mic size={18} />
                         </button>
                       </div>
                       {similarStudents.length > 0 && (
                           <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2 animate-fade-in">
                               <div className="flex items-center gap-1 text-amber-800 font-bold text-[10px] mb-1">
                                    <AlertTriangle size={12}/>
                                   <span>تنبيه: توجد أسماء مشابهة مسجلة مسبقاً</span>
                               </div>
                               <div className="max-h-24 overflow-y-auto space-y-1">
                                   {similarStudents.map(s => (
                                       <div key={s.id} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-amber-100 text-[10px]">
                                           <span className="font-bold text-slate-700 truncate ml-1">{cleanName(s.firstName)} {s.lastName || ''}</span>
                                           <div className="flex gap-1 flex-shrink-0">
                                               {/* SWAPPED: صفحة then قيد */}
                                               <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-mono font-bold">صفحة {s.pageNumber}</span>
                                               <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">قيد {s.regNumber}</span>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       )}
                   </div>
                   <div className="relative">
                     <input name="lastName" defaultValue={editFormData?.lastName || ''} className={`w-full p-2.5 rounded-xl bg-slate-50 outline-none border ${currentTheme.ring} font-bold text-sm`} placeholder="العائلة (اختياري)" />
                     <button
                       type="button"
                       onClick={() => startVoiceInput('lastName', (val) => {
                         const input = document.querySelector('input[name="lastName"]') as HTMLInputElement;
                         if (input) input.value = val;
                       })}
                       className="absolute left-2 top-1/2 transform -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                       data-tooltip="إدخال صوتي"
                     >
                       <Mic size={18} />
                     </button>
                   </div>

                   {/* SWAPPED: رقم الصفحة first (right column in RTL), then رقم القيد */}
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">رقم الصفحة</label>
                       <input 
                         name="pageNumber" 
                         required 
                         className="w-full p-2.5 rounded-xl bg-slate-50 border outline-none text-center font-bold text-sm" 
                         placeholder="رقم الصفحة" 
                         defaultValue={editFormData?.pageNumber || ''} 
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">رقم القيد</label>
                       <div className="relative">
                         <input 
                           type="text" 
                           name="regNumber" 
                           required 
                           defaultValue={editFormData?.regNumber || ''} 
                           list="regNumbersList"
                           className={`w-full p-2.5 rounded-xl bg-slate-50 outline-none border ${currentTheme.ring} font-bold text-sm text-center`}
                           placeholder="أدخل رقم القيد"
                         />
                         <datalist id="regNumbersList">
                           {Array.from(new Set([
                             ...students.filter(s => !s.isDeleted).map(s => s.regNumber),
                             ...customRegs
                           ])).sort((a, b) => Number(a) - Number(b)).map(r => (
                             <option key={r} value={r}>قيد {r}</option>
                           ))}
                         </datalist>
                       </div>
                     </div>
                   </div>

                   <input type="date" name="createdAt" className="w-full p-2.5 rounded-xl bg-slate-50 border outline-none font-bold text-sm" defaultValue={editFormData?.createdAt || formatDateForInput(Date.now())} />
                   <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">الوضع الأكاديمي</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <label className="cursor-pointer group">
                            <input 
                              type="radio" 
                              name="status" 
                              value="active" 
                              className="peer hidden" 
                              checked={formStatus === 'active'} 
                              onChange={() => setFormStatus('active')}
                            />
                            <div className="py-2 px-1 rounded-xl border-2 border-slate-100 text-center font-bold text-xs text-slate-500 peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:border-emerald-500 transition-all">مستمر</div>
                        </label>
                        <label className="cursor-pointer group">
                            <input 
                              type="radio" 
                              name="status" 
                              value="transferred" 
                              className="peer hidden" 
                              checked={formStatus === 'transferred'} 
                              onChange={() => setFormStatus('transferred')}
                            />
                            <div className="py-2 px-1 rounded-xl border-2 border-slate-100 text-center font-bold text-xs text-slate-500 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 transition-all">منقول</div>
                        </label>
                        <label className="cursor-pointer group">
                            <input 
                              type="radio" 
                              name="status" 
                              value="left" 
                              className="peer hidden" 
                              checked={formStatus === 'left'} 
                              onChange={() => setFormStatus('left')}
                            />
                            <div className="py-2 px-1 rounded-xl border-2 border-slate-100 text-center font-bold text-xs text-slate-500 peer-checked:bg-rose-500 peer-checked:text-white peer-checked:border-rose-500 transition-all">تارك</div>
                        </label>
                        <label className="cursor-pointer group">
                            <input 
                              type="radio" 
                              name="status" 
                              value="graduated" 
                              className="peer hidden" 
                              checked={formStatus === 'graduated'} 
                              onChange={() => setFormStatus('graduated')}
                            />
                            <div className="py-2 px-1 rounded-xl border-2 border-slate-100 text-center font-bold text-xs text-slate-500 peer-checked:bg-blue-500 peer-checked:text-white peer-checked:border-blue-500 transition-all">متخرج</div>
                        </label>
                      </div>
                   </div>

                   {/* الحقول الخاصة بالطالب المنقول */}
                   {formStatus === 'transferred' && (
                     <div className="bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl p-3.5 space-y-3 animate-slide-up shadow-xs">
                       <div className="flex items-center gap-2 text-amber-900 font-bold text-xs border-b border-amber-200 pb-1.5">
                         <FileText size={15} className="text-amber-600" />
                         <span>بيانات النقل والوثيقة الرسمية</span>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                         <div>
                           <label className="block text-[11px] font-bold text-amber-900 mb-1">تاريخ الوثيقة</label>
                           <input 
                             type="date"
                             name="docDate" 
                             defaultValue={editFormData?.docDate || ''} 
                             className="w-full p-2.5 rounded-xl bg-white border border-amber-200 outline-none font-bold text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                           />
                         </div>

                          <div>
                            <label className="block text-[11px] font-bold text-amber-900 mb-1">الصف الذي انتقل فيه</label>
                            <select 
                              name="transferGrade" 
                              value={formTransferGrade} 
                              onChange={(e) => setFormTransferGrade(e.target.value)} 
                              className="w-full p-2.5 rounded-xl bg-white border border-amber-200 outline-none font-bold text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="">اختر الصف...</option>
                              <optgroup label="المرحلة المتوسطة">
                                <option value="الأول متوسط">الأول متوسط</option>
                                <option value="الثاني متوسط">الثاني متوسط</option>
                                <option value="الثالث متوسط">الثالث متوسط</option>
                              </optgroup>
                              <optgroup label="الفرع العلمي">
                                <option value="الرابع علمي">الرابع علمي</option>
                                <option value="الخامس علمي">الخامس علمي</option>
                                <option value="السادس علمي">السادس علمي</option>
                              </optgroup>
                              <optgroup label="الفرع الأدبي">
                                <option value="الرابع أدبي">الرابع أدبي</option>
                                <option value="الخامس أدبي">الخامس أدبي</option>
                                <option value="السادس أدبي">السادس أدبي</option>
                              </optgroup>
                              {formTransferGrade && ![
                                'الأول متوسط', 'الثاني متوسط', 'الثالث متوسط',
                                'الرابع علمي', 'الخامس علمي', 'السادس علمي',
                                'الرابع أدبي', 'الخامس أدبي', 'السادس أدبي'
                              ].includes(formTransferGrade) && (
                                <option value={formTransferGrade}>{formTransferGrade}</option>
                              )}
                            </select>
                          </div>

                         <div className="sm:col-span-2">
                           <label className="block text-[11px] font-bold text-amber-900 mb-1">الجهة الصادرة إليها</label>
                           <input 
                             type="text" 
                             name="docDestination" 
                             defaultValue={editFormData?.docDestination || ''} 
                             placeholder="المدرسة أو المديرية المنقول إليها" 
                             className="w-full p-2.5 rounded-xl bg-white border border-amber-200 outline-none font-bold text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                           />
                         </div>

                         <div className="sm:col-span-2 space-y-2">
                           <label className="block text-[11px] font-bold text-amber-900 mb-1">الغرض من الوثيقة</label>
                           <div className="grid grid-cols-2 gap-2">
                             <label className="cursor-pointer">
                               <input 
                                 type="radio" 
                                 name="docPurposeOption" 
                                 value="إكمال الدراسة" 
                                 className="peer hidden" 
                                 checked={docPurposeType === 'إكمال الدراسة'} 
                                 onChange={() => setDocPurposeType('إكمال الدراسة')} 
                               />
                               <div className="py-2 px-2 rounded-xl border-2 border-slate-200 text-center font-bold text-xs text-slate-600 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 transition-all bg-white shadow-xs">
                                 إكمال الدراسة
                               </div>
                             </label>
                             <label className="cursor-pointer">
                               <input 
                                 type="radio" 
                                 name="docPurposeOption" 
                                 value="أخرى" 
                                 className="peer hidden" 
                                 checked={docPurposeType === 'أخرى'} 
                                 onChange={() => setDocPurposeType('أخرى')} 
                               />
                               <div className="py-2 px-2 rounded-xl border-2 border-slate-200 text-center font-bold text-xs text-slate-600 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 transition-all bg-white shadow-xs">
                                 أخرى
                               </div>
                             </label>
                           </div>

                           {docPurposeType === 'أخرى' && (
                             <div className="animate-slide-up pt-1">
                               <input 
                                 type="text" 
                                 name="customDocPurpose" 
                                 defaultValue={customDocPurpose} 
                                 placeholder="اكتب الغرض من الوثيقة هنا..." 
                                 className="w-full p-2.5 rounded-xl bg-white border border-amber-300 outline-none font-bold text-xs text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                                 autoFocus
                               />
                             </div>
                           )}
                         </div>
                       </div>
                     </div>
                   )}

                   <input name="notes" defaultValue={editFormData?.notes || ''} className={`w-full p-2.5 rounded-xl bg-slate-50 outline-none border ${currentTheme.ring} font-bold text-sm`} placeholder="ملاحظات (اختياري)" />
                   <div className="flex gap-2">
                     <button type="submit" className={`flex-1 ${currentTheme.primary} ${currentTheme.hover} text-white py-2.5 rounded-xl font-bold shadow-xl transition-colors text-sm flex items-center justify-center gap-2`}>
                       <Save size={16}/> حفظ البيانات
                     </button>
                     {view === 'add' && (
                       <button type="button" onClick={() => { setView('list'); setSimilarStudents([]); setSavedStudentName(null); }} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                         إغلاق
                       </button>
                     )}
                   </div>
                </form>
              </div>
            </Modal>
        )}

        {/* Theme Modal */}
        {showThemeModal && (
          <Modal onClose={() => setShowThemeModal(false)}>
            <div className="bg-white rounded-2xl p-5 text-center space-y-4 shadow-xl">
               <h3 className="text-lg font-bold">اختر لون التطبيق</h3>
               <div className="grid grid-cols-2 gap-3">
                  {Object.entries(themeColors).map(([key, value]) => (
                    <button 
                      key={key} 
                      onClick={() => { setColorTheme(key); setShowThemeModal(false); }}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${colorTheme === key ? `border-black bg-slate-50` : 'border-transparent hover:bg-slate-50'}`}
                    >
                       <div className={`w-6 h-6 rounded-full ${value.primary}`}></div>
                       <span className="font-bold text-slate-700 text-sm">{value.name}</span>
                    </button>
                  ))}
               </div>
               <button onClick={() => setShowThemeModal(false)} className="w-full py-2.5 bg-slate-100 font-bold rounded-xl text-slate-600 text-sm">إغلاق</button>
            </div>
          </Modal>
        )}

        {/* Settings Modal */}
        {view === 'settings' && (
            <Modal onClose={() => setView('list')}>
              <div className="bg-white rounded-2xl shadow-xl p-5 space-y-3">
                <h2 className="text-lg font-bold flex items-center gap-2"><Settings size={18}/> الإعدادات</h2>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full py-3 bg-slate-50 rounded-xl font-bold flex justify-between px-3 hover:bg-slate-100 transition-colors text-sm items-center">
                    <span className="flex items-center gap-2">{isDarkMode ? <Sun size={18} className="text-amber-500"/> : <Moon size={18} className="text-slate-600"/>} {isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                </button>
                <button onClick={() => { setView('list'); setShowAddRegModal(true); }} className="w-full py-3 bg-violet-50 text-violet-700 rounded-xl font-bold px-3 flex items-center gap-2 hover:bg-violet-100 transition-transform active:scale-95 text-sm"><Plus size={18}/> إضافة قيد جديد</button>
                <button onClick={() => setView('trash')} className="w-full py-3 bg-slate-50 rounded-xl font-bold flex justify-between px-3 hover:bg-slate-100 transition-colors text-sm items-center"><span>سلة المحذوفات</span> <ArrowRight size={16}/></button>
                <button onClick={() => setView('stats')} className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-bold px-3 flex items-center gap-2 hover:bg-blue-100 transition-transform active:scale-95 text-sm"><BarChart3 size={18}/> إحصائيات القيود</button>
                <button onClick={() => exportToExcel(students.filter(s=>!s.isDeleted))} className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold px-3 flex items-center gap-2 hover:bg-emerald-100 transition-transform active:scale-95 text-sm"><Download size={18}/> تصدير إلى Excel</button>
                <label className={`w-full py-3 ${currentTheme.primary} ${currentTheme.hover} text-white rounded-xl font-bold flex items-center justify-between px-3 cursor-pointer transition-colors text-sm`}>
                    <span className="flex items-center gap-2"><Upload size={18}/> استيراد من Excel</span>
                    <input type="file" className="hidden" accept=".xlsx" onChange={handleImport} disabled={importing} />
                </label>
                <div className="pt-3 border-t border-slate-100 mt-1">
                   <button onClick={() => setConfirmConfig({ title: "حذف جميع البيانات", message: "هل أنت متأكد من حذف جميع البيانات نهائياً؟ لا يمكن التراجع عن هذا الإجراء.", onConfirm: executeDeleteAll, isDestructive: true })} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold px-3 flex items-center gap-2 hover:bg-red-100 transition-transform active:scale-95 text-sm"><Trash2 size={18}/> حذف جميع البيانات</button>
                </div>
              </div>
            </Modal>
        )}

        {/* Add New Registration Modal */}
        {showAddRegModal && (
          <Modal onClose={() => { setShowAddRegModal(false); setNewRegInput(''); }}>
            <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Plus size={18} className="text-violet-600"/> إضافة قيد جديد</h2>
              <p className="text-xs text-slate-500">أدخل رقم القيد الجديد ليكون متاحاً عند إضافة الطلاب</p>
              
              <div className="space-y-2">
                <input
                  type="text"
                  value={newRegInput}
                  onChange={(e) => setNewRegInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-sm text-center"
                  placeholder="رقم القيد (مثال: 45)"
                  autoFocus
                />
                
                {customRegs.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">القيود المضافة</div>
                    <div className="flex flex-wrap gap-2">
                      {customRegs.sort((a,b) => Number(a)-Number(b)).map(r => (
                        <div key={r} className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-1 rounded-lg text-xs font-bold border border-violet-100">
                          <span>قيد {r}</span>
                          <button
                            onClick={() => setCustomRegs(customRegs.filter(x => x !== r))}
                            className="text-violet-400 hover:text-red-500 transition-colors mr-1"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const reg = newRegInput.trim();
                    if (!reg) return;
                    if (customRegs.includes(reg) || students.some(s => !s.isDeleted && s.regNumber === reg)) {
                      setAlertConfig({ message: 'هذا القيد موجود بالفعل', type: 'warning' });
                      return;
                    }
                    setCustomRegs([...customRegs, reg]);
                    setNewRegInput('');
                    setAlertConfig({ message: `تم إضافة قيد رقم ${reg} بنجاح`, type: 'success' });
                  }}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={16}/> إضافة
                </button>
                <button
                  onClick={() => { setShowAddRegModal(false); setNewRegInput(''); }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Stats Modal */}
        {view === 'stats' && (
            <Modal onClose={() => setView('list')}>
                <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4 max-h-[80vh] flex flex-col w-full">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <BarChart3 size={20} className="text-blue-600" /> توزيع الطلاب حسب القيد
                    </h2>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                   <tr>
                                    <th className="p-3 text-sm font-bold text-slate-500 border-b border-slate-200">رقم القيد</th>
                                    <th className="p-3 text-sm font-bold text-slate-500 border-b border-slate-200">عدد الطلاب</th>
                                   </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {regStats.length > 0 ? regStats.map((item) => (
                                    <tr key={item.reg} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-bold text-slate-700 text-sm align-top">قيد {item.reg}</td>
                                        <td className="p-3 font-bold text-slate-900 text-sm">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded-lg w-fit text-xs">
                                                    الإجمالي: {item.total} طالب
                                                </span>
                                                <div className="flex flex-wrap gap-1.5 text-[10px]">
                                                    {item.active > 0 && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">مستمر: {item.active}</span>}
                                                    {item.transferred > 0 && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">منقول: {item.transferred}</span>}
                                                    {item.left > 0 && <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">تارك: {item.left}</span>}
                                                    {item.graduated > 0 && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">متخرج: {item.graduated}</span>}
                                                </div>
                                            </div>
                                           </td>
                                       </tr>
                                )) : (
                                       <tr>
                                        <td colSpan={2} className="p-4 text-center text-slate-400 font-bold text-sm">لا توجد بيانات متاحة</td>
                                       </tr>
                                )}
                            </tbody>
                           </table>
                    </div>
                     <button onClick={() => setView('list')} className="w-full py-3 bg-slate-100 font-bold rounded-xl text-slate-600 text-sm hover:bg-slate-200 transition-colors">إغلاق</button>
                </div>
            </Modal>
        )}

        {/* Print Template Customization Modal */}
        {showPrintTemplateModal && (
          <Modal onClose={() => setShowPrintTemplateModal(false)}>
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">تخصيص قالب الطباعة</h3>
                  <p className="text-xs text-slate-500">اختر الأعمدة المراد ظهورها في المطبوعات</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={() => setPrintTemplateFields(['name', 'lastName', 'pageNumber', 'regNumber', 'status'])}
                    className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    تحديد الكل
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPrintTemplateFields(['name', 'pageNumber', 'regNumber'])}
                    className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    الافتراضي
                  </button>
                </div>
              </div>
              
              <div className="space-y-2.5">
                {[
                  { id: 'name', label: 'الاسم الكامل' },
                  { id: 'lastName', label: 'اللقب (العائلة)' },
                  { id: 'pageNumber', label: 'رقم الصفحة (ص)' },
                  { id: 'regNumber', label: 'رقم القيد (قيد)' },
                  { id: 'status', label: 'الحالة الدراسية (م - ن - ت - خ)' }
                ].map(field => {
                  const isChecked = printTemplateFields.includes(field.id);
                  return (
                    <div 
                      key={field.id}
                      onClick={() => {
                        setPrintTemplateFields(prev => 
                          prev.includes(field.id) 
                            ? prev.filter(f => f !== field.id) 
                            : [...prev, field.id]
                        );
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked 
                          ? 'bg-blue-50/70 border-blue-200 text-blue-900 shadow-xs' 
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                      }`}
                    >
                      <span className="font-bold text-sm">{field.label}</span>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          setPrintTemplateFields(prev => 
                            e.target.checked 
                              ? (prev.includes(field.id) ? prev : [...prev, field.id])
                              : prev.filter(f => f !== field.id)
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 w-4 h-4 text-blue-600 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    if (printTemplateFields.length === 0) {
                      setAlertConfig({ message: 'يرجى اختيار حقل واحد على الأقل للطباعة', type: 'warning' });
                      return;
                    }
                    localStorage.setItem('printTemplateFields', JSON.stringify(printTemplateFields));
                    setShowPrintTemplateModal(false);
                    setAlertConfig({ message: 'تم حفظ إعدادات قالب الطباعة بنجاح', type: 'success' });
                  }}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                  تطبيق وحفظ
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPrintTemplateModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Print Selected Modal */}
        {showPrintSelectedModal && (
          <Modal onClose={() => setShowPrintSelectedModal(false)}>
            <div className="bg-white rounded-2xl p-5 text-center space-y-4">
              <h3 className="text-lg font-bold">طباعة الطلاب المحددين</h3>
              <p className="text-sm text-slate-600">عدد الطلاب المحددين: {selectedStudents.length}</p>
              <div className="flex gap-3">
                <button 
                  onClick={printSelectedStudents}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm"
                >
                  طباعة
                </button>
                <button 
                  onClick={() => setShowPrintSelectedModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Share Modal (SWAPPED: الصفحة before رقم القيد) */}
        {showShareModal && (
          <Modal onClose={() => setShowShareModal(false)} zIndex="z-[70]">
            <div className="bg-white rounded-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare size={20} className="text-green-600" />
                مشاركة عبر واتساب
              </h3>
              
              <div className="share-text-container">
                <h3>📋 سجل القيد العام - بيانات الطلاب</h3>
                {shareStudents.map((s, index) => {
                  const statusMap: Record<string, string> = { 'active': 'مستمر', 'transferred': 'منقول', 'left': 'تارك', 'graduated': 'متخرج' };
                  const statusClass = s.status === 'active' ? 'status-active' : 
                                     s.status === 'transferred' ? 'status-transferred' : 
                                     s.status === 'left' ? 'status-left' : 'status-graduated';
                  
                  return (
                    <div key={s.id} className="share-student-item">
                      <div className="share-student-name">
                        {index + 1}. {cleanName(s.firstName)} {s.lastName || ''}
                      </div>
                      <div className="share-student-details">
                        {/* SWAPPED: الصفحة first, then القيد */}
                        <div className="share-detail-item">
                          <span className="share-detail-label">📄 رقم الصفحة:</span>
                          <span className="share-detail-value">{s.pageNumber}</span>
                        </div>
                        <div className="share-detail-item">
                          <span className="share-detail-label">📌 رقم القيد:</span>
                          <span className="share-detail-value">{s.regNumber}</span>
                        </div>
                        <div className="share-detail-item">
                          <span className="share-detail-label">🎓 الحالة:</span>
                          <span className={`share-status-badge ${statusClass}`}>
                            {statusMap[s.status || 'active']}
                          </span>
                        </div>
                        <div className="share-detail-item">
                          <span className="share-detail-label">📅 تاريخ القيد:</span>
                          <span className="share-detail-value">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                        {s.status === 'transferred' && (
                          <div className="share-detail-item col-span-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 mt-1">
                            <div className="text-[11px] font-bold text-amber-900 mb-1">📋 بيانات النقل والوثيقة:</div>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-800">
                              {s.docDate && <div>📅 تاريخ الوثيقة: <span className="font-bold">{s.docDate}</span></div>}
                              {s.transferGrade && <div>🎒 الصف الذي انتقل فيه: <span className="font-bold">{s.transferGrade}</span></div>}
                              {s.docDestination && <div>🏛️ الجهة الصادرة إليها: <span className="font-bold">{s.docDestination}</span></div>}
                              {s.docPurpose && <div>🎯 الغرض من الوثيقة: <span className="font-bold">{s.docPurpose}</span></div>}
                            </div>
                          </div>
                        )}
                        {s.notes && (
                          <div className="share-detail-item col-span-2">
                            <span className="share-detail-label">📝 ملاحظات:</span>
                            <span className="share-detail-value">{s.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="mt-3 text-center font-bold">
                  📊 إجمالي الطلاب: {shareStudents.length}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <a 
                    href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-700"
                    onClick={() => setShowShareModal(false)}
                  >
                    <MessageSquare size={18} />
                    فتح واتساب (نص)
                  </a>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(shareText);
                      setAlertConfig({ message: 'تم نسخ النص', type: 'success' });
                    }}
                    className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm hover:bg-slate-200"
                  >
                    نسخ النص
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Print Modal */}
        {showPrintModal && (
            <Modal onClose={() => setShowPrintModal(false)}>
               <div className="bg-white rounded-2xl p-5 text-right space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                     <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                       <Printer size={20} className="text-blue-600" />
                       <span>خيارات الطباعة</span>
                     </h3>
                     <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                       A4
                     </span>
                  </div>

                  {/* القسم 1: سجل القيد العام */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                      <FileSpreadsheet size={15} className="text-blue-600" />
                      <span>سجل القيد العام</span>
                    </div>

                    <button 
                      type="button"
                      onClick={() => { 
                        setPrintMode('list'); 
                        setPrintRegInput(''); 
                        setShowPrintModal(false); 
                        setTimeout(() => window.print(), 500); 
                      }} 
                      className={`w-full py-2.5 ${currentTheme.primary} ${currentTheme.hover} text-white rounded-xl font-bold transition-colors text-xs flex items-center justify-center gap-2 shadow-sm`}
                    >
                      <Printer size={15} /> طباعة السجل الحالي بالكامل
                    </button>

                    <div className="pt-1 space-y-2">
                      <div className="text-slate-500 text-[11px] font-bold">أو طباعة قيد محدد:</div>
                      <div className="flex gap-2">
                        <select 
                          value={printRegInput} 
                          onChange={(e) => setPrintRegInput(e.target.value)} 
                          className="flex-1 p-2 border border-slate-200 rounded-xl text-center font-bold outline-none text-xs bg-white text-slate-800"
                        >
                             <option value="">اختر رقم القيد...</option>
                             {Array.from(new Set(students.filter(s => !s.isDeleted).map(s => s.regNumber))).sort((a,b) => Number(a)-Number(b)).map(r => (
                               <option key={r} value={r}>قيد {r}</option>
                             ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => { 
                            setPrintMode('list'); 
                            setSelectedRegFilter(printRegInput); 
                            setShowPrintModal(false); 
                            setTimeout(() => window.print(), 500); 
                          }} 
                          className={`px-4 py-2 ${currentTheme.secondary} ${currentTheme.secondaryHover} text-white rounded-xl font-bold disabled:opacity-50 transition-colors text-xs`} 
                          disabled={!printRegInput}
                        >
                          طباعة
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* القسم 2: طباعة صادر الوثائق - ث. ش. محمد عبدالعزيز الكنعان للبنين */}
                  <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                      <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <FileText size={16} className="text-amber-700" />
                        <span>صادر الوثائق - ث. ش. محمد عبدالعزيز الكنعان للبنين</span>
                      </div>
                      <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                        {docsOrientation === 'landscape' ? 'ورقة عرضية (أفقي)' : 'ورقة عمودية (طولي)'}
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-900/80 leading-relaxed font-semibold">
                      المديرية العامة لتربية البصرة • قسم تربية أبي الخصيب
                    </p>

                    {/* خيارات ترتيب السجلات */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-950 mb-1">
                        خيارات الترتيب:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDocsExportSort('byDate')}
                          className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all text-center ${
                            docsExportSort === 'byDate'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                          }`}
                        >
                          تاريخ الوثيقة
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocsExportSort('alphabetical')}
                          className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all text-center ${
                            docsExportSort === 'alphabetical'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                          }`}
                        >
                          الأبجدية
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocsExportSort('byGradeAlpha')}
                          className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all text-center ${
                            docsExportSort === 'byGradeAlpha'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                          }`}
                        >
                          أبجدياً حسب الصف
                        </button>
                      </div>
                    </div>

                    {/* تحديد السنة وتوجيه الورقة */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1">
                          تحديد السنة:
                        </label>
                        <select 
                          value={docsExportYear} 
                          onChange={(e) => setDocsExportYear(e.target.value)} 
                          className="w-full p-2 border border-amber-200 rounded-xl font-bold outline-none text-xs bg-white text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        >
                          <option value="ALL">جميع السنوات</option>
                          {docYears.map(y => (
                            <option key={y} value={y}>سنة {y}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-1">
                          توجيه الصفحة:
                        </label>
                        <select 
                          value={docsOrientation} 
                          onChange={(e) => setDocsOrientation(e.target.value as 'portrait' | 'landscape')} 
                          className="w-full p-2 border border-amber-200 rounded-xl font-bold outline-none text-xs bg-white text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        >
                          <option value="landscape">أفقي (عرضي) - قياسي ومطابق للسجل</option>
                          <option value="portrait">عمودي (طولي)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 bg-white/80 px-3 py-1.5 rounded-xl border border-amber-200/60">
                      <span>الوثائق الصادرة المطابقة:</span>
                      <span className="font-mono bg-amber-500 text-white px-2 py-0.5 rounded-md text-xs font-black">
                        {transferredCountForYear}
                      </span>
                    </div>

                    <button 
                      type="button"
                      onClick={() => { 
                        if (transferredCountForYear === 0) {
                          setAlertConfig({ message: 'لا توجد سجلات لوثائق منقولة للسنة المحددة', type: 'warning' });
                          return;
                        }
                        setPrintMode('docsExport'); 
                        setShowPrintModal(false); 
                        setTimeout(() => window.print(), 500); 
                      }} 
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors text-xs flex items-center justify-center gap-2 shadow-md active:scale-98"
                    >
                      <Printer size={15} />
                      <span>طباعة صادر الوثائق</span>
                    </button>
                  </div>

                  <button 
                    type="button"
                    onClick={() => setShowPrintModal(false)} 
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                  >
                    إغلاق
                  </button>
               </div>
            </Modal>
        )}

        {/* Detail Modal (نافذة الطالب / بطاقة التفاصيل) - SWAPPED: Page number before Reg number */}
        {view === 'detail' && selectedId && (() => {
            const s = students.find(x => x.id === selectedId);
            if (!s) return null;
            const statusLabels: Record<string, string> = { 'active': 'مستمر', 'transferred': 'منقول', 'left': 'تارك', 'graduated': 'متخرج' };
            const statusColors: Record<string, string> = { 'active': 'bg-emerald-100 text-emerald-700', 'transferred': 'bg-amber-100 text-amber-700', 'left': 'bg-rose-100 text-rose-700', 'graduated': 'bg-blue-100 text-blue-700' };

            return (
              <Modal onClose={() => { setView('list'); setSimilarStudents([]); }}>
                 <div className="bg-white rounded-3xl shadow-2xl p-5 md:p-6 space-y-6 animate-slide-up relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-8 -mt-8"></div>
    
                    <div className="relative">
                        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">{cleanName(s.firstName)}</h1>
                        <h2 className="text-lg font-bold text-slate-400">{s.lastName || ""}</h2>
                    </div>

                    {/* SWAPPED: رقم الصفحة first (right column in RTL), then رقم القيد */}
                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-[#FFA500] text-white p-4 rounded-xl shadow-lg flex flex-col items-center justify-center transform transition-transform hover:scale-[1.02]">
                           <span className="text-amber-100 text-[10px] font-bold uppercase tracking-wider mb-1">رقم الصفحة</span>
                           <span className="text-3xl font-mono font-black">{s.pageNumber}</span>
                       </div>
                       <div className={`${currentTheme.primary} text-white p-4 rounded-xl shadow-lg flex flex-col items-center justify-center transform transition-transform hover:scale-[1.02]`}>
                           <span className="text-slate-200 text-[10px] font-bold uppercase tracking-wider mb-1">رقم القيد</span>
                           <span className="text-3xl font-mono font-black">{s.regNumber}</span>
                       </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm"><Calendar size={16} className="text-slate-500"/></div>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400">تاريخ القيد</div>
                                    <div className="font-bold text-slate-800 text-sm">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm"><Info size={16} className="text-slate-500"/></div>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400">الوضع الأكاديمي</div>
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold mt-0.5 ${statusColors[s.status || 'active'] || statusColors['active']}`}>
                                        {statusLabels[s.status || 'active'] || 'مستمر'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* بيانات النقل والوثيقة */}
                        {(s.status === 'transferred' || s.docDestination || s.docDate) && (
                          <div className="pt-3 border-t border-slate-200">
                            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                                <FileText size={15} className="text-amber-600" />
                                <span>بيانات النقل والوثيقة الرسمية</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-[10px] font-bold text-amber-800 block">تاريخ الوثيقة:</span>
                                  <span className="font-bold text-slate-800 font-mono">{s.docDate || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-amber-800 block">الصف الذي انتقل فيه:</span>
                                  <span className="font-bold text-slate-800">{s.transferGrade || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-amber-800 block">الجهة الصادرة إليها:</span>
                                  <span className="font-bold text-slate-800">{s.docDestination || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-amber-800 block">الغرض من الوثيقة:</span>
                                  <span className="font-bold text-slate-800">{s.docPurpose || '—'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {s.notes && (
                            <div className="pt-3 border-t border-slate-200">
                                <div className="text-[10px] font-bold text-slate-400 mb-1">ملاحظات</div>
                                <p className="text-slate-700 font-medium leading-relaxed text-sm">{s.notes}</p>
                            </div>
                        )}
                    </div>

                    <button 
                      onClick={() => { 
                        setSelectedId(s.id); 
                        setPrintMode('single'); 
                        setTimeout(() => window.print(), 500); 
                      }} 
                      className={`w-full ${currentTheme.secondary} ${currentTheme.secondaryHover} text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-sm`}
                    >
                      <Printer size={18}/> طباعة البطاقة الشخصية
                    </button>
                    
                    <button 
                      onClick={() => shareViaWhatsApp([s])}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-sm"
                    >
                      <Share2 size={18}/> مشاركة نص عبر واتساب
                    </button>
                    
                    <div className="flex gap-2">
                        <button 
                          onClick={() => { 
                            const currentGrade = (s.transferGrade || (s as any).grade || '').trim();
                            setFormTransferGrade(currentGrade);
                            setFormStatus(s.status || 'active');
                            setEditFormData({
                              firstName: cleanName(s.firstName),
                              lastName: s.lastName || '',
                              pageNumber: s.pageNumber,
                              regNumber: s.regNumber,
                              status: s.status || 'active',
                              docDate: s.docDate || '',
                              docDestination: s.docDestination || '',
                              docPurpose: s.docPurpose || '',
                              transferGrade: currentGrade,
                              notes: s.notes || '',
                              createdAt: formatDateForInput(s.createdAt)
                            });
                            const p = s.docPurpose || '';
                            if (p && p !== 'إكمال الدراسة') {
                              setDocPurposeType('أخرى');
                              setCustomDocPurpose(p);
                            } else {
                              setDocPurposeType('إكمال الدراسة');
                              setCustomDocPurpose('');
                            }
                            setView('edit'); 
                            setSimilarStudents([]); 
                          }} 
                          className="flex-1 bg-slate-100 py-2.5 rounded-xl font-bold hover:bg-slate-200 text-slate-700 transition-colors text-sm"
                        >
                          تعديل البيانات
                        </button>
                        <button 
                          onClick={() => setConfirmConfig({ 
                            title: "حذف الطالب", 
                            message: "هل تريد نقل هذا الطالب إلى سلة المحذوفات؟", 
                            onConfirm: async () => { 
                              await updateDoc(doc(db, "students", s.id), { isDeleted: true }); 
                              setView('list'); 
                              setConfirmConfig(null); 
                              setSelectedId(null); 
                              setAlertConfig({ message: 'تم نقل الطالب إلى سلة المحذوفات', type: 'success' }); 
                              await refreshStats(); 
                            } 
                          })} 
                          className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-xl font-bold hover:bg-red-100 transition-colors text-sm"
                        >
                          حذف
                        </button>
                    </div>
                 </div>
              </Modal>
            );
        })()}

        {confirmConfig && <ConfirmModal title={confirmConfig.title} message={confirmConfig.message} onConfirm={confirmConfig.onConfirm} onCancel={() => setConfirmConfig(null)} isDestructive={confirmConfig.isDestructive} />}
        {alertConfig && <AlertModal message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig(null)} />}
        
        {importing && (
          <Modal onClose={() => {}} zIndex="z-[80]">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
              <div className="relative flex items-center justify-center">
                  <div className="animate-spin text-blue-600"><Loader2 size={64} /></div>
                  <div className="absolute text-sm font-bold text-blue-800" dir="ltr">{importProgress}%</div>
              </div>
              <h3 className="text-xl font-bold text-slate-800">جاري استيراد البيانات...</h3>
              <p className="text-slate-500">يرجى الانتظار قليلاً</p>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
              </div>
            </div>
          </Modal>
        )}
      </div>
      
      {printMode === 'list' && <PrintView students={filtered} title={selectedRegFilter ? `كشف الطلاب - قيد رقم ${selectedRegFilter}` : "كشف القيد العام"} selectedFields={printTemplateFields} />}
      {printMode === 'single' && students.find(s=>s.id===selectedId) && <SingleStudentPrint student={students.find(s=>s.id===selectedId)!} />}
      {printMode === 'docsExport' && (
        <DocsExportPrint 
          students={students} 
          selectedYear={docsExportYear} 
          sortBy={docsExportSort} 
          orientation={docsOrientation} 
        />
      )}
    </>
  );
}
