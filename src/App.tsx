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
  MessageSquare, CheckSquare, Check, Filter, Copy,
  Sparkles, LayoutTemplate, LayoutGrid, List, Eye, Edit2, 
  GraduationCap, School, SlidersHorizontal, TrendingUp,
  ChevronDown, ChevronUp, Type, Minus
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
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';

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
  graduationYear?: string;   // العام الدراسي للتخرج
  graduationRound?: string;  // الدور (الدور الأول، الثاني، الثالث، الخاص)
  graduationGrade?: string;  // الصف (السادس العلمي، السادس الأدبي)
  notes?: string;
  isDeleted?: boolean;
  createdAt: number;
  printIndex?: number;
}

// ==========================================
// UTILS
// ==========================================
const ALEF_MAKSURA_NAMES = new Set([
    'مصطفى', 'المصطفى', 'مرتضى', 'المرتضى', 'مجتبى', 'المجتبى', 'مقتدى', 'المقتدى',
    'موسى', 'الموسى', 'عيسى', 'العيسى', 'يحيى', 'اليحيى', 'رضى', 'علا',
    'هدى', 'سلوى', 'ليلى', 'نجوى', 'ضحى', 'منى', 'ندى', 'نهى', 'تقوى',
    'بشرى', 'ذكرى', 'شذى', 'ربى', 'سجى', 'أروى', 'اروى', 'يسرى', 'لبنى',
    'أعلى', 'اعلى', 'الأعلى', 'الاعلى', 'أولى', 'اولى', 'الأولى', 'الاولى',
    'أخرى', 'اخرى', 'أدنى', 'ادنى', 'أقصى', 'اقصى', 'الوسطى', 'الكبرى',
    'الصغرى', 'العظمى', 'الحسنى', 'المثلى', 'الهدى', 'إلى', 'الى', 'حتى', 'متى',
    'لدى', 'سوى', 'مستشفى', 'معنى', 'مبنى', 'مستوى', 'مرمى', 'مجرى', 'مسعى'
]);

const restoreYehDots = (text?: string): string => {
    if (!text) return "";
    if (!text.includes('ى')) return text;
    return text
        .split(/(\s+)/)
        .map(part => {
            if (!part || !part.includes('ى')) return part;
            const bare = part.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
            if (ALEF_MAKSURA_NAMES.has(bare)) return part;
            if (
                bare.endsWith('مصطفى') ||
                bare.endsWith('مرتضى') ||
                bare.endsWith('مجتبى') ||
                bare.endsWith('مقتدى') ||
                bare.endsWith('موسى') ||
                bare.endsWith('عيسى') ||
                bare.endsWith('يحيى') ||
                bare.endsWith('اعلى') ||
                bare.endsWith('أعلى') ||
                bare.endsWith('الهدى')
            ) {
                return part;
            }
            return part.replace(/ى/g, 'ي');
        })
        .join('');
};

const cleanName = (name?: string) => {
    if (!name) return "";
    return restoreYehDots(name.replace(/\s+\d+$/, '').trim());
};

const arabicFonts = [
    { id: 'Cairo', name: 'القاهرة (Cairo)', family: "'Cairo', sans-serif", desc: 'هندسي واضح (الافتراضي)' },
    { id: 'Tajawal', name: 'تجوال (Tajawal)', family: "'Tajawal', sans-serif", desc: 'عصري ومتوازن وسلس' },
    { id: 'Almarai', name: 'المرعي (Almarai)', family: "'Almarai', sans-serif", desc: 'حديث ومرتب للهاتف' },
    { id: 'IBM Plex Sans Arabic', name: 'آي بي إم العربي', family: "'IBM Plex Sans Arabic', sans-serif", desc: 'احترافي ودقيق' },
    { id: 'Readex Pro', name: 'ريدكس برو (Readex)', family: "'Readex Pro', sans-serif", desc: 'مريح للقوائم الطويلة' },
    { id: 'Noto Kufi Arabic', name: 'كوفي عربي (Kufi)', family: "'Noto Kufi Arabic', sans-serif", desc: 'طابع كوفي أنيق' },
    { id: 'Amiri', name: 'أميري (Amiri)', family: "'Amiri', serif", desc: 'نسخي كلاسيكي تراثي' },
    { id: 'Changa', name: 'تشانغا (Changa)', family: "'Changa', sans-serif", desc: 'عريض وواضح جداً' },
];

let activeFontFamily = "'Cairo', sans-serif";
let activeFontScale = 1;

let _measureCtx: CanvasRenderingContext2D | null = null;
const getSingleLineFontSize = (
    text: string,
    maxWidth: number,
    startSize = 14,
    minSize = 8.5,
    weight = 700
): number => {
    const scaledStart = Number((startSize * activeFontScale).toFixed(2));
    const scaledMin = Number((minSize * Math.min(1.12, Math.max(0.85, activeFontScale))).toFixed(2));
    if (!text || typeof document === 'undefined') return scaledStart;
    if (!_measureCtx) {
        const canvas = document.createElement('canvas');
        _measureCtx = canvas.getContext('2d');
    }
    if (!_measureCtx) return scaledStart;
    let size = scaledStart;
    while (size > scaledMin) {
        _measureCtx.font = `${weight} ${size}px ${activeFontFamily}`;
        if (_measureCtx.measureText(text).width * 1.05 <= maxWidth) {
            return size;
        }
        size -= 0.5;
    }
    return scaledMin;
};

const normalizeArabicSearch = (text?: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim();
};

const arCollator = new Intl.Collator('ar');

const prepareArabicQuery = (rawQuery: string) => {
    const normQuery = normalizeArabicSearch(rawQuery);
    const normQueryNoSpace = normQuery.replace(/\s+/g, '');
    const queryTokens = normQuery ? normQuery.split(' ').filter(Boolean) : [];
    return { normQuery, normQueryNoSpace, queryTokens };
};

const getStudentSearchRankFast = (
    entry: { normFull: string; normFullNoSpace: string },
    prepared: { normQuery: string; normQueryNoSpace: string; queryTokens: string[] }
): number => {
    const { normQuery, normQueryNoSpace, queryTokens } = prepared;
    if (!normQueryNoSpace) return 0;

    const { normFull, normFullNoSpace } = entry;

    // 1. تطابق في بداية الاسم (مع المسافات أو كاسم مركب بدون مسافات مثل محمدعلي <-> محمد علي)
    if (normFull.startsWith(normQuery)) return 0;
    if (normFullNoSpace.startsWith(normQueryNoSpace)) return 1;

    // 2. تطابق صريح داخل الاسم (مع أو بدون مسافات للأسماء المركبة)
    const directIdx = normFull.indexOf(normQuery);
    if (directIdx !== -1) return 10 + directIdx;

    const noSpaceIdx = normFullNoSpace.indexOf(normQueryNoSpace);
    if (noSpaceIdx !== -1) return 100 + noSpaceIdx;

    // 3. تطابق جميع مقاطع البحث بالترتيب (حتى مع اختلاف المسافات أو وجود أسماء فاصلة)
    if (queryTokens.length > 1) {
        let cursor = 0;
        let firstIdx = -1;
        let allMatchedInOrder = true;
        for (let i = 0; i < queryTokens.length; i++) {
            const token = queryTokens[i];
            const foundAt = normFullNoSpace.indexOf(token, cursor);
            if (foundAt === -1) {
                allMatchedInOrder = false;
                break;
            }
            if (firstIdx === -1) firstIdx = foundAt;
            cursor = foundAt + token.length;
        }
        if (allMatchedInOrder) {
            return 1000 + firstIdx;
        }
    }

    return -1;
};

const getStudentSearchRank = (student: Student, rawQuery: string): number => {
    const prepared = prepareArabicQuery(rawQuery);
    if (!prepared.normQueryNoSpace) return 0;
    const normFull = normalizeArabicSearch(`${cleanName(student.firstName)} ${student.lastName || ''}`);
    return getStudentSearchRankFast(
        { normFull, normFullNoSpace: normFull.replace(/\s+/g, '') },
        prepared
    );
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
    'العام الدراسي للتخرج': s.graduationYear || '',
    'دور التخرج': s.graduationRound || '',
    'صف / فرع التخرج': s.graduationGrade || '',
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

let activeModalCount = 0;
let lockedScrollY = 0;
let prevHtmlOverflow = '';
let prevHtmlOverscroll = '';
let prevBodyPosition = '';
let prevBodyTop = '';
let prevBodyLeft = '';
let prevBodyRight = '';
let prevBodyWidth = '';
let prevBodyOverflow = '';
let prevBodyPaddingRight = '';
let prevFullscreenOverflow = '';

const lockBackgroundScroll = () => {
  if (activeModalCount === 0) {
    lockedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    prevHtmlOverflow = document.documentElement.style.overflow;
    prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    prevBodyPosition = document.body.style.position;
    prevBodyTop = document.body.style.top;
    prevBodyLeft = document.body.style.left;
    prevBodyRight = document.body.style.right;
    prevBodyWidth = document.body.style.width;
    prevBodyOverflow = document.body.style.overflow;
    prevBodyPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const fsEl = document.querySelector('.fullscreen-mode') as HTMLElement | null;
    if (fsEl) {
      prevFullscreenOverflow = fsEl.style.overflowY;
      fsEl.style.overflowY = 'hidden';
    }
  }
  activeModalCount += 1;
};

const unlockBackgroundScroll = () => {
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    document.body.style.position = prevBodyPosition;
    document.body.style.top = prevBodyTop;
    document.body.style.left = prevBodyLeft;
    document.body.style.right = prevBodyRight;
    document.body.style.width = prevBodyWidth;
    document.body.style.overflow = prevBodyOverflow;
    document.body.style.paddingRight = prevBodyPaddingRight;

    const fsEl = document.querySelector('.fullscreen-mode') as HTMLElement | null;
    if (fsEl) {
      fsEl.style.overflowY = prevFullscreenOverflow;
    }

    window.scrollTo(0, lockedScrollY);
  }
};

const Modal = ({ children, onClose, zIndex = "z-50", maxWidth = "max-w-lg", dismissible = true }: { children: React.ReactNode; onClose: () => void; zIndex?: string; maxWidth?: string; dismissible?: boolean }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const swipeRef = useRef<{
    active: boolean;
    decided: boolean;
    dismissing: boolean;
    startX: number;
    startY: number;
    startTime: number;
    currentDy: number;
    fromHandle: boolean;
  } | null>(null);
  const closingTimerRef = useRef<number | null>(null);
  const suppressBackdropClickRef = useRef(false);

  useEffect(() => {
    lockBackgroundScroll();
    return () => {
      unlockBackgroundScroll();
      if (closingTimerRef.current !== null) {
        window.clearTimeout(closingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!dismissible) return;
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const isScrolledDown = (startEl: HTMLElement | null, stopEl: HTMLElement | null): boolean => {
      let el: HTMLElement | null = startEl;
      while (el) {
        if (el.scrollTop > 2) return true;
        if (el === stopEl) break;
        el = el.parentElement;
      }
      if (stopEl && stopEl.scrollTop > 2) return true;
      return false;
    };

    const applySwipeVisual = (dy: number) => {
      if (cardRef.current) {
        cardRef.current.style.transform = `translate3d(0, ${dy}px, 0)`;
        cardRef.current.style.opacity = `${Math.max(0.35, 1 - dy / 460)}`;
      }
      if (overlayRef.current) {
        const bgAlpha = Math.max(0.08, 0.6 * (1 - dy / 360));
        overlayRef.current.style.backgroundColor = `rgba(15, 23, 42, ${bgAlpha})`;
      }
    };

    const finishSwipe = (cancelled: boolean) => {
      const st = swipeRef.current;
      if (!st || !st.active || st.dismissing) return;

      const dy = st.currentDy;
      const dt = Math.max(16, performance.now() - st.startTime);
      const velocity = dy / dt;
      const shouldDismiss = !cancelled && (dy >= 90 || (dy >= 32 && velocity >= 0.45));

      if (shouldDismiss) {
        st.dismissing = true;
        suppressBackdropClickRef.current = true;
        if (cardRef.current) {
          cardRef.current.style.transition = 'transform 180ms ease-out, opacity 180ms ease-out';
          cardRef.current.style.transform = `translate3d(0, ${Math.max(window.innerHeight * 0.65, dy + 220)}px, 0)`;
          cardRef.current.style.opacity = '0';
          cardRef.current.style.pointerEvents = 'none';
        }
        if (overlayRef.current) {
          overlayRef.current.style.transition = 'background-color 180ms ease-out';
          overlayRef.current.style.backgroundColor = 'rgba(15, 23, 42, 0)';
        }
        closingTimerRef.current = window.setTimeout(() => {
          onCloseRef.current();
        }, 175);
        return;
      }

      swipeRef.current = null;
      if (dy > 0) {
        suppressBackdropClickRef.current = true;
        window.setTimeout(() => {
          suppressBackdropClickRef.current = false;
        }, 60);
        if (cardRef.current) {
          cardRef.current.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out';
          cardRef.current.style.transform = 'translate3d(0, 0, 0)';
          cardRef.current.style.opacity = '1';
        }
        if (overlayRef.current) {
          overlayRef.current.style.transition = 'background-color 220ms ease-out';
          overlayRef.current.style.backgroundColor = '';
        }
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || swipeRef.current?.dismissing) return;
      const target = e.target as HTMLElement | null;
      const fromHandle = Boolean(handleRef.current && target && handleRef.current.contains(target));

      if (!fromHandle && target) {
        if (target.closest('input[type="range"], textarea, select, [contenteditable="true"], .no-swipe-dismiss')) {
          return;
        }
        if (isScrolledDown(target, overlayRef.current)) {
          return;
        }
      }

      swipeRef.current = {
        active: true,
        decided: fromHandle,
        dismissing: false,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTime: performance.now(),
        currentDy: 0,
        fromHandle,
      };

      if (cardRef.current) cardRef.current.style.transition = 'none';
      if (overlayRef.current) overlayRef.current.style.transition = 'none';
    };

    const onTouchMove = (e: TouchEvent) => {
      const st = swipeRef.current;
      if (!st || !st.active || st.dismissing) return;
      if (e.touches.length !== 1) {
        finishSwipe(true);
        return;
      }

      const dx = e.touches[0].clientX - st.startX;
      const dy = e.touches[0].clientY - st.startY;

      if (!st.decided) {
        if (Math.hypot(dx, dy) < 8) return;
        if (dy <= 0 || Math.abs(dx) > dy * 0.9 || isScrolledDown(e.target as HTMLElement | null, overlayRef.current)) {
          swipeRef.current = null;
          return;
        }
        st.decided = true;
      }

      const clampedDy = Math.max(0, dy);
      if (clampedDy > 0 || st.currentDy > 0) {
        if (e.cancelable) e.preventDefault();
      } else if (st.fromHandle && dy < -12) {
        // Ignore upward drag on the handle
        return;
      }

      st.currentDy = clampedDy;
      applySwipeVisual(clampedDy);
    };

    const onTouchEnd = () => finishSwipe(false);
    const onTouchCancel = () => finishSwipe(true);

    cardEl.addEventListener('touchstart', onTouchStart, { passive: true });
    cardEl.addEventListener('touchmove', onTouchMove, { passive: false });
    cardEl.addEventListener('touchend', onTouchEnd, { passive: true });
    cardEl.addEventListener('touchcancel', onTouchCancel, { passive: true });

    // Optional downward mouse pull on the top handle pill
    const handleEl = handleRef.current;
    let mouseDragging = false;
    const onHandleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || swipeRef.current?.dismissing) return;
      e.preventDefault();
      e.stopPropagation();
      mouseDragging = true;
      swipeRef.current = {
        active: true,
        decided: true,
        dismissing: false,
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
        currentDy: 0,
        fromHandle: true,
      };
      if (cardRef.current) cardRef.current.style.transition = 'none';
      if (overlayRef.current) overlayRef.current.style.transition = 'none';
    };
    const onWindowMouseMove = (e: MouseEvent) => {
      if (!mouseDragging || !swipeRef.current?.active || swipeRef.current.dismissing) return;
      const clampedDy = Math.max(0, e.clientY - swipeRef.current.startY);
      swipeRef.current.currentDy = clampedDy;
      applySwipeVisual(clampedDy);
    };
    const onWindowMouseUp = () => {
      if (!mouseDragging) return;
      mouseDragging = false;
      finishSwipe(false);
    };

    if (handleEl) {
      handleEl.addEventListener('mousedown', onHandleMouseDown);
      window.addEventListener('mousemove', onWindowMouseMove);
      window.addEventListener('mouseup', onWindowMouseUp);
    }

    return () => {
      cardEl.removeEventListener('touchstart', onTouchStart);
      cardEl.removeEventListener('touchmove', onTouchMove);
      cardEl.removeEventListener('touchend', onTouchEnd);
      cardEl.removeEventListener('touchcancel', onTouchCancel);
      if (handleEl) {
        handleEl.removeEventListener('mousedown', onHandleMouseDown);
        window.removeEventListener('mousemove', onWindowMouseMove);
        window.removeEventListener('mouseup', onWindowMouseUp);
      }
    };
  }, [dismissible]);

  return (
    <div 
      ref={overlayRef}
      className={`fixed inset-0 bg-slate-900/60 ${zIndex} flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm overflow-y-auto overscroll-contain modal-overlay`} 
      onClick={() => {
        if (!dismissible || suppressBackdropClickRef.current) return;
        onClose();
      }}
      style={{ left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100dvh' }}
    >
      <div 
        ref={cardRef}
        className={`w-full ${maxWidth} relative my-auto mx-auto will-change-transform`} 
        onClick={e => e.stopPropagation()}
      >
          {dismissible && (
            <>
              {/* Top Swipe-Down Handle Pill (swipe down to dismiss modal) */}
              <div
                ref={handleRef}
                className="absolute top-1 left-1/2 -translate-x-1/2 z-[60] px-12 py-2.5 flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
                title="اسحب للأسفل لإغلاق النافذة"
              >
                <span className="w-12 h-1.5 rounded-full bg-slate-300/90 dark:bg-slate-600 transition-colors hover:bg-slate-400" />
              </div>
              <button 
                  onClick={onClose} 
                  className="absolute top-2.5 left-2.5 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full shadow-md transition-all z-[60]"
                  title="إغلاق"
                  type="button"
              >
                  <X size={18} />
              </button>
            </>
          )}
          {children}
      </div>
    </div>
  );
};

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

// General Print View (كشف القيد العام) - مطابق تماماً لصفحات الجوال مع دعم التخطيط العرضي والعمودي
const PrintView = ({ 
  students, 
  title, 
  selectedFields = ['name', 'pageNumber', 'regNumber'],
  orientation = 'portrait'
}: { 
  students: Student[]; 
  title?: string; 
  selectedFields?: string[];
  orientation?: 'portrait' | 'landscape';
}) => {
  const isPortrait = orientation === 'portrait';

  useEffect(() => {
    let styleEl = document.getElementById('general-print-orientation-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'general-print-orientation-style';
      document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = isPortrait 
      ? `@page { size: portrait; margin: 4mm 5mm; }`
      : `@page { size: landscape; margin: 4mm 5mm; }`;

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

  const sortedStudents = useMemo(() => {
     return [...students].sort((a, b) => a.firstName.localeCompare(b.firstName)).map((s, i) => ({ ...s, printIndex: i + 1 }));
  }, [students]);

  // Portrait: 2 columns x 31 rows = 62 students per page (matching mobile)
  // Landscape: 3 columns x 21 rows = 63 students per page
  const ROWS_PER_COLUMN = isPortrait ? 31 : 21; 
  const COLUMNS_PER_PAGE = isPortrait ? 2 : 3;
  const MAX_ITEMS_PER_PAGE = ROWS_PER_COLUMN * COLUMNS_PER_PAGE;
  const totalItems = sortedStudents.length;
  const totalPages = Math.ceil(totalItems / MAX_ITEMS_PER_PAGE) || 1;
  const printDate = new Date().toLocaleDateString('ar-EG');
  
  const pages: (Student & { printIndex: number })[][] = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(sortedStudents.slice(i * MAX_ITEMS_PER_PAGE, (i + 1) * MAX_ITEMS_PER_PAGE));
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  const hasLastName = selectedFields.includes('lastName');
  const hasStatus = selectedFields.includes('status');

  return (
    <div className="print-only text-[9.5pt] dir-rtl font-cairo">
      <style>{`
        @page {
          size: ${isPortrait ? 'portrait' : 'landscape'};
          margin: 4mm 5mm;
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
          .general-print-page {
            width: ${isPortrait ? '200mm' : '287mm'} !important;
            max-width: ${isPortrait ? '200mm' : '287mm'} !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
            padding: 1.5mm 2.5mm !important;
            background: white !important;
            overflow: visible !important;
          }
          .general-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .general-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .general-table th, .general-table td {
            border: 1px solid black !important;
            color: black !important;
            vertical-align: middle !important;
            white-space: nowrap !important;
            word-wrap: normal !important;
            overflow-wrap: normal !important;
            overflow: hidden !important;
            text-overflow: clip !important;
            box-sizing: border-box !important;
          }
          .general-table th {
            background-color: #f3f4f6 !important;
            font-weight: 800 !important;
            font-size: 8.5pt !important;
            height: 22px !important;
            padding: 1px 2px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .general-table td {
            height: ${isPortrait ? '7.4mm' : '7.3mm'} !important;
            line-height: 1.15 !important;
            padding: 0 3px !important;
          }
        }
      `}</style>

      {pages.map((pageStudents, pageIndex) => (
        <div key={pageIndex} className="general-print-page">
          {/* Header matching mobile preview */}
          <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-2 w-full flex-shrink-0">
            <div className="text-[9pt] font-mono font-bold text-gray-700 w-32 text-right">
              صفحة {pageIndex + 1} من {totalPages}
            </div>
            <h1 className="text-xl font-black text-black flex-1 text-center font-cairo">
              {title || "كشف القيد العام"}
            </h1>
            <div className="text-[9pt] font-mono font-bold text-gray-700 w-32 text-left">
              تاريخ: {printDate}
            </div>
          </div>

          {/* Columns */}
          <div className="flex flex-row gap-2.5 sm:gap-3 flex-1 items-start">
            {Array.from({ length: COLUMNS_PER_PAGE }).map((_, colIndex) => {
              const colStudents = pageStudents.slice(colIndex * ROWS_PER_COLUMN, (colIndex + 1) * ROWS_PER_COLUMN);
              return (
                <div key={colIndex} className="flex-1 flex flex-col">
                  <table className="general-table w-full">
                    <thead>
                      <tr className="bg-gray-100 text-center">
                        <th style={{ width: '9%' }} className="text-center font-bold">ت</th>
                        <th style={{ width: hasLastName || hasStatus ? '50%' : '63%' }} className="text-right font-bold pr-2">
                          الاسم الكامل
                        </th>
                        {hasLastName && (
                          <th style={{ width: '18%' }} className="text-right font-bold pr-1">اللقب</th>
                        )}
                        <th style={{ width: '14%' }} className="text-center font-bold">ص</th>
                        <th style={{ width: '14%' }} className="text-center font-bold">قيد</th>
                        {hasStatus && (
                          <th style={{ width: '14%' }} className="text-center font-bold">الحالة</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: ROWS_PER_COLUMN }).map((_, rowIndex) => {
                        const s = colStudents[rowIndex];
                        const studentFullName = s ? (hasLastName ? cleanName(s.firstName) : `${cleanName(s.firstName)} ${s.lastName || ''}`.trim()) : '';
                        const statusMap: Record<string, string> = { 'active': 'م', 'transferred': 'ن', 'left': 'ت', 'graduated': 'خ' };

                        const getNameStyle = (name: string) => {
                          const len = name.length;
                          if (len <= 20) return { fontSize: '8.2pt', letterSpacing: 'normal' };
                          if (len <= 26) return { fontSize: '7.4pt', letterSpacing: '-0.15px' };
                          if (len <= 32) return { fontSize: '6.6pt', letterSpacing: '-0.25px' };
                          return { fontSize: '6.0pt', letterSpacing: '-0.35px' };
                        };

                        return (
                          <tr key={rowIndex} style={{ height: isPortrait ? '7.4mm' : '7.3mm' }}>
                            <td className="text-center font-bold font-mono text-[8pt]">
                              {s ? s.printIndex : ''}
                            </td>
                            <td 
                              className="text-right font-bold pr-2 whitespace-nowrap overflow-hidden"
                              style={getNameStyle(studentFullName)}
                              title={studentFullName}
                            >
                              {studentFullName}
                            </td>
                            {hasLastName && (
                              <td className="text-right font-bold pr-1 whitespace-nowrap overflow-hidden text-[7.8pt]">
                                {s ? (s.lastName || '') : ''}
                              </td>
                            )}
                            <td className="text-center font-bold font-mono text-[9pt]">
                              {s ? s.pageNumber : ''}
                            </td>
                            <td className="text-center font-bold font-mono text-[9pt]">
                              {s ? s.regNumber : ''}
                            </td>
                            {hasStatus && (
                              <td className="text-center font-bold font-mono text-[8.5pt]">
                                {s ? statusMap[s.status || 'active'] : ''}
                              </td>
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
    const originalTitle = document.title;
    const docTitle = selectedYear && selectedYear !== 'ALL'
      ? `صادر الوثائق لسنة ${selectedYear}`
      : 'صادر الوثائق - جميع السنوات';
    document.title = docTitle;

    const handleAfterPrint = () => {
      document.title = 'سجل القيد العام';
    };
    window.addEventListener('afterprint', handleAfterPrint);

    let styleEl = document.getElementById('docs-page-orientation-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'docs-page-orientation-style';
      document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = isPortrait 
      ? `@page { size: portrait; margin: 4mm 4mm; }`
      : `@page { size: landscape; margin: 3mm 4mm; }`;

    if (!isPortrait) {
      document.body.classList.add('print-landscape');
    } else {
      document.body.classList.remove('print-landscape');
    }
    return () => {
      document.title = 'سجل القيد العام';
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-landscape');
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [isPortrait, selectedYear]);

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
          size: ${isPortrait ? 'portrait' : 'landscape'};
          margin: ${isPortrait ? '4mm 4mm' : '3mm 4mm'};
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
            width: ${isPortrait ? '202mm' : '289mm'} !important;
            height: ${isPortrait ? '280mm' : '198mm'} !important;
            max-height: ${isPortrait ? '280mm' : '198mm'} !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: ${isPortrait ? '2mm 3mm' : '1mm 3mm'} !important;
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
            white-space: nowrap !important;
            word-wrap: normal !important;
            overflow-wrap: normal !important;
            overflow: hidden !important;
            text-overflow: clip !important;
          }
          .docs-table th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
            font-size: ${isPortrait ? '8pt' : '8.2pt'} !important;
            height: ${isPortrait ? '23px' : '19px'} !important;
            padding: 1px 3px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .docs-table td {
            font-size: ${isPortrait ? '7.5pt' : '7.8pt'} !important;
            height: ${isPortrait ? '8.0mm' : '5.35mm'} !important;
            line-height: 1.15 !important;
            padding: 0 3px !important;
          }
          .docs-page-footer {
            height: 17px !important;
            box-sizing: border-box !important;
            break-before: avoid !important;
            page-break-before: avoid !important;
          }
        }
      `}</style>
      
      {pages.map((pageRows, pageIdx) => (
        <div key={pageIdx} className="docs-print-page">
          <div className="flex-1 flex flex-col justify-start">
            {/* Minimal Official Header: Title with Year badge and School Name */}
            <div className="text-center border-b-2 border-slate-900 pb-1 mb-1 w-full flex-shrink-0">
              <div className="text-lg sm:text-xl font-black text-slate-900 tracking-wide font-cairo leading-snug flex items-center justify-center gap-2">
                <span>سجل صادر الوثائق</span>
                {selectedYear && selectedYear !== 'ALL' ? (
                  <span className="text-xs sm:text-sm font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-400 font-mono">
                    لسنة {selectedYear}
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-400">
                    (جميع السنوات)
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
                ث. ش. محمد عبدالعزيز الكنعان للبنين
              </div>
            </div>

            {/* Official Table */}
            <table className="docs-table w-full">
              <thead>
                <tr className="bg-slate-100 text-center">
                  <th style={{ width: '4%' }} className="text-center font-bold">ت</th>
                  <th style={{ width: '10%' }} className="text-center font-bold">تاريخ الوثيقة</th>
                  <th style={{ width: '28.5%' }} className="text-right font-bold pr-2">اسم الطالب الرباعي</th>
                  <th style={{ width: '24%' }} className="text-right font-bold pr-2">الجهة الصادر إليها</th>
                  <th style={{ width: '11%' }} className="text-center font-bold">الغرض من الوثيقة</th>
                  <th style={{ width: '11.5%' }} className="text-center font-bold">الصف الذي انتقل فيه</th>
                  <th style={{ width: '11%' }} className="text-center font-bold">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROWS_PER_PAGE }).map((_, rIdx) => {
                  const s = pageRows[rIdx];
                  const serial = pageIdx * ROWS_PER_PAGE + rIdx + 1;
                  // Quadruple name without family title/nickname as requested
                  const studentFullName = s ? cleanName(s.firstName) : '';
                  const destination = s?.docDestination || '';
                  const purpose = s?.docPurpose || '';
                  const transferGrade = s?.transferGrade || '';

                  // Dynamic font scaling for full visibility without ellipsis
                  const getNameStyle = (name: string) => {
                    const len = name.length;
                    if (isPortrait) {
                      if (len <= 18) return { fontSize: '7.4pt', letterSpacing: 'normal' };
                      if (len <= 23) return { fontSize: '6.7pt', letterSpacing: '-0.2px' };
                      if (len <= 28) return { fontSize: '6.0pt', letterSpacing: '-0.3px' };
                      return { fontSize: '5.4pt', letterSpacing: '-0.4px' };
                    } else {
                      if (len <= 20) return { fontSize: '8.2pt', letterSpacing: 'normal' };
                      if (len <= 26) return { fontSize: '7.5pt', letterSpacing: '-0.15px' };
                      if (len <= 32) return { fontSize: '6.8pt', letterSpacing: '-0.25px' };
                      return { fontSize: '6.2pt', letterSpacing: '-0.35px' };
                    }
                  };

                  const getDestStyle = (dest: string) => {
                    const len = dest.length;
                    if (isPortrait) {
                      if (len <= 18) return { fontSize: '7.2pt', letterSpacing: 'normal' };
                      if (len <= 24) return { fontSize: '6.4pt', letterSpacing: '-0.2px' };
                      if (len <= 30) return { fontSize: '5.8pt', letterSpacing: '-0.3px' };
                      return { fontSize: '5.2pt', letterSpacing: '-0.4px' };
                    } else {
                      if (len <= 20) return { fontSize: '8.0pt', letterSpacing: 'normal' };
                      if (len <= 27) return { fontSize: '7.3pt', letterSpacing: '-0.15px' };
                      if (len <= 34) return { fontSize: '6.6pt', letterSpacing: '-0.25px' };
                      return { fontSize: '6.0pt', letterSpacing: '-0.35px' };
                    }
                  };

                  const getGradeStyle = (grade: string) => {
                    const len = grade.length;
                    const base = isPortrait ? 7.1 : 7.8;
                    if (len <= 10) return { fontSize: `${base}pt`, letterSpacing: 'normal' };
                    return { fontSize: `${(base * 0.86).toFixed(2)}pt`, letterSpacing: '-0.2px' };
                  };

                  const getPurposeStyle = (purp: string) => {
                    const len = purp.length;
                    const base = isPortrait ? 6.8 : 7.6;
                    if (len <= 14) return { fontSize: `${base}pt`, letterSpacing: 'normal' };
                    return { fontSize: `${(base * 0.85).toFixed(2)}pt`, letterSpacing: '-0.2px' };
                  };

                  return (
                    <tr key={rIdx} style={{ height: isPortrait ? '8.0mm' : '5.35mm' }}>
                      <td className="text-center font-bold font-mono">{s ? serial : ''}</td>
                      <td className="text-center font-mono font-bold whitespace-nowrap text-[7.2pt] sm:text-[7.8pt]">{s ? (s.docDate || '—') : ''}</td>
                      <td 
                        className="text-right font-bold whitespace-nowrap overflow-hidden pr-2"
                        style={getNameStyle(studentFullName)}
                        title={studentFullName}
                      >
                        {studentFullName}
                      </td>
                      <td 
                        className="text-right font-medium whitespace-nowrap overflow-hidden pr-2"
                        style={getDestStyle(destination)}
                        title={destination}
                      >
                        {s ? (destination || '—') : ''}
                      </td>
                      <td 
                        className="text-center font-medium whitespace-nowrap overflow-hidden px-1"
                        style={getPurposeStyle(purpose)}
                        title={purpose}
                      >
                        {s ? (purpose || '—') : ''}
                      </td>
                      <td 
                        className="text-center font-bold whitespace-nowrap overflow-hidden px-1"
                        style={getGradeStyle(transferGrade)}
                        title={transferGrade}
                      >
                        {s ? (transferGrade || '—') : ''}
                      </td>
                      <td className="text-center"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Page Footer with Print Date, School Log Title, and Page Sequence */}
          <div className="docs-page-footer pt-1 border-t-2 border-slate-900 mt-0.5 flex justify-between items-center px-4 text-xs font-bold text-slate-700 flex-shrink-0">
            <div className="text-[8.5pt] font-bold text-slate-800">تاريخ الطباعة: {printDate}</div>
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

interface ModernAppLayoutProps {
  students: Student[];
  filtered: Student[];
  displayed: Student[];
  selectedStudents: string[];
  setSelectedStudents: React.Dispatch<React.SetStateAction<string[]>>;
  search: string;
  setSearch: (s: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isListening: boolean;
  startVoiceSearch: () => void;
  inSearchMode: boolean;
  setIsSearchActive: (b: boolean) => void;
  showSearchFilters: boolean;
  setShowSearchFilters: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRegFilter: string;
  setSelectedRegFilter: (r: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  yearFilter: string;
  setYearFilter: (y: string) => void;
  years: (string | number)[];
  regsCount: number;
  alphabetLetters: string[];
  studentsByLetter: Record<string, Student[]>;
  currentTheme: { primary: string; hover: string; secondary: string; secondaryHover: string; ring: string; name: string };
  setSelectedId: (id: string | null) => void;
  setView: (v: 'list' | 'add' | 'edit' | 'detail' | 'trash' | 'settings' | 'stats') => void;
  setSimilarStudents: (s: Student[]) => void;
  setPrintMode: (m: 'none' | 'list' | 'single' | 'selected' | 'docsExport') => void;
  setShowPrintModal: (b: boolean) => void;
  setShowPrintTemplateModal: (b: boolean) => void;
  setShowPrintSelectedModal: (b: boolean) => void;
  handleDelete: (id: string) => void;
  handleRestore: (id: string) => void;
  handleDeleteForever: (id: string) => void;
  handleBulkDelete: () => void;
  shareViaWhatsApp: (students: Student[]) => void;
  cleanName: (name: string) => string;
  modernViewType: 'table' | 'grid';
  setModernViewType: (t: 'table' | 'grid') => void;
  view: string;
  debouncedQuery: string;
  setVisibleCount?: React.Dispatch<React.SetStateAction<number>>;
  onOpenQuickStatus: (student: Student) => void;
}

const ModernAppLayout = ({
  students,
  filtered,
  displayed,
  selectedStudents,
  setSelectedStudents,
  search,
  setSearch,
  searchInputRef,
  isListening,
  startVoiceSearch,
  inSearchMode,
  setIsSearchActive,
  showSearchFilters,
  setShowSearchFilters,
  selectedRegFilter,
  setSelectedRegFilter,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  yearFilter,
  setYearFilter,
  years,
  regsCount,
  alphabetLetters,
  studentsByLetter,
  currentTheme,
  setSelectedId,
  setView,
  setSimilarStudents,
  setPrintMode,
  setShowPrintModal,
  setShowPrintTemplateModal,
  setShowPrintSelectedModal,
  handleDelete,
  handleBulkDelete,
  shareViaWhatsApp,
  cleanName,
  modernViewType,
  setModernViewType,
  debouncedQuery,
  setVisibleCount,
  onOpenQuickStatus,
}: ModernAppLayoutProps) => {
  const activeCount = useMemo(() => students.filter(s => !s.isDeleted && (s.status === 'active' || !s.status)).length, [students]);
  const transferredCount = useMemo(() => students.filter(s => !s.isDeleted && (s.status === 'transferred' || !!s.docDestination || !!s.docDate)).length, [students]);
  const leftCount = useMemo(() => students.filter(s => !s.isDeleted && s.status === 'left').length, [students]);
  const graduatedCount = useMemo(() => students.filter(s => !s.isDeleted && s.status === 'graduated').length, [students]);
  const totalCount = useMemo(() => students.filter(s => !s.isDeleted).length, [students]);

  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [expandedStudentIds, setExpandedStudentIds] = useState<string[]>([]);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 390
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleExpandStudent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCopyStudentName = (e: React.MouseEvent, student: Student) => {
    e.stopPropagation();
    const fullName = `${cleanName(student.firstName)}${student.lastName ? ' ' + restoreYehDots(student.lastName) : ''}`.trim();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(fullName).catch(() => {
        fallbackCopyText(fullName);
      });
    } else {
      fallbackCopyText(fullName);
    }
    setCopiedStudentId(student.id);
    setTimeout(() => {
      setCopiedStudentId(null);
    }, 1500);
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch {
      // ignore
    }
  };

  const handleJumpToLetter = (letter: string) => {
    const normLetter = letter.trim();
    const alefs = ['أ', 'إ', 'آ', 'ا'];
    const isAlef = alefs.includes(normLetter);

    const targetIdx = filtered.findIndex(s => {
      const firstChar = cleanName(s.firstName).trim().charAt(0);
      if (!firstChar) return false;
      if (firstChar === normLetter) return true;
      if (isAlef && alefs.includes(firstChar)) return true;
      return false;
    });

    if (targetIdx !== -1) {
      if (setVisibleCount && targetIdx >= displayed.length) {
        setVisibleCount(Math.max(displayed.length, targetIdx + 60));
      }

      const targetStudent = filtered[targetIdx];
      const targetChar = cleanName(targetStudent.firstName).trim().charAt(0);

      const doScroll = () => {
        const isMobile = window.innerWidth < 768;
        let el: HTMLElement | null = null;

        if (modernViewType === 'grid') {
          el = document.getElementById(`modern-grid-section-${targetChar}`) ||
               document.getElementById(`modern-grid-section-${normLetter}`) ||
               document.getElementById(`modern-grid-student-${targetStudent.id}`);
        } else if (isMobile) {
          el = document.getElementById(`modern-mobile-section-${targetChar}`) ||
               document.getElementById(`modern-mobile-section-${normLetter}`) ||
               document.getElementById(`modern-mobile-student-${targetStudent.id}`);
        } else {
          el = document.getElementById(`modern-section-${targetChar}`) ||
               document.getElementById(`modern-section-${normLetter}`) ||
               document.getElementById(`modern-desktop-student-${targetStudent.id}`);
        }

        if (!el) {
          el = document.getElementById(`student-item-${targetStudent.id}`) ||
               document.getElementById(`section-${targetChar}`) ||
               document.getElementById(`mobile-section-${targetChar}`);
        }

        if (el) {
          const rect = el.getBoundingClientRect();
          const offset = 120;
          const top = rect.top + window.pageYOffset - offset;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          return true;
        }
        return false;
      };

      setTimeout(() => {
        if (!doScroll()) {
          setTimeout(doScroll, 120);
        }
      }, 50);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. Modern Hero Stats Cards */}
      {!inSearchMode && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Students */}
          <div 
            onClick={() => {
              setSelectedRegFilter('');
              setStatusFilter('ALL');
              setYearFilter('ALL');
              setSearch('');
            }}
            className="glass-panel modern-card-hover p-4 rounded-2xl cursor-pointer relative overflow-hidden group select-none border border-slate-200/90 dark:border-slate-800"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الطلاب</span>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs">
                <Users size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">
              {totalCount}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
              <span>جميع القيود والسنوات</span>
            </div>
          </div>

          {/* Card 2: Active Students */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'ALL' : 'active')}
            className={`glass-panel modern-card-hover p-4 rounded-2xl cursor-pointer relative overflow-hidden group select-none border transition-all ${
              statusFilter === 'active' 
                ? 'ring-2 ring-emerald-500/50 border-emerald-500/60 bg-emerald-500/5' 
                : 'border-slate-200/90 dark:border-slate-800'
            }`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الطلاب المستمرون</span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <GraduationCap size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {activeCount}
            </div>
            <div className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>مستمر بالدراسة</span>
            </div>
          </div>

          {/* Card 3: Transferred & Outgoing Docs */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'transferred' ? 'ALL' : 'transferred')}
            className={`glass-panel modern-card-hover p-4 rounded-2xl cursor-pointer relative overflow-hidden group select-none border transition-all ${
              statusFilter === 'transferred' 
                ? 'ring-2 ring-amber-500/50 border-amber-500/60 bg-amber-500/5' 
                : 'border-slate-200/90 dark:border-slate-800'
            }`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">صادر الوثائق والنقل</span>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs">
                <FileText size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
              {transferredCount}
            </div>
            <div className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>وثيقة صادرة / منقول</span>
            </div>
          </div>

          {/* Card 4: Reg Books & Stats */}
          <div 
            onClick={() => setView('stats')}
            className="glass-panel modern-card-hover p-4 rounded-2xl cursor-pointer relative overflow-hidden group select-none border border-slate-200/90 dark:border-slate-800"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">دفاتر القيود</span>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-xs">
                <FileSpreadsheet size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono tracking-tight">
              {regsCount}
            </div>
            <div className="text-[11px] font-semibold text-purple-700/80 dark:text-purple-400/80 mt-1 flex items-center gap-1">
              <span>انقر لعرض الإحصائيات 📊</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modern Command Search & Actions Bar */}
      <div className={`glass-panel modern-card-shadow rounded-2xl p-2.5 sm:p-3 space-y-2.5 border border-slate-200/90 dark:border-slate-800 ${inSearchMode ? 'sticky top-2 z-30' : ''}`}>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Input Box */}
          <div className={`relative flex-1 flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 focus-within:ring-2 ${currentTheme.ring} transition-all`}>
            <Search className="text-slate-400 ml-2 shrink-0" size={17} />
            <input 
              ref={searchInputRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm placeholder:text-slate-400 min-w-0"
              placeholder="ابحث باسم الطالب أو اللقب..."
              value={search}
              onFocus={() => setIsSearchActive(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setIsSearchActive(true);
              }}
            />
            {search.length > 0 && (
              <button 
                type="button"
                onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors mx-0.5 shrink-0 cursor-pointer"
                title="مسح البحث"
              >
                <X size={15} />
              </button>
            )}
            <button 
              type="button"
              onClick={startVoiceSearch}
              className={`p-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${isListening ? 'bg-red-100 text-red-600 voice-listening' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}
              title="بحث صوتي"
            >
              <Mic size={16} />
            </button>
            {inSearchMode && (
              <>
                <button 
                  type="button"
                  onClick={() => setShowSearchFilters(prev => !prev)} 
                  className={`p-1.5 rounded-lg transition-all shrink-0 cursor-pointer mx-0.5 flex items-center gap-1 text-[11px] font-bold border ${
                    showSearchFilters || selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={showSearchFilters ? "إخفاء الفلاتر" : "إظهار الفلاتر"}
                >
                  <Filter size={14} />
                  {(selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setIsSearchActive(false);
                    setShowSearchFilters(false);
                    searchInputRef.current?.blur();
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 mr-1 shrink-0 border border-blue-200 dark:border-blue-800 cursor-pointer"
                >
                  إلغاء
                </button>
              </>
            )}
          </div>

          {/* Primary Action Toolbar (Hidden in Search Mode to show more names) */}
          {!inSearchMode && (
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-1 sm:gap-2 shrink-0">
              <button 
                onClick={() => { setSelectedId(null); setView('add'); setSimilarStudents([]); }} 
                className={`h-8 sm:h-9 px-2.5 sm:px-3.5 ${currentTheme.primary} ${currentTheme.hover} text-white rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0`}
                title="إضافة طالب جديد (Ctrl+N)"
              >
                <Plus size={14} className="shrink-0" />
                <span>طالب جديد</span>
              </button>

              <button 
                onClick={() => setShowPrintModal(true)} 
                className="h-8 sm:h-9 px-2.5 sm:px-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="طباعة السجل (Ctrl+P)"
              >
                <Printer size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span>طباعة</span>
              </button>

              {/* Toggle Filter Button */}
              <button 
                type="button"
                onClick={() => setShowSearchFilters(prev => !prev)} 
                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  showSearchFilters || selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
                title={showSearchFilters ? "إخفاء الفلاتر لعرض المزيد من الأسماء" : "إظهار الفلاتر"}
              >
                <Filter size={14} className="shrink-0" />
                <span className="hidden sm:inline">{showSearchFilters ? 'إخفاء الفلاتر' : 'فلاتر'}</span>
                <span className="sm:hidden">فلاتر</span>
                {(selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                )}
              </button>

              {/* View Mode Switcher: Table vs Cards */}
              <div className="h-8 sm:h-9 flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                <button 
                  onClick={() => setModernViewType('table')} 
                  className={`h-full px-1.5 sm:p-1.5 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    modernViewType === 'table' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                  title="عرض الجدول"
                >
                  <List size={14} />
                </button>
                <button 
                  onClick={() => setModernViewType('grid')} 
                  className={`h-full px-1.5 sm:p-1.5 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    modernViewType === 'grid' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                  title="عرض البطاقات"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>

              <button 
                onClick={() => setShowPrintTemplateModal(true)} 
                className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                title="تخصيص أعمدة الطباعة"
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Filter Drawer Strip - Fully collapsible even when filters are active */}
        {showSearchFilters && (
          <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5 animate-fade-in">
            {/* Select Dropdowns Row (including Status Dropdown) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold outline-none text-slate-800 dark:text-slate-200 cursor-pointer"
                aria-label="تصفية حسب الحالة"
              >
                <option value="ALL">جميع الحالات ({totalCount})</option>
                <option value="active">مستمر ({activeCount})</option>
                <option value="transferred">منقول ({transferredCount})</option>
                <option value="left">تارك ({leftCount})</option>
                <option value="graduated">متخرج ({graduatedCount})</option>
              </select>

              <select 
                value={selectedRegFilter} 
                onChange={(e) => setSelectedRegFilter(e.target.value)} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold outline-none text-slate-800 dark:text-slate-200 cursor-pointer"
                aria-label="تصفية حسب دفتر القيد"
              >
                <option value="">جميع دفاتر القيود</option>
                {Array.from(new Set(students.filter(s => !s.isDeleted).map(s => s.regNumber))).sort((a,b) => Number(a)-Number(b)).map(r => (
                  <option key={r} value={r}>قيد {r}</option>
                ))}
              </select>

              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold outline-none text-slate-800 dark:text-slate-200 cursor-pointer"
                aria-label="ترتيب النتائج"
              >
                <option value="recent">الترتيب: الأحدث أولاً</option>
                <option value="alphabetical">الترتيب: أبجدي (أ - ي)</option>
                <option value="byPage">الترتيب: حسب رقم الصفحة</option>
              </select>

              <select 
                value={yearFilter} 
                onChange={e => setYearFilter(e.target.value)} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold outline-none text-slate-800 dark:text-slate-200 cursor-pointer"
                aria-label="تصفية حسب السنة"
              >
                <option value="ALL">جميع سنوات القيد</option>
                {years.map(y => <option key={y} value={y}>سنة {y}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                إجمالي النتائج: <span className="font-mono text-slate-700 dark:text-slate-200">{filtered.length}</span> طالب
              </div>
              <div className="flex items-center gap-1.5">
                {(selectedRegFilter || statusFilter !== 'ALL' || yearFilter !== 'ALL') && (
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectedRegFilter('');
                      setStatusFilter('ALL');
                      setYearFilter('ALL');
                    }}
                    className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl px-2.5 py-1.5 text-xs font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>إعادة ضبط</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSearchFilters(false)}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X size={13} />
                  <span>إخفاء الفلاتر</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Modern Alphabet Rail */}
      {sortBy === 'alphabetical' && !debouncedQuery && alphabetLetters.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 no-scrollbar glass-panel rounded-2xl border border-slate-200/80 dark:border-slate-800 animate-fade-in">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 shrink-0">فهرس الحروف:</span>
          {alphabetLetters.map(letter => (
            <button
              key={letter}
              type="button"
              onClick={() => handleJumpToLetter(letter)}
              className="w-7 h-7 shrink-0 rounded-lg text-xs font-black flex items-center justify-center bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
              title={`الانتقال إلى حرف ${letter}`}
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      {/* 4. Modern Data Presentation */}
      {modernViewType === 'table' ? (
        /* Modern Table & Mobile List Container */
        <div className="glass-panel modern-card-shadow rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
          <div className="p-3 bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <label className="md:hidden inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) setSelectedStudents(displayed.map(s => s.id));
                    else setSelectedStudents([]);
                  }}
                  checked={displayed.length > 0 && displayed.every(s => selectedStudents.includes(s.id))}
                  className="rounded border-slate-300 cursor-pointer w-4 h-4"
                />
              </label>
              <span>سجل الطلاب ({filtered.length})</span>
              {selectedStudents.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full text-[10px]">
                  {selectedStudents.length} محدد
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              {sortBy === 'alphabetical' ? 'مرتب أبجدياً' : sortBy === 'byPage' ? 'مرتب حسب الصفحة' : 'مرتب بالأحدث'}
            </div>
          </div>

          {/* 4A. Dedicated Mobile Responsive List (< md) */}
          <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50/40 dark:bg-slate-950/30">
            {displayed.map((s, idx) => {
              const isSelected = selectedStudents.includes(s.id);
              const isExpanded = expandedStudentIds.includes(s.id);
              const firstLetter = cleanName(s.firstName).charAt(0) || 'ط';
              const isFirstOfLetter = sortBy === 'alphabetical' && !debouncedQuery && (
                idx === 0 || cleanName(displayed[idx - 1].firstName).charAt(0) !== firstLetter
              );
              return (
                <React.Fragment key={s.id}>
                  {isFirstOfLetter && (
                    <div 
                      id={`modern-mobile-section-${firstLetter}`}
                      className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-black text-blue-600 dark:text-blue-400"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[11px]">
                          {firstLetter}
                        </span>
                        <span>حرف {firstLetter}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {studentsByLetter[firstLetter]?.length ? `${studentsByLetter[firstLetter].length} طالب` : ''}
                      </span>
                    </div>
                  )}
                  <div 
                    id={`modern-mobile-student-${s.id}`}
                    onClick={() => { setSelectedId(s.id); setView('detail'); }}
                    className={`bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-3 border transition-all cursor-pointer active:scale-[0.99] shadow-2xs ${
                      isSelected 
                        ? 'border-blue-500 ring-1 ring-blue-500/25 bg-blue-50/20 dark:bg-blue-950/20' 
                        : 'border-slate-200/90 dark:border-slate-800'
                    }`}
                  >
                    {/* Line 1: 100% Full-Width Single-Line Student Name + Inline Blue Surname */}
                    <div className="w-full min-w-0 mb-2 overflow-hidden">
                      {(() => {
                        const surname = restoreYehDots(s.lastName);
                        const displayFull = `#${idx + 1} ${cleanName(s.firstName)}${surname ? ` (${surname})` : ''}`;
                        const availWidth = Math.max(210, viewportWidth - 84);
                        const fittedFontSize = getSingleLineFontSize(displayFull, availWidth, 14, 7.5, 700);
                        return (
                          <div
                            className="font-bold text-slate-900 dark:text-slate-100 leading-relaxed py-0.5 whitespace-nowrap overflow-hidden"
                            style={{ fontSize: `${fittedFontSize}px` }}
                            title={`${cleanName(s.firstName)}${surname ? ` (${surname})` : ''}`}
                          >
                            <span className="font-mono tabular-nums text-[0.82em] font-bold text-slate-400 ml-1">
                              #{idx + 1}
                            </span>
                            <span>{cleanName(s.firstName)}</span>
                            {surname && (
                              <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">
                                ({surname})
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Line 2: Checkbox + Status + Reg + Page on right; Copy + Expand Arrow on left */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <div className="shrink-0 flex items-center ml-0.5" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedStudents([...selectedStudents, s.id]);
                              else setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                            }}
                            className="rounded border-slate-300 cursor-pointer w-4 h-4 accent-blue-600"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenQuickStatus(s);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer hover:opacity-90 active:scale-95 shrink-0 ${
                            s.status === 'graduated' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' :
                            s.status === 'left' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                            s.status === 'transferred' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          }`}
                          title="تعديل سريع للحالة"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            s.status === 'graduated' ? 'bg-blue-600' :
                            s.status === 'left' ? 'bg-rose-600' :
                            s.status === 'transferred' ? 'bg-amber-600' :
                            'bg-emerald-600'
                          }`}></span>
                          <span>{s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}</span>
                        </button>

                        <span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded-lg font-mono tabular-nums font-bold text-[11px] whitespace-nowrap`}>
                          قيد {s.regNumber}
                        </span>

                        <span className="bg-amber-50 text-amber-900 border border-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-lg font-mono tabular-nums font-bold text-[11px] whitespace-nowrap">
                          ص {s.pageNumber}
                        </span>
                      </div>

                      {/* Left: Copy + Expand Details Arrow */}
                      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleCopyStudentName(e, s)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center"
                          title={copiedStudentId === s.id ? "تم النسخ!" : "نسخ اسم الطالب"}
                        >
                          {copiedStudentId === s.id ? (
                            <Check size={15} className="text-emerald-600" />
                          ) : (
                            <Copy size={15} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => toggleExpandStudent(e, s.id)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center ${
                            isExpanded
                              ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={isExpanded ? "إخفاء التفاصيل" : "عرض الصف والتفاصيل"}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details Drawer (Hidden by default; reveals Grade + Full Details when pressing arrow) */}
                    {isExpanded && (
                      <div
                        className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px] animate-fade-in"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-50/90 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          {s.transferGrade && (
                            <div className="col-span-2 text-amber-800 dark:text-amber-300 font-bold">
                              الصف: <span className="font-black">{s.transferGrade}</span>
                            </div>
                          )}
                          {s.status === 'graduated' && s.graduationGrade && (
                            <div className="col-span-2 text-blue-800 dark:text-blue-300 font-bold">
                              الصف / الفرع: <span className="font-black">{s.graduationGrade}</span>
                            </div>
                          )}
                          {s.docDestination && (
                            <div className="col-span-2 text-slate-700 dark:text-slate-200 font-semibold">
                              الجهة: <span className="font-bold">{s.docDestination}</span>
                            </div>
                          )}
                          {s.docDate && (
                            <div className="text-slate-600 dark:text-slate-300 font-semibold">
                              تاريخ الوثيقة: <span className="font-mono font-bold">{s.docDate}</span>
                            </div>
                          )}
                          {s.docPurpose && (
                            <div className="text-slate-600 dark:text-slate-300 font-semibold">
                              الغرض: <span className="font-bold">{s.docPurpose}</span>
                            </div>
                          )}
                          {s.graduationYear && (
                            <div className="text-slate-600 dark:text-slate-300 font-semibold">
                              العام الدراسي: <span className="font-mono font-bold">{s.graduationYear}</span>
                            </div>
                          )}
                          {s.graduationRound && (
                            <div className="text-slate-600 dark:text-slate-300 font-semibold">
                              الدور: <span className="font-bold">{s.graduationRound}</span>
                            </div>
                          )}
                          <div className="text-slate-500 dark:text-slate-400 font-semibold">
                            تاريخ التسجيل: <span className="font-mono">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
                          </div>
                          {s.notes && (
                            <div className="col-span-2 text-slate-600 dark:text-slate-300 font-semibold">
                              ملاحظات: <span>{s.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => { setSelectedId(s.id); setView('detail'); }}
                            className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold flex items-center justify-center gap-1 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <Eye size={13} /> عرض
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedId(s.id); setView('edit'); setSimilarStudents([]); }}
                            className="flex-1 py-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold flex items-center justify-center gap-1 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <Edit2 size={13} /> تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedId(s.id); setPrintMode('single'); setTimeout(() => window.print(), 500); }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold flex items-center justify-center gap-1 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="طباعة"
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 font-bold flex items-center justify-center gap-1 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* 4B. Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[700px]">
              <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2.5 w-10 text-center">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudents(displayed.map(s => s.id));
                        else setSelectedStudents([]);
                      }}
                      checked={displayed.length > 0 && displayed.every(s => selectedStudents.includes(s.id))}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="p-2.5 w-12 text-center">#</th>
                  <th className="p-2.5">اسم الطالب الكامل</th>
                  {/* SWAPPED: الصفحة then القيد */}
                  <th className="p-2.5 w-24 text-center">الصفحة (ص)</th>
                  <th className="p-2.5 w-24 text-center">رقم القيد</th>
                  <th className="p-2.5 w-28 text-center">الحالة الدراسية</th>
                  <th className="p-2.5 w-36 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {displayed.map((s, idx) => {
                  const isSelected = selectedStudents.includes(s.id);
                  const firstLetter = cleanName(s.firstName).charAt(0) || 'ط';
                  const isFirstOfLetter = sortBy === 'alphabetical' && !debouncedQuery && (
                    idx === 0 || cleanName(displayed[idx - 1].firstName).charAt(0) !== firstLetter
                  );
                  return (
                    <React.Fragment key={s.id}>
                      {isFirstOfLetter && (
                        <tr 
                          id={`modern-section-${firstLetter}`}
                          className="bg-slate-100/95 dark:bg-slate-800/95 text-blue-600 dark:text-blue-400 font-black text-xs border-y border-slate-200 dark:border-slate-700"
                        >
                          <td colSpan={7} className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[11px]">
                                {firstLetter}
                              </span>
                              <span>حرف {firstLetter}</span>
                              <span className="text-[10px] font-bold text-slate-400">({studentsByLetter[firstLetter]?.length || 0} طالب)</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr 
                        id={`modern-desktop-student-${s.id}`}
                        onClick={() => { setSelectedId(s.id); setView('detail'); }}
                        className={`hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedStudents([...selectedStudents, s.id]);
                              else setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                            }}
                            className="rounded border-slate-300 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-slate-700">
                              {firstLetter}
                            </div>
                            <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
                              <span
                                className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors whitespace-nowrap leading-relaxed py-0.5"
                                style={{ fontSize: `${getSingleLineFontSize(`${cleanName(s.firstName)}${s.lastName ? ` (${restoreYehDots(s.lastName)})` : ''}`, 320, 14, 10, 700)}px` }}
                              >
                                {cleanName(s.firstName)}
                                {s.lastName && (
                                  <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">
                                    ({restoreYehDots(s.lastName)})
                                  </span>
                                )}
                              </span>
                              {/* Small Copy Button */}
                              <button
                                type="button"
                                onClick={(e) => handleCopyStudentName(e, s)}
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center"
                                title={copiedStudentId === s.id ? "تم النسخ!" : "نسخ اسم الطالب"}
                              >
                                {copiedStudentId === s.id ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.5 rounded">
                                    <Check size={11} /> منسوخ
                                  </span>
                                ) : (
                                  <Copy size={13} className="text-slate-400 hover:text-blue-600" />
                                )}
                              </button>
                              {/* Quick status edit icon shortcut next to name (avoids duplicating status badge in table) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenQuickStatus(s);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center"
                                title="تعديل سريع للحالة"
                              >
                                <SlidersHorizontal size={13} />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-lg font-mono font-bold text-xs">
                            ص {s.pageNumber}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded-lg font-mono font-bold text-xs`}>
                            قيد {s.regNumber}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenQuickStatus(s);
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer hover:opacity-85 ${
                              s.status === 'graduated' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                              s.status === 'left' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                              s.status === 'transferred' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                              'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                            title="انقر لتعديل الحالة سريعاً"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              s.status === 'graduated' ? 'bg-blue-600' :
                              s.status === 'left' ? 'bg-rose-600' :
                              s.status === 'transferred' ? 'bg-amber-600' :
                              'bg-emerald-600'
                            }`}></span>
                            <span>
                              {s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}
                            </span>
                          </button>
                        </td>
                        <td className="p-2.5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => { setSelectedId(s.id); setView('detail'); }} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="عرض التفاصيل"
                            >
                              <Eye size={15} />
                            </button>
                            <button 
                              onClick={() => { setSelectedId(s.id); setView('edit'); setSimilarStudents([]); }} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="تعديل الطالب"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button 
                              onClick={() => { setSelectedId(s.id); setPrintMode('single'); setTimeout(() => window.print(), 500); }} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="طباعة بطاقة الطالب"
                            >
                              <Printer size={15} />
                            </button>
                            <button 
                              onClick={() => handleDelete(s.id)} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Modern Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayed.map((s, idx) => {
            const isSelected = selectedStudents.includes(s.id);
            const firstLetter = cleanName(s.firstName).charAt(0) || 'ط';
            const isFirstOfLetter = sortBy === 'alphabetical' && !debouncedQuery && (
              idx === 0 || cleanName(displayed[idx - 1].firstName).charAt(0) !== firstLetter
            );
            return (
              <React.Fragment key={s.id}>
                {isFirstOfLetter && (
                  <div 
                    id={`modern-grid-section-${firstLetter}`}
                    className="col-span-full bg-slate-100/90 dark:bg-slate-800/90 rounded-xl px-3 py-2 flex items-center justify-between text-xs font-black text-blue-600 dark:text-blue-400 border border-slate-200/80 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">
                        {firstLetter}
                      </span>
                      <span>حرف {firstLetter}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {studentsByLetter[firstLetter]?.length ? `${studentsByLetter[firstLetter].length} طالب` : ''}
                    </span>
                  </div>
                )}
                <div 
                  id={`modern-grid-student-${s.id}`}
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setView('detail'); }}
                  className={`glass-panel modern-card-hover rounded-2xl p-4 border transition-all cursor-pointer relative group ${
                    isSelected 
                      ? 'border-blue-400 ring-2 ring-blue-400/20 bg-blue-50/20' 
                      : 'border-slate-200/90 dark:border-slate-800'
                  }`}
                >
                  {/* Top Row: Avatar + Checkbox + Quick Status Shortcut */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedStudents([...selectedStudents, s.id]);
                          else setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                        }}
                        className="rounded border-slate-300 cursor-pointer w-4 h-4"
                      />
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {firstLetter}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenQuickStatus(s);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer hover:opacity-90 active:scale-95 shrink-0 ${
                        s.status === 'graduated' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' :
                        s.status === 'left' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                        s.status === 'transferred' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                      title="تعديل سريع للحالة"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        s.status === 'graduated' ? 'bg-blue-600' :
                        s.status === 'left' ? 'bg-rose-600' :
                        s.status === 'transferred' ? 'bg-amber-600' :
                        'bg-emerald-600'
                      }`}></span>
                      <span>{s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}</span>
                      <SlidersHorizontal size={9} className="opacity-70" />
                    </button>
                  </div>

                  {/* Full-Width Single-Line Student Name + Inline Blue Surname */}
                  <div className="mb-2.5 w-full min-w-0">
                    <h3
                      className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 leading-relaxed py-0.5 transition-colors whitespace-nowrap overflow-hidden"
                      style={{ fontSize: `${getSingleLineFontSize(`${cleanName(s.firstName)}${s.lastName ? ` (${restoreYehDots(s.lastName)})` : ''}`, 280, 14, 8, 700)}px` }}
                      title={`${cleanName(s.firstName)}${s.lastName ? ` (${restoreYehDots(s.lastName)})` : ''}`}
                    >
                      <span>{cleanName(s.firstName)}</span>
                      {s.lastName && (
                        <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">
                          ({restoreYehDots(s.lastName)})
                        </span>
                      )}
                    </h3>
                  </div>

                  {/* Chips: Reg first, then Page + Copy & Expand Arrow on the second row */}
                  <div className="flex items-center justify-between gap-1.5 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`${currentTheme.primary} text-white px-2.5 py-1 rounded-xl text-xs font-bold font-mono tabular-nums`}>
                        قيد {s.regNumber}
                      </span>
                      <span className="bg-amber-50 text-amber-900 border border-amber-200/80 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 rounded-xl text-xs font-bold font-mono tabular-nums">
                        ص {s.pageNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleCopyStudentName(e, s)}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center"
                        title={copiedStudentId === s.id ? "تم النسخ!" : "نسخ اسم الطالب"}
                      >
                        {copiedStudentId === s.id ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Copy size={14} className="text-slate-400 hover:text-blue-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => toggleExpandStudent(e, s.id)}
                        className={`p-1 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center ${
                          expandedStudentIds.includes(s.id)
                            ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        title={expandedStudentIds.includes(s.id) ? "إخفاء التفاصيل" : "عرض الصف والتفاصيل"}
                      >
                        {expandedStudentIds.includes(s.id) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Hidden Grade & Extra Details - revealed when pressing the expand arrow */}
                  {expandedStudentIds.includes(s.id) && (
                    <div className="space-y-2 mb-3 animate-fade-in" onClick={e => e.stopPropagation()}>
                      <div className="bg-slate-50/90 dark:bg-slate-800/60 p-2.5 rounded-xl text-[11px] space-y-1 border border-slate-100 dark:border-slate-700">
                        {s.transferGrade && (
                          <div className="text-amber-800 dark:text-amber-300 font-bold">الصف: {s.transferGrade}</div>
                        )}
                        {s.status === 'graduated' && s.graduationGrade && (
                          <div className="text-blue-800 dark:text-blue-300 font-bold">🎓 الصف / الفرع: {s.graduationGrade}</div>
                        )}
                        {s.docDestination && (
                          <div className="text-slate-700 dark:text-slate-200 font-semibold">الجهة: {s.docDestination}</div>
                        )}
                        {s.docDate && (
                          <div className="text-slate-600 dark:text-slate-300 font-semibold">تاريخ الوثيقة: {s.docDate}</div>
                        )}
                        {s.graduationYear && (
                          <div className="text-slate-600 dark:text-slate-300 font-semibold">العام الدراسي: {s.graduationYear}</div>
                        )}
                        {s.graduationRound && (
                          <div className="text-slate-600 dark:text-slate-300 font-semibold">الدور: {s.graduationRound}</div>
                        )}
                        <div className="text-slate-500 dark:text-slate-400 font-semibold">
                          تاريخ التسجيل: {new Date(s.createdAt).toLocaleDateString('ar-EG')}
                        </div>
                        {s.notes && (
                          <div className="text-slate-600 dark:text-slate-300 font-semibold">ملاحظات: {s.notes}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bottom Card Actions */}
                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => { setSelectedId(s.id); setView('detail'); }} 
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={13} /> عرض
                    </button>
                    <button 
                      onClick={() => { setSelectedId(s.id); setView('edit'); setSimilarStudents([]); }} 
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 hover:text-amber-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={13} /> تعديل
                    </button>
                    <button 
                      onClick={() => { setSelectedId(s.id); setPrintMode('single'); setTimeout(() => window.print(), 500); }} 
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="طباعة بطاقة الطالب"
                    >
                      <Printer size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(s.id)} 
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="glass-panel text-center py-12 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs animate-fade-in">
          <div className="w-14 h-14 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Search size={26} />
          </div>
          <div className="font-black text-slate-800 dark:text-slate-100 text-base">لا توجد نتائج مطابقة للبحث أو الفلاتر</div>
          <div className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            تأكد من كتابة الاسم بشكل صحيح أو أعد ضبط الفلاتر الحالية لعرض جميع الطلاب.
          </div>
          <button 
            onClick={() => {
              setSearch('');
              setSelectedRegFilter('');
              setStatusFilter('ALL');
              setYearFilter('ALL');
              setIsSearchActive(false);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
          >
            عرض جميع الطلاب
          </button>
        </div>
      )}

      {/* Floating Selection Dock */}
      {selectedStudents.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel shadow-2xl rounded-2xl px-4 py-2.5 border border-blue-300 dark:border-blue-700 flex items-center gap-2.5 animate-slide-up bg-white/95 dark:bg-slate-900/95">
          <span className="text-xs font-black text-blue-800 dark:text-blue-300 px-2">
            {selectedStudents.length} محدد
          </span>
          <button 
            onClick={() => setShowPrintSelectedModal(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 shadow-xs cursor-pointer"
          >
            <Printer size={14} /> طباعة
          </button>
          <button 
            onClick={() => shareViaWhatsApp(students.filter(s => selectedStudents.includes(s.id)))}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs cursor-pointer"
          >
            <Share2 size={14} /> مشاركة
          </button>
          <button 
            onClick={handleBulkDelete}
            className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-red-700 shadow-xs cursor-pointer"
          >
            <Trash2 size={14} /> حذف
          </button>
          <button 
            onClick={() => setSelectedStudents([])}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            title="إلغاء التحديد"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'detail' | 'trash' | 'settings' | 'stats'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedQuery = search;
  const [selectedRegFilter, setSelectedRegFilter] = useState(''); 
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printRegInput, setPrintRegInput] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [printMode, setPrintMode] = useState<'none' | 'list' | 'single' | 'selected' | 'docsExport'>('none');
  const [listOrientation, setListOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [docsExportYear, setDocsExportYear] = useState<string>('ALL');
  const [docsExportSort, setDocsExportSort] = useState<'byDate' | 'alphabetical' | 'byGradeAlpha'>('byDate');
  const [docsOrientation, setDocsOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [alertConfig, setAlertConfig] = useState<{ message: string; type: 'error' | 'success' | 'warning' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void; isDestructive?: boolean } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [similarStudents, setSimilarStudents] = useState<Student[]>([]);
  const [colorTheme, setColorTheme] = useState(localStorage.getItem('appTheme') || 'slate');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [appFont, setAppFont] = useState<string>(() => localStorage.getItem('appFont') || 'Cairo');
  const [fontScale, setFontScale] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem('appFontScale') || '1');
    return Number.isFinite(saved) && saved >= 0.85 && saved <= 1.25 ? saved : 1;
  });
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [uiDesignMode, setUiDesignMode] = useState<'modern' | 'classic'>(() => {
    return (localStorage.getItem('uiDesignMode') as 'modern' | 'classic') || 'modern';
  });
  const [modernViewType, setModernViewType] = useState<'table' | 'grid'>('table');
  const [trashSearch, setTrashSearch] = useState('');
  const [appViewportWidth, setAppViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 390
  );
  useEffect(() => {
    const onResize = () => setAppViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  
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
  const [formGraduationYear, setFormGraduationYear] = useState<string>('2024-2025');
  const [formGraduationRound, setFormGraduationRound] = useState<string>('الدور الأول');
  const [formGraduationGrade, setFormGraduationGrade] = useState<string>('السادس العلمي');
  const [customGraduationYears, setCustomGraduationYears] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('graduationYears');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ['2024-2025', '2023-2024', '2022-2023', '2021-2022', '2020-2021'];
  });
  const [showAddGradYearInput, setShowAddGradYearInput] = useState(false);
  const [newGradYearInput, setNewGradYearInput] = useState('');
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
  const activeFontObj = arabicFonts.find(f => f.id === appFont) || arabicFonts[0];
  activeFontFamily = activeFontObj.family;
  activeFontScale = Math.min(1.25, Math.max(0.85, Number(fontScale.toFixed(2))));

  // Pre-compute normalized Arabic names once whenever students change for instant 0ms search
  const studentSearchIndex = useMemo(() => {
    const map = new Map<string, { normFull: string; normFullNoSpace: string }>();
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const normFull = normalizeArabicSearch(`${cleanName(s.firstName)} ${s.lastName || ''}`);
      map.set(s.id, {
        normFull,
        normFullNoSpace: normFull.replace(/\s+/g, '')
      });
    }
    return map;
  }, [students]);

  // Group students by first letter for display only when alphabetical rail is visible
  const filteredForGroups = useMemo(() => {
    if (sortBy !== 'alphabetical' || debouncedQuery.trim().length > 0) return [];
    let res = students.filter(s => view === 'trash' ? s.isDeleted : !s.isDeleted);
    if (selectedRegFilter) res = res.filter(s => s.regNumber === selectedRegFilter);
    if (yearFilter !== 'ALL') res = res.filter(s => new Date(s.createdAt).getFullYear().toString() === yearFilter);
    if (statusFilter !== 'ALL') res = res.filter(s => (s.status || 'active') === statusFilter);
    return res;
  }, [students, view, selectedRegFilter, yearFilter, statusFilter, sortBy, debouncedQuery]);
  
  const studentsByLetter = useMemo(() => {
    if (filteredForGroups.length === 0) return {};
    const groups: Record<string, Student[]> = {};
    const sorted = [...filteredForGroups].sort((a, b) => arCollator.compare(a.firstName, b.firstName));
    
    sorted.forEach(student => {
      const firstChar = cleanName(student.firstName).charAt(0) || student.firstName.charAt(0);
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(student);
    });
    
    return groups;
  }, [filteredForGroups]);

  const alphabetLetters = useMemo(() => {
    const keys = Object.keys(studentsByLetter);
    if (keys.length === 0) return [];
    return keys.sort((a, b) => arCollator.compare(a, b));
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

  const isTrashView = view === 'trash';
  useEffect(() => {
    setVisibleCount(40);
  }, [search, selectedRegFilter, statusFilter, yearFilter, sortBy, isTrashView]);

  useEffect(() => {
    setPrintMode(prev => (prev === 'none' ? prev : 'none'));
  }, [search]);

  useEffect(() => {
    const handleBeforePrint = () => {
      setPrintMode(prev => (prev === 'none' ? 'list' : prev));
    };
    const handleAfterPrint = () => {
      setTimeout(() => setPrintMode('none'), 1000);
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

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
    const fontObj = arabicFonts.find(f => f.id === appFont) || arabicFonts[0];
    localStorage.setItem('appFont', fontObj.id);
    document.documentElement.style.setProperty('--app-font-family', fontObj.family);
  }, [appFont]);

  useEffect(() => {
    const clamped = Math.min(1.25, Math.max(0.85, Number(fontScale.toFixed(2))));
    localStorage.setItem('appFontScale', String(clamped));
    document.documentElement.style.fontSize = `${(16 * clamped).toFixed(2)}px`;
  }, [fontScale]);

  useEffect(() => {
    localStorage.setItem('customRegs', JSON.stringify(customRegs));
  }, [customRegs]);

  useEffect(() => {
    try {
      localStorage.setItem('graduationYears', JSON.stringify(customGraduationYears));
    } catch {
      // ignore
    }
  }, [customGraduationYears]);

  const allGraduationYears = useMemo(() => {
    const set = new Set<string>(customGraduationYears);
    students.forEach(s => {
      if (s.graduationYear && s.graduationYear.trim()) {
        set.add(s.graduationYear.trim());
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [customGraduationYears, students]);

  const handleAddGraduationYear = (yearStr: string) => {
    const trimmed = yearStr.trim();
    if (!trimmed) return;
    if (!customGraduationYears.includes(trimmed)) {
      setCustomGraduationYears(prev => [trimmed, ...prev]);
    }
    setFormGraduationYear(trimmed);
    setNewGradYearInput('');
    setShowAddGradYearInput(false);
    setAlertConfig({ message: `تمت إضافة وحفظ العام الدراسي ${trimmed} بنجاح`, type: 'success' });
  };

  // Quick Status Editing Shortcut State & Handlers
  const [quickStatusStudent, setQuickStatusStudent] = useState<Student | null>(null);
  const [quickStatusValue, setQuickStatusValue] = useState<'active' | 'transferred' | 'left' | 'graduated'>('active');
  const [quickDocDestination, setQuickDocDestination] = useState('');
  const [quickTransferGrade, setQuickTransferGrade] = useState('');
  const [quickDocDate, setQuickDocDate] = useState('');
  const [quickDocPurpose, setQuickDocPurpose] = useState('إكمال الدراسة');
  const [quickGradYear, setQuickGradYear] = useState('2024-2025');
  const [quickGradRound, setQuickGradRound] = useState('الدور الأول');
  const [quickGradGrade, setQuickGradGrade] = useState('السادس العلمي');

  const openQuickStatus = (student: Student) => {
    setQuickStatusStudent(student);
    setQuickStatusValue(student.status || 'active');
    setQuickDocDestination(student.docDestination || '');
    setQuickTransferGrade(student.transferGrade || (student as any).grade || '');
    setQuickDocDate(student.docDate || new Date().toISOString().split('T')[0]);
    setQuickDocPurpose(student.docPurpose || 'إكمال الدراسة');
    setQuickGradYear(student.graduationYear || (allGraduationYears[0] || '2024-2025'));
    setQuickGradRound(student.graduationRound || 'الدور الأول');
    setQuickGradGrade(student.graduationGrade || 'السادس العلمي');
  };

  const handleSaveQuickStatus = async () => {
    if (!quickStatusStudent) return;
    try {
      const updates: Partial<Student> = {
        status: quickStatusValue
      };
      if (quickStatusValue === 'transferred') {
        updates.docDestination = quickDocDestination.trim();
        updates.transferGrade = quickTransferGrade.trim();
        updates.docDate = quickDocDate;
        updates.docPurpose = quickDocPurpose;
      } else if (quickStatusValue === 'graduated') {
        updates.graduationYear = quickGradYear.trim();
        updates.graduationRound = quickGradRound.trim();
        updates.graduationGrade = quickGradGrade.trim();
      }
      await updateDoc(doc(db, "students", quickStatusStudent.id), updates as any);
      await refreshStats();
      const studentName = cleanName(quickStatusStudent.firstName);
      setQuickStatusStudent(null);
      const statusAr = quickStatusValue === 'active' ? 'مستمر' : quickStatusValue === 'transferred' ? 'منقول' : quickStatusValue === 'left' ? 'تارك' : 'متخرج';
      setAlertConfig({ message: `تم تحديث حالة الطالب (${studentName}) إلى [${statusAr}] بنجاح`, type: 'success' });
    } catch (err) {
      console.error(err);
      setAlertConfig({ message: 'فشل حفظ الحالة', type: 'error' });
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) setVisibleCount((prev) => prev + 40);
    }, { threshold: 0.1 });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [students.length, loading]);

  // Set edit form data when editing
  useEffect(() => {
    if (view === 'edit' && selectedId) {
      const student = students.find(s => s.id === selectedId);
      if (student) {
        const initialGrade = (student.transferGrade || (student as any).grade || '').trim();
        setFormTransferGrade(initialGrade);
        setFormGraduationYear(student.graduationYear || (allGraduationYears[0] || '2024-2025'));
        setFormGraduationRound(student.graduationRound || 'الدور الأول');
        setFormGraduationGrade(student.graduationGrade || 'السادس العلمي');
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
          graduationYear: student.graduationYear || '',
          graduationRound: student.graduationRound || 'الدور الأول',
          graduationGrade: student.graduationGrade || 'السادس العلمي',
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
      setFormGraduationYear(allGraduationYears[0] || '2024-2025');
      setFormGraduationRound('الدور الأول');
      setFormGraduationGrade('السادس العلمي');
      setDocPurposeType('إكمال الدراسة');
      setCustomDocPurpose('');
    }
  }, [view, selectedId, students, allGraduationYears]);

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

  const handleDelete = (id: string) => {
    setConfirmConfig({
      title: "حذف طالب",
      message: "هل تريد نقل هذا الطالب إلى سلة المحذوفات؟",
      isDestructive: true,
      onConfirm: async () => {
        await updateDoc(doc(db, "students", id), { isDeleted: true });
        await refreshStats();
        setConfirmConfig(null);
        setAlertConfig({ message: 'تم نقل الطالب إلى سلة المحذوفات', type: 'success' });
      }
    });
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
        getStudentSearchRank(s, name) !== -1
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

      if (s.status === 'graduated' && (s.graduationYear || s.graduationGrade || s.graduationRound)) {
        text += `└ 🎓 بيانات التخرج: ${s.graduationGrade || ''} - ${s.graduationRound || ''} - العام الدراسي: ${s.graduationYear || ''}\n`;
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
    const preparedQuery = prepareArabicQuery(debouncedQuery);
    if (preparedQuery.normQueryNoSpace) {
       const ranked: { student: Student; rank: number }[] = [];
       for (let i = 0; i < res.length; i++) {
           const s = res[i];
           const entry = studentSearchIndex.get(s.id);
           const rank = entry
             ? getStudentSearchRankFast(entry, preparedQuery)
             : getStudentSearchRank(s, debouncedQuery);
           if (rank !== -1) ranked.push({ student: s, rank });
       }
       ranked.sort((a, b) => {
           if (a.rank !== b.rank) return a.rank - b.rank;
           if (sortBy === 'alphabetical') return arCollator.compare(a.student.firstName, b.student.firstName);
           if (sortBy === 'byPage') return Number(a.student.pageNumber) - Number(b.student.pageNumber);
           return b.student.createdAt - a.student.createdAt;
       });
       res = ranked.map(item => item.student);
    } else {
       if (sortBy === 'alphabetical') res.sort((a,b) => arCollator.compare(a.firstName, b.firstName));
       else if (sortBy === 'byPage') res.sort((a,b) => Number(a.pageNumber) - Number(b.pageNumber));
       else res.sort((a,b) => b.createdAt - a.createdAt);
    }
    return res;
  }, [students, studentSearchIndex, debouncedQuery, selectedRegFilter, statusFilter, sortBy, yearFilter, view]);

  const displayed = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const trashTotalCount = useMemo(() => students.filter(s => s.isDeleted).length, [students]);
  const trashItems = useMemo(() => {
    if (view !== 'trash') return [];
    const deleted = students.filter(s => s.isDeleted);
    const prepared = prepareArabicQuery(trashSearch);
    if (prepared.normQueryNoSpace) {
      const ranked: { student: Student; rank: number }[] = [];
      for (let i = 0; i < deleted.length; i++) {
        const s = deleted[i];
        const entry = studentSearchIndex.get(s.id);
        const rank = entry
          ? getStudentSearchRankFast(entry, prepared)
          : getStudentSearchRank(s, trashSearch);
        if (rank !== -1) ranked.push({ student: s, rank });
      }
      ranked.sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : b.student.createdAt - a.student.createdAt);
      return ranked.map(item => item.student);
    }
    return deleted.sort((a, b) => b.createdAt - a.createdAt);
  }, [students, studentSearchIndex, trashSearch, view]);
  
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

        {!(inSearchMode && view === 'list') && (
        <header className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-2.5 sm:px-4 min-h-14 sm:min-h-16 py-1.5 sm:py-0 flex items-center justify-between gap-1.5 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none min-w-0 flex-1" onClick={() => setView('list')}>
              <div className={`${currentTheme.primary} text-white p-1.5 sm:p-2 rounded-xl shadow-md transition-all flex items-center justify-center shrink-0`}>
                <School size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="font-black text-xs sm:text-base md:text-lg text-slate-800 dark:text-slate-100 font-cairo leading-tight truncate">
                    سجل القيد العام
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 hidden md:inline-block shrink-0">
                    {students.filter(s => !s.isDeleted).length} طالب
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
                  ثانوية الشهيد محمد عبدالعزيز الكنعان للبنين
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* زر التبديل بين التصميم الحديث والتصميم الكلاسيكي */}
              <button 
                onClick={() => {
                  const nextMode = uiDesignMode === 'modern' ? 'classic' : 'modern';
                  setUiDesignMode(nextMode);
                  localStorage.setItem('uiDesignMode', nextMode);
                }} 
                title={uiDesignMode === 'modern' ? 'التبديل إلى التصميم الكلاسيكي' : 'التبديل إلى التصميم الحديث ✨'}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 ${
                  uiDesignMode === 'modern' 
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-blue-500/25 ring-1 sm:ring-2 ring-blue-400/30 hover:brightness-110' 
                    : 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200'
                }`}
                type="button"
              >
                {uiDesignMode === 'modern' ? (
                  <>
                    <Sparkles size={13} className="text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
                    <span className="hidden sm:inline text-xs">التصميم الحديث</span>
                    <span className="sm:hidden text-[10px]">الحديث</span>
                    <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono hidden xs:inline">✨</span>
                  </>
                ) : (
                  <>
                    <LayoutTemplate size={13} className="text-amber-800" />
                    <span className="hidden sm:inline text-xs">التصميم الكلاسيكي</span>
                    <span className="sm:hidden text-[10px]">كلاسيكي</span>
                    <span className="text-[9px] bg-amber-200/80 px-1 py-0.2 rounded text-amber-900 font-bold hidden xs:inline">🏛️</span>
                  </>
                )}
              </button>

              <button 
                onClick={toggleFullscreen} 
                title={isFullscreen ? 'خروج من ملء الشاشة' : 'وضع ملء الشاشة'}
                className="hidden sm:inline-flex p-1.5 sm:p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                type="button"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button 
                onClick={() => setShowThemeModal(true)} 
                title="تغيير ألوان التطبيق"
                className="p-1.5 sm:p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                type="button"
              >
                <Palette size={16} />
              </button>
              <button 
                onClick={() => setView('settings')} 
                title="الإعدادات"
                className="p-1.5 sm:p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                type="button"
              >
                <Settings size={16} />
              </button>
              <button 
                onClick={() => setConfirmConfig({ title: "تسجيل خروج", message: "هل أنت متأكد من تسجيل الخروج؟", onConfirm: () => signOut(auth) })} 
                title="تسجيل الخروج"
                className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors shrink-0"
                type="button"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        )}

        <main className="max-w-7xl mx-auto px-4 py-4">
            {loading && students.length === 0 ? <SkeletonLoader /> : (
                <div className="animate-fade-in space-y-4">
                  {view === 'trash' && (
                    <div className="space-y-3 animate-slide-up">
                      {/* Clean Trash Header Banner */}
                      <div className="flex items-center justify-between gap-2 bg-red-50/90 dark:bg-red-950/30 px-3.5 py-3 rounded-2xl border border-red-200/80 dark:border-red-900/50 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
                            <Trash2 size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-red-800 dark:text-red-200 font-black text-sm leading-tight truncate">سلة المحذوفات</div>
                            <div className="text-[11px] font-bold text-red-600/80 dark:text-red-400/90 mt-0.5">
                              {trashTotalCount === 0
                                ? 'لا توجد سجلات محذوفة'
                                : trashSearch.trim()
                                  ? `${trashItems.length} من ${trashTotalCount} سجل محذوف`
                                  : `${trashTotalCount} سجل محذوف`}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setTrashSearch(''); setView('list'); }}
                          className="flex items-center gap-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold shadow-xs border border-red-200/70 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0 whitespace-nowrap"
                        >
                          <ArrowLeft size={15} />
                          <span>العودة للرئيسية</span>
                        </button>
                      </div>

                      {/* Quick Search Inside Trash */}
                      {trashTotalCount > 0 && (
                        <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-red-200">
                          <Search className="text-slate-400 ml-2 shrink-0" size={16} />
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            value={trashSearch}
                            onChange={(e) => setTrashSearch(e.target.value)}
                            placeholder="ابحث داخل سلة المحذوفات..."
                            className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm placeholder:text-slate-400 min-w-0 h-7"
                          />
                          {trashSearch.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setTrashSearch('')}
                              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                              title="مسح البحث"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {trashItems.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-xs">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Trash2 size={22} />
                          </div>
                          <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                            {trashTotalCount === 0 ? 'سلة المحذوفات فارغة' : 'لا توجد نتائج مطابقة'}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {trashTotalCount === 0 ? 'لا توجد سجلات محذوفة حالياً' : 'جرّب البحث باسم آخر أو امسح مربع البحث'}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Mobile Responsive Cards (< md): Full-width single-line name + blue surname + compact badges & actions */}
                          <div className="md:hidden space-y-2.5">
                            {trashItems.map((s, idx) => {
                              const surname = restoreYehDots(s.lastName);
                              const displayFull = `#${idx + 1} ${cleanName(s.firstName)}${surname ? ` (${surname})` : ''}`;
                              const availWidth = Math.max(210, appViewportWidth - 64);
                              const fittedFontSize = getSingleLineFontSize(displayFull, availWidth, 14, 7.5, 700);
                              return (
                                <div
                                  key={s.id}
                                  className="bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-3 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5"
                                >
                                  {/* Line 1: 100% Full-Width Single-Line Name + Inline Blue Surname */}
                                  <div
                                    className="w-full min-w-0 font-bold text-slate-900 dark:text-slate-100 leading-relaxed py-0.5 whitespace-nowrap overflow-hidden"
                                    style={{ fontSize: `${fittedFontSize}px` }}
                                    title={`${cleanName(s.firstName)}${surname ? ` (${surname})` : ''}`}
                                  >
                                    <span className="font-mono tabular-nums text-[0.82em] font-bold text-slate-400 ml-1">
                                      #{idx + 1}
                                    </span>
                                    <span>{cleanName(s.firstName)}</span>
                                    {surname && (
                                      <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">
                                        ({surname})
                                      </span>
                                    )}
                                  </div>

                                  {/* Line 2: Metadata Badges + Restore / Permanent Delete Buttons */}
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border shrink-0 ${
                                          s.status === 'graduated' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' :
                                          s.status === 'left' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                                          s.status === 'transferred' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                                          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                        }`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          s.status === 'graduated' ? 'bg-blue-600' :
                                          s.status === 'left' ? 'bg-rose-600' :
                                          s.status === 'transferred' ? 'bg-amber-600' :
                                          'bg-emerald-600'
                                        }`}></span>
                                        <span>{s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}</span>
                                      </span>

                                      <span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded-lg font-mono tabular-nums font-bold text-[11px] whitespace-nowrap`}>
                                        قيد {s.regNumber}
                                      </span>

                                      <span className="bg-amber-50 text-amber-900 border border-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-lg font-mono tabular-nums font-bold text-[11px] whitespace-nowrap">
                                        ص {s.pageNumber}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 mr-auto">
                                      <button
                                        type="button"
                                        onClick={() => handleRestore(s.id)}
                                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap active:scale-95"
                                        title="استعادة السجل"
                                      >
                                        <RotateCcw size={12} />
                                        <span>استعادة</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteForever(s.id)}
                                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap active:scale-95"
                                        title="حذف نهائي"
                                      >
                                        <Trash2 size={12} />
                                        <span>حذف</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table View (>= md) */}
                          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <table className="w-full text-right border-collapse">
                              <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 text-[11px] font-bold">
                                <tr>
                                  <th className="px-4 py-2.5 w-12 text-center">#</th>
                                  <th className="px-4 py-2.5">اسم الطالب</th>
                                  <th className="px-4 py-2.5 w-24 text-center">الحالة</th>
                                  <th className="px-4 py-2.5 w-24 text-center">الصفحة</th>
                                  <th className="px-4 py-2.5 w-24 text-center">رقم القيد</th>
                                  <th className="px-4 py-2.5 w-44 text-center">الإجراءات</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                {trashItems.map((s, idx) => (
                                  <tr key={s.id} className="hover:bg-red-50/30 dark:hover:bg-red-950/20 transition-all h-12">
                                    <td className="px-4 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="px-4 py-2 font-bold text-slate-800 dark:text-slate-100 text-sm whitespace-nowrap">
                                      <span>{cleanName(s.firstName)}</span>
                                      {s.lastName && (
                                        <span className="text-blue-600 dark:text-blue-400 font-bold mr-1.5">
                                          ({restoreYehDots(s.lastName)})
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        s.status === 'graduated' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                                        s.status === 'left' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                                        s.status === 'transferred' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                                        'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      }`}>
                                        {s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <span className="bg-amber-50 text-amber-900 border border-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded-md font-mono font-bold text-[11px] whitespace-nowrap">
                                        {s.pageNumber}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <span className={`${currentTheme.primary} text-white px-2.5 py-0.5 rounded-md font-mono font-bold text-[11px] whitespace-nowrap`}>
                                        {s.regNumber}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <div className="flex gap-1.5 justify-center">
                                        <button
                                          type="button"
                                          onClick={() => handleRestore(s.id)}
                                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap"
                                          title="استعادة"
                                        >
                                          <RotateCcw size={13} /> استعادة
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteForever(s.id)}
                                          className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/80 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap"
                                          title="حذف نهائي"
                                        >
                                          <Trash2 size={13} /> حذف نهائي
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {view !== 'trash' && (
                    uiDesignMode === 'modern' ? (
                      <ModernAppLayout
                        students={students}
                        filtered={filtered}
                        displayed={displayed}
                        selectedStudents={selectedStudents}
                        setSelectedStudents={setSelectedStudents}
                        search={search}
                        setSearch={setSearch}
                        searchInputRef={searchInputRef}
                        isListening={isListening}
                        startVoiceSearch={startVoiceSearch}
                        inSearchMode={inSearchMode}
                        setIsSearchActive={setIsSearchActive}
                        showSearchFilters={showSearchFilters}
                        setShowSearchFilters={setShowSearchFilters}
                        selectedRegFilter={selectedRegFilter}
                        setSelectedRegFilter={setSelectedRegFilter}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        yearFilter={yearFilter}
                        setYearFilter={setYearFilter}
                        years={years}
                        regsCount={regsCount}
                        alphabetLetters={alphabetLetters}
                        studentsByLetter={studentsByLetter}
                        currentTheme={currentTheme}
                        setSelectedId={setSelectedId}
                        setView={setView}
                        setSimilarStudents={setSimilarStudents}
                        setPrintMode={setPrintMode}
                        setShowPrintModal={setShowPrintModal}
                        setShowPrintTemplateModal={setShowPrintTemplateModal}
                        setShowPrintSelectedModal={setShowPrintSelectedModal}
                        handleDelete={handleDelete}
                        handleRestore={handleRestore}
                        handleDeleteForever={handleDeleteForever}
                        handleBulkDelete={handleBulkDelete}
                        shareViaWhatsApp={shareViaWhatsApp}
                        cleanName={cleanName}
                        modernViewType={modernViewType}
                        setModernViewType={setModernViewType}
                        view={view}
                        debouncedQuery={debouncedQuery}
                        setVisibleCount={setVisibleCount}
                        onOpenQuickStatus={openQuickStatus}
                      />
                    ) : (
                      <>
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

                    {/* Search Bar with Clear (X) Button, Voice, and Filters Toggle */}
                  <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 transition-all mb-3">
                     <div className={`relative flex items-center bg-white rounded-lg border border-slate-200 px-3 py-1 focus-within:ring-2 ${currentTheme.ring} transition-all`}>
                         <Search className="text-slate-400 ml-1 shrink-0" size={16} />
                         <input 
                           ref={searchInputRef}
                           id="searchInput" 
                           type="text"
                           autoComplete="off"
                           autoCorrect="off"
                           autoCapitalize="off"
                           spellCheck={false}
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
                          type="button"
                          onClick={() => {
                            const normLetter = letter.trim();
                            const alefs = ['أ', 'إ', 'آ', 'ا'];
                            const isAlef = alefs.includes(normLetter);
                            const targetIdx = filtered.findIndex(s => {
                              const firstChar = cleanName(s.firstName).trim().charAt(0);
                              if (!firstChar) return false;
                              if (firstChar === normLetter) return true;
                              if (isAlef && alefs.includes(firstChar)) return true;
                              return false;
                            });
                            if (targetIdx !== -1) {
                              if (targetIdx >= displayed.length) {
                                setVisibleCount(Math.max(displayed.length, targetIdx + 60));
                              }
                              const targetStudent = filtered[targetIdx];
                              const targetChar = cleanName(targetStudent.firstName).trim().charAt(0);
                              const doScrollClassic = () => {
                                const isMobile = window.innerWidth < 768;
                                const section = isMobile 
                                  ? (document.getElementById(`mobile-section-${targetChar}`) || document.getElementById(`mobile-section-${normLetter}`) || document.getElementById(`section-${targetChar}`))
                                  : (document.getElementById(`section-${targetChar}`) || document.getElementById(`section-${normLetter}`) || document.getElementById(`mobile-section-${targetChar}`));
                                if (section) {
                                  const top = section.getBoundingClientRect().top + window.pageYOffset - 130;
                                  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                                  return true;
                                }
                                return false;
                              };
                              setTimeout(() => {
                                if (!doScrollClassic()) {
                                  setTimeout(doScrollClassic, 120);
                                }
                              }, 50);
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
                                 </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {studentsByLetter[letter].map((s, idx) => (
                                <tr key={s.id} className="hover:bg-blue-50/40 transition-all border-b border-slate-50 group h-10">
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
                                        onClick={() => { setSelectedId(s.id); setView('detail'); }}
                                      >
                                          <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'graduated' ? 'bg-blue-500' : s.status === 'left' ? 'bg-rose-500' : s.status === 'transferred' ? 'bg-amber-500' : 'bg-emerald-500'}`} title={s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}></div>
                                          <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                                              <span>{cleanName(s.firstName)}</span>
                                              {s.lastName && (
                                                <span className="inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap align-middle">
                                                  <span>/</span>
                                                  <span>{s.lastName}</span>
                                                </span>
                                              )}
                                          </span>
                                      </div>
                                  </td>
                                  {/* SWAPPED: الصفحة cell before رقم القيد cell */}
                                  <td className="px-4 py-2 text-center"><span className="bg-[#FFA500] text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm text-[10px]">{s.pageNumber}</span></td>
                                  <td className="px-4 py-2 text-center"><span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm transition-colors text-[10px]`}>{s.regNumber}</span></td>
                                  <td className="px-4 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openQuickStatus(s); }}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-all ${
                                        s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 
                                        s.status === 'left' ? 'bg-rose-100 text-rose-700' : 
                                        s.status === 'transferred' ? 'bg-amber-100 text-amber-700' : 
                                        'bg-emerald-100 text-emerald-700'
                                      }`}
                                      title="انقر لتعديل الحالة سريعاً"
                                    >
                                      {s.status === 'graduated' ? 'خ' : s.status === 'left' ? 'ت' : s.status === 'transferred' ? 'ن' : 'م'}
                                    </button>
                                  </td>
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
                             </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {displayed.map((s, idx) => (
                            <tr key={s.id} className="hover:bg-blue-50/40 transition-all border-b border-slate-50 group h-10">
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
                                    onClick={() => { setSelectedId(s.id); setView('detail'); }}
                                  >
                                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'graduated' ? 'bg-blue-500' : s.status === 'left' ? 'bg-rose-500' : s.status === 'transferred' ? 'bg-amber-500' : 'bg-emerald-500'}`} title={s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}></div>
                                      <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                                          <span>{cleanName(s.firstName)}</span>
                                          {s.lastName && (
                                            <span className="inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap align-middle">
                                              <span>/</span>
                                              <span>{s.lastName}</span>
                                            </span>
                                          )}
                                      </span>
                                  </div>
                              </td>
                              {/* SWAPPED: الصفحة cell before رقم القيد cell */}
                              <td className="px-4 py-2 text-center"><span className="bg-[#FFA500] text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm text-[10px]">{s.pageNumber}</span></td>
                              <td className="px-4 py-2 text-center"><span className={`${currentTheme.primary} text-white px-2 py-0.5 rounded-md font-mono inline-block min-w-[40px] shadow-sm transition-colors text-[10px]`}>{s.regNumber}</span></td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openQuickStatus(s); }}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-all ${
                                    s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 
                                    s.status === 'left' ? 'bg-rose-100 text-rose-700' : 
                                    s.status === 'transferred' ? 'bg-amber-100 text-amber-700' : 
                                    'bg-emerald-100 text-emerald-700'
                                  }`}
                                  title="انقر لتعديل الحالة سريعاً"
                                >
                                  {s.status === 'graduated' ? 'خ' : s.status === 'left' ? 'ت' : s.status === 'transferred' ? 'ن' : 'م'}
                                </button>
                              </td>
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
                                className="cursor-pointer"
                                onClick={() => { setSelectedId(s.id); setView('detail'); }}
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
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openQuickStatus(s); }}
                                      className={`text-xs font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-all ${
                                        s.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 
                                        s.status === 'left' ? 'bg-rose-100 text-rose-700' : 
                                        s.status === 'transferred' ? 'bg-amber-100 text-amber-700' : 
                                        'bg-emerald-100 text-emerald-700'
                                      }`}
                                      title="انقر لتعديل الحالة سريعاً"
                                    >
                                      {s.status === 'graduated' ? 'متخرج' : s.status === 'left' ? 'تارك' : s.status === 'transferred' ? 'منقول' : 'مستمر'}
                                    </button>
                                </div>
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
                            className="cursor-pointer"
                            onClick={() => { setSelectedId(s.id); setView('detail'); }}
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
                      </>
                    )
                  )}
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
                        graduationYear: st === 'graduated' ? (formGraduationYear || String(form.get('graduationYear') || '')).trim() : '',
                        graduationRound: st === 'graduated' ? (formGraduationRound || String(form.get('graduationRound') || '')).trim() : '',
                        graduationGrade: st === 'graduated' ? (formGraduationGrade || String(form.get('graduationGrade') || '')).trim() : '',
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
                            setFormGraduationYear(allGraduationYears[0] || '2024-2025');
                            setFormGraduationRound('الدور الأول');
                            setFormGraduationGrade('السادس العلمي');
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

                   {/* الحقول الخاصة بالطالب المتخرج */}
                   {formStatus === 'graduated' && (
                     <div className="bg-blue-50/80 border-2 border-blue-300/80 rounded-2xl p-3.5 space-y-3 animate-slide-up shadow-xs">
                       <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                         <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                           <GraduationCap size={16} className="text-blue-600" />
                           <span>بيانات التخرج الرسمية</span>
                         </div>
                         <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                           خريج
                         </span>
                       </div>

                       {/* 1. العام الدراسي مع إمكانية إضافة الأعوام الدراسية لأول مرة وحفظها */}
                       <div>
                         <div className="flex items-center justify-between mb-1">
                           <label className="block text-[11px] font-bold text-blue-950">
                             العام الدراسي:
                           </label>
                           {!showAddGradYearInput && (
                             <button
                               type="button"
                               onClick={() => setShowAddGradYearInput(true)}
                               className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer hover:underline"
                             >
                               <Plus size={12} />
                               <span>إضافة عام دراسي جديد</span>
                             </button>
                           )}
                         </div>

                         {!showAddGradYearInput ? (
                           <div className="flex items-center gap-2">
                             <select 
                               name="graduationYear" 
                               value={formGraduationYear} 
                               onChange={(e) => {
                                 if (e.target.value === '__add_new__') {
                                   setShowAddGradYearInput(true);
                                 } else {
                                   setFormGraduationYear(e.target.value);
                                 }
                               }} 
                               className="flex-1 p-2.5 rounded-xl bg-white border border-blue-200 outline-none font-bold text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                             >
                               <option value="">اختر العام الدراسي...</option>
                               {allGraduationYears.map(year => (
                                 <option key={year} value={year}>{year}</option>
                               ))}
                               <option value="__add_new__">+ إضافة عام دراسي جديد...</option>
                             </select>
                             <button
                               type="button"
                               onClick={() => setShowAddGradYearInput(true)}
                               className="p-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl transition-colors cursor-pointer shrink-0"
                               title="إضافة عام دراسي جديد للقائمة"
                             >
                               <Plus size={15} />
                             </button>
                           </div>
                         ) : (
                           <div className="flex items-center gap-1.5 animate-fade-in bg-white p-1 rounded-xl border border-blue-300 shadow-xs">
                             <input 
                               type="text"
                               value={newGradYearInput}
                               onChange={(e) => setNewGradYearInput(e.target.value)}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') {
                                   e.preventDefault();
                                   if (newGradYearInput.trim()) {
                                     handleAddGraduationYear(newGradYearInput.trim());
                                   }
                                 }
                               }}
                               placeholder="اكتب العام الدراسي (مثال: 2024-2025)"
                               className="flex-1 px-2.5 py-1.5 text-xs font-bold outline-none text-slate-800"
                               autoFocus
                             />
                             <button
                               type="button"
                               onClick={() => {
                                 if (newGradYearInput.trim()) {
                                   handleAddGraduationYear(newGradYearInput.trim());
                                 }
                               }}
                               className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                             >
                               حفظ العام
                             </button>
                             <button
                               type="button"
                               onClick={() => {
                                 setShowAddGradYearInput(false);
                                 setNewGradYearInput('');
                               }}
                               className="px-2 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                             >
                               إلغاء
                             </button>
                           </div>
                         )}
                       </div>

                       {/* 2. حقل الدور: الدور الأول، الثاني، الثالث، الخاص */}
                       <div>
                         <label className="block text-[11px] font-bold text-blue-950 mb-1.5">
                           الدور الامتحاني:
                         </label>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                           {[
                             'الدور الأول',
                             'الدور الثاني',
                             'الدور الثالث',
                             'الدور الخاص'
                           ].map((round) => (
                             <label key={round} className="cursor-pointer">
                               <input 
                                 type="radio" 
                                 name="graduationRound" 
                                 value={round} 
                                 className="peer hidden" 
                                 checked={formGraduationRound === round} 
                                 onChange={() => setFormGraduationRound(round)} 
                               />
                               <div className="py-2 px-1 text-center rounded-xl border-2 border-blue-200 bg-white text-slate-700 font-bold text-xs peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all shadow-xs">
                                 {round}
                               </div>
                             </label>
                           ))}
                         </div>
                       </div>

                       {/* 3. حقل الصف: السادس العلمي، السادس الأدبي */}
                       <div>
                         <label className="block text-[11px] font-bold text-blue-950 mb-1.5">
                           الصف / الفرع:
                         </label>
                         <div className="grid grid-cols-2 gap-2">
                           {[
                             'السادس العلمي',
                             'السادس الأدبي'
                           ].map((grade) => (
                             <label key={grade} className="cursor-pointer">
                               <input 
                                 type="radio" 
                                 name="graduationGrade" 
                                 value={grade} 
                                 className="peer hidden" 
                                 checked={formGraduationGrade === grade} 
                                 onChange={() => setFormGraduationGrade(grade)} 
                               />
                               <div className="py-2 px-2 text-center rounded-xl border-2 border-blue-200 bg-white text-slate-700 font-bold text-xs peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all shadow-xs">
                                 {grade}
                               </div>
                             </label>
                           ))}
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

        {/* Theme, Colors, Arabic Fonts & Font Size Modal */}
        {showThemeModal && (
          <Modal onClose={() => setShowThemeModal(false)} maxWidth="max-w-lg">
            <div className="bg-white dark:bg-slate-900 rounded-3xl pt-7 px-4 pb-4 sm:p-6 shadow-2xl max-h-[88vh] flex flex-col w-full text-right border border-slate-100 dark:border-slate-800 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 pl-9">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                    <Palette size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">الثيمات والألوان والخطوط</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">تخصيص لون التطبيق ونوع الخط العربي وحجمه</p>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar space-y-5 px-0.5">
                {/* 1. Theme Colors & Dark Mode */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Palette size={14} className="text-violet-500" /> ألوان التطبيق
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isDarkMode ? <Sun size={13} className="text-amber-500" /> : <Moon size={13} className="text-slate-600" />}
                      <span>{isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(themeColors).map(([key, value]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setColorTheme(key)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                          colorTheme === key
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs'
                            : 'border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full ${value.primary} shrink-0 shadow-xs`}></div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">{value.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Font Size Control (Zoom In / Zoom Out) */}
                <div className="space-y-2.5 bg-slate-50/90 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Type size={14} className="text-blue-600" /> حجم الخط
                    </span>
                    <span dir="ltr" className="text-xs font-black font-mono px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {Math.round(fontScale * 100)}%
                    </span>
                  </div>

                  {/* Live Sample Preview */}
                  <div
                    className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700 text-center"
                    style={{ fontFamily: activeFontObj.family }}
                  >
                    <div
                      className="font-bold text-slate-900 dark:text-slate-100 leading-relaxed"
                      style={{ fontSize: `${(14 * fontScale).toFixed(1)}px` }}
                    >
                      علي حمدي محمد مهدي <span className="text-blue-600 dark:text-blue-400">(الموسوي)</span>
                    </div>
                  </div>

                  {/* Minus / Slider / Plus Controls */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFontScale(prev => Math.max(0.85, Number((prev - 0.05).toFixed(2))))}
                      disabled={fontScale <= 0.85}
                      className="h-9 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                      title="تصغير الخط"
                    >
                      <Minus size={14} />
                      <span>تصغير</span>
                    </button>

                    <input
                      type="range"
                      min={0.85}
                      max={1.25}
                      step={0.05}
                      value={fontScale}
                      onChange={(e) => setFontScale(parseFloat(e.target.value))}
                      className="flex-1 accent-blue-600 cursor-pointer h-2"
                      aria-label="حجم الخط"
                    />

                    <button
                      type="button"
                      onClick={() => setFontScale(prev => Math.min(1.25, Number((prev + 0.05).toFixed(2))))}
                      disabled={fontScale >= 1.25}
                      className="h-9 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                      title="تكبير الخط"
                    >
                      <Plus size={14} />
                      <span>تكبير</span>
                    </button>
                  </div>

                  {/* Quick Size Presets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'صغير', value: 0.9 },
                      { label: 'افتراضي', value: 1 },
                      { label: 'كبير', value: 1.1 },
                      { label: 'كبير جداً', value: 1.2 },
                    ].map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setFontScale(preset.value)}
                        className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                          Math.abs(fontScale - preset.value) < 0.01
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Arabic Fonts Picker */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Type size={14} className="text-emerald-600" /> الخطوط العربية ({arabicFonts.length})
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">معاينة فورية للخط</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {arabicFonts.map((font) => {
                      const isSelected = appFont === font.id;
                      return (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => setAppFont(font.id)}
                          style={{ fontFamily: font.family }}
                          className={`p-2.5 rounded-xl border-2 text-right transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 shadow-xs'
                              : 'border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">{font.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">علي حمدي محمد • {font.desc}</div>
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                              <Check size={12} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-2 pt-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setColorTheme('slate');
                    setAppFont('Cairo');
                    setFontScale(1);
                  }}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold rounded-xl text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw size={13} />
                  <span>افتراضي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowThemeModal(false)}
                  className={`flex-1 py-2.5 ${currentTheme.primary} ${currentTheme.hover} text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm`}
                >
                  حفظ وإغلاق
                </button>
              </div>
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
        {/* Quick Status Shortcut Modal */}
        {quickStatusStudent && (
          <Modal onClose={() => setQuickStatusStudent(null)} zIndex="z-[60]" maxWidth="max-w-md">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto w-full text-right border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shadow-xs">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm">تعديل سريع لحالة الطالب</h3>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">{cleanName(quickStatusStudent.firstName)} {quickStatusStudent.lastName || ''}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setQuickStatusStudent(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Selector Options */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">اختر الحالة الدراسية:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'active', label: 'مستمر بالدراسة', color: 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', dot: 'bg-emerald-500' },
                    { id: 'transferred', label: 'منقول / صادر وثيقة', color: 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', dot: 'bg-amber-500' },
                    { id: 'left', label: 'تارك للدراسة', color: 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300', dot: 'bg-rose-500' },
                    { id: 'graduated', label: 'متخرج', color: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300', dot: 'bg-blue-500' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setQuickStatusValue(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        quickStatusValue === opt.id 
                          ? `${opt.color} ring-2 ring-blue-500/30 font-black shadow-xs` 
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${opt.dot}`}></span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transferred Fields */}
              {quickStatusValue === 'transferred' && (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 space-y-2.5 animate-fade-in">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <FileText size={14} /> بيانات النقل والوثيقة
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">الجهة الصادرة إليها:</label>
                    <input 
                      type="text"
                      value={quickDocDestination}
                      onChange={e => setQuickDocDestination(e.target.value)}
                      placeholder="مثال: متوسطة البصرة للبنين"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">الصف المنقول فيه:</label>
                      <input 
                        type="text"
                        value={quickTransferGrade}
                        onChange={e => setQuickTransferGrade(e.target.value)}
                        placeholder="مثال: الرابع علمي"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">تاريخ الوثيقة:</label>
                      <input 
                        type="date"
                        value={quickDocDate}
                        onChange={e => setQuickDocDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Graduated Fields */}
              {quickStatusValue === 'graduated' && (
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 space-y-2.5 animate-fade-in">
                  <div className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <GraduationCap size={15} /> بيانات التخرج
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">العام الدراسي للتخرج:</label>
                    <select
                      value={quickGradYear}
                      onChange={e => setQuickGradYear(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {allGraduationYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">الدور:</label>
                      <select
                        value={quickGradRound}
                        onChange={e => setQuickGradRound(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="الدور الأول">الدور الأول</option>
                        <option value="الدور الثاني">الدور الثاني</option>
                        <option value="الدور الثالث">الدور الثالث</option>
                        <option value="الدور الخاص">الدور الخاص</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">الصف:</label>
                      <select
                        value={quickGradGrade}
                        onChange={e => setQuickGradGrade(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="السادس العلمي">السادس العلمي</option>
                        <option value="السادس الأدبي">السادس الأدبي</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveQuickStatus}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Save size={15} /> حفظ وتحديث الحالة
                </button>
                <button
                  type="button"
                  onClick={() => setQuickStatusStudent(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Stats Modal with Recharts Visualizations */}
        {view === 'stats' && (() => {
          const activeStudents = students.filter(s => !s.isDeleted);
          const activeTotal = activeStudents.filter(s => !s.status || s.status === 'active').length;
          const transferredTotal = activeStudents.filter(s => s.status === 'transferred' || !!s.docDestination || !!s.docDate).length;
          const leftTotal = activeStudents.filter(s => s.status === 'left').length;
          const graduatedTotal = activeStudents.filter(s => s.status === 'graduated').length;
          const grandTotal = activeStudents.length;

          const pieData = [
            { name: 'مستمر', value: activeTotal, color: '#10b981' },
            { name: 'منقول', value: transferredTotal, color: '#f59e0b' },
            { name: 'تارك', value: leftTotal, color: '#ef4444' },
            { name: 'متخرج', value: graduatedTotal, color: '#3b82f6' }
          ].filter(item => item.value > 0);

          const barData = regStats.map(r => ({
            name: `قيد ${r.reg}`,
            مستمر: r.active,
            منقول: r.transferred,
            تارك: r.left,
            متخرج: r.graduated,
            total: r.total
          }));

          return (
            <Modal onClose={() => setView('list')} maxWidth="max-w-5xl">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl pt-7 px-4 pb-4 sm:p-6 space-y-4 max-h-[88vh] flex flex-col w-full text-right border border-slate-100 dark:border-slate-800">
                {/* Header (clear of Modal's top drag handle and left X button) */}
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 pl-9">
                  <div className="p-2.5 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shadow-xs shrink-0">
                    <BarChart3 size={22} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 leading-tight truncate">
                      لوحة الإحصائيات والرسوم البيانية
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      توزيع حالات الطلاب عبر دفاتر القيود
                    </p>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 custom-scrollbar space-y-4 px-0.5">
                  {/* Summary Metric Cards (Symmetric 1 + 2x2 on mobile, 5 columns on desktop) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex sm:block items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي الطلاب</div>
                        <div className="text-[10px] text-slate-400 mt-0.5"><span dir="ltr">100%</span> من المسجلين</div>
                      </div>
                      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono sm:mt-1">{grandTotal}</div>
                    </div>
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> مستمر
                        </div>
                        <span dir="ltr" className="text-[10px] font-bold text-emerald-600/90 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded-md">
                          {grandTotal > 0 ? Math.round((activeTotal / grandTotal) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-1">{activeTotal}</div>
                    </div>
                    <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-900/60">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span> منقول
                        </div>
                        <span dir="ltr" className="text-[10px] font-bold text-amber-700/90 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-md">
                          {grandTotal > 0 ? Math.round((transferredTotal / grandTotal) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono mt-1">{transferredTotal}</div>
                    </div>
                    <div className="bg-rose-50/70 dark:bg-rose-950/30 p-3 rounded-2xl border border-rose-200/80 dark:border-rose-900/60">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span> تارك
                        </div>
                        <span dir="ltr" className="text-[10px] font-bold text-rose-600/90 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-900/50 px-1.5 py-0.5 rounded-md">
                          {grandTotal > 0 ? Math.round((leftTotal / grandTotal) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400 font-mono mt-1">{leftTotal}</div>
                    </div>
                    <div className="bg-blue-50/70 dark:bg-blue-950/30 p-3 rounded-2xl border border-blue-200/80 dark:border-blue-900/60">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span> متخرج
                        </div>
                        <span dir="ltr" className="text-[10px] font-bold text-blue-600/90 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/50 px-1.5 py-0.5 rounded-md">
                          {grandTotal > 0 ? Math.round((graduatedTotal / grandTotal) * 100) : 0}%
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-400 font-mono mt-1">{graduatedTotal}</div>
                    </div>
                  </div>

                  {/* Recharts Graphical Visualizations */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    {/* 1. Status Distribution Donut Chart */}
                    <div className="p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>🥧</span> توزيع الطلاب حسب الحالة
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400">مخطط دائري</span>
                      </div>
                      <div className="h-56 sm:h-64 w-full flex items-center justify-center">
                        {pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={76}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: any, name: any) => [`${value} طالب`, name]}
                                contentStyle={{ 
                                  direction: 'rtl', 
                                  backgroundColor: '#1e293b', 
                                  color: '#f8fafc', 
                                  borderRadius: '12px', 
                                  border: 'none', 
                                  fontSize: '11px',
                                  fontWeight: 'bold' 
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={34} 
                                formatter={(value) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mx-1">{value}</span>}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-xs text-slate-400 font-bold">لا توجد بيانات كافية للرسم</div>
                        )}
                      </div>
                    </div>

                    {/* 2. Registration Books Stacked Bar Chart */}
                    <div className="p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>📊</span> توزيع الحالات حسب دفتر القيد
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400">{barData.length} دفاتر قيد</span>
                      </div>
                      <div className="h-56 sm:h-64 w-full flex items-center justify-center">
                        {barData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip 
                                formatter={(value: any, name: any) => [`${value} طالب`, name]}
                                contentStyle={{ 
                                  direction: 'rtl', 
                                  backgroundColor: '#1e293b', 
                                  color: '#f8fafc', 
                                  borderRadius: '12px', 
                                  border: 'none', 
                                  fontSize: '11px',
                                  fontWeight: 'bold' 
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={34} 
                                formatter={(value) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mx-1">{value}</span>}
                              />
                              <Bar dataKey="مستمر" fill="#10b981" stackId="a" />
                              <Bar dataKey="منقول" fill="#f59e0b" stackId="a" />
                              <Bar dataKey="تارك" fill="#ef4444" stackId="a" />
                              <Bar dataKey="متخرج" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-xs text-slate-400 font-bold">لا توجد بيانات كافية للرسم</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Breakdown by Registration Book */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>📑</span> تفاصيل القيود ({regStats.length})
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400">انقر على أي قيد لعرض طلابه</span>
                    </div>

                    {/* Mobile Cards (< md): Clean, non-wrapping badges + visual distribution bar */}
                    <div className="md:hidden space-y-2.5">
                      {regStats.length > 0 ? regStats.map((item) => {
                        const pctActive = item.total > 0 ? Math.round((item.active / item.total) * 100) : 0;
                        const pctTransferred = item.total > 0 ? Math.round((item.transferred / item.total) * 100) : 0;
                        const pctLeft = item.total > 0 ? Math.round((item.left / item.total) * 100) : 0;
                        const pctGraduated = item.total > 0 ? Math.round((item.graduated / item.total) * 100) : 0;
                        return (
                          <div
                            key={item.reg}
                            onClick={() => { setSelectedRegFilter(item.reg); setView('list'); }}
                            className="bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 cursor-pointer active:scale-[0.99] transition-transform"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`${currentTheme.primary} text-white px-2.5 py-1 rounded-lg font-mono text-xs font-bold whitespace-nowrap inline-flex items-center`}>
                                قيد {item.reg}
                              </span>
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">{item.total}</span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">طالب</span>
                              </div>
                            </div>

                            {/* Visual Stacked Distribution Bar */}
                            <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden flex">
                              {item.active > 0 && <div style={{ width: `${(item.active / item.total) * 100}%` }} className="bg-emerald-500 h-full" />}
                              {item.transferred > 0 && <div style={{ width: `${(item.transferred / item.total) * 100}%` }} className="bg-amber-500 h-full" />}
                              {item.left > 0 && <div style={{ width: `${(item.left / item.total) * 100}%` }} className="bg-rose-500 h-full" />}
                              {item.graduated > 0 && <div style={{ width: `${(item.graduated / item.total) * 100}%` }} className="bg-blue-500 h-full" />}
                            </div>

                            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                              {item.active > 0 && (
                                <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800 whitespace-nowrap inline-flex items-center gap-1">
                                  <span>مستمر: {item.active}</span>
                                  <span dir="ltr" className="opacity-80">({pctActive}%)</span>
                                </span>
                              )}
                              {item.transferred > 0 && (
                                <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200/80 dark:border-amber-800 whitespace-nowrap inline-flex items-center gap-1">
                                  <span>منقول: {item.transferred}</span>
                                  <span dir="ltr" className="opacity-80">({pctTransferred}%)</span>
                                </span>
                              )}
                              {item.left > 0 && (
                                <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-lg border border-rose-200/80 dark:border-rose-800 whitespace-nowrap inline-flex items-center gap-1">
                                  <span>تارك: {item.left}</span>
                                  <span dir="ltr" className="opacity-80">({pctLeft}%)</span>
                                </span>
                              )}
                              {item.graduated > 0 && (
                                <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200/80 dark:border-blue-800 whitespace-nowrap inline-flex items-center gap-1">
                                  <span>متخرج: {item.graduated}</span>
                                  <span dir="ltr" className="opacity-80">({pctGraduated}%)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="p-6 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl">لا توجد بيانات متاحة</div>
                      )}
                    </div>

                    {/* Desktop Table (>= md) */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                          <tr>
                            <th className="p-3 w-28">رقم القيد</th>
                            <th className="p-3 w-28 text-center">إجمالي الطلاب</th>
                            <th className="p-3 w-40">نسبة التوزيع</th>
                            <th className="p-3">تفصيل الحالات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {regStats.length > 0 ? regStats.map((item) => (
                            <tr
                              key={item.reg}
                              onClick={() => { setSelectedRegFilter(item.reg); setView('list'); }}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                            >
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                <span className={`${currentTheme.primary} text-white px-2.5 py-0.5 rounded-lg font-mono text-xs font-bold whitespace-nowrap inline-block`}>
                                  قيد {item.reg}
                                </span>
                              </td>
                              <td className="p-3 font-black text-slate-900 dark:text-slate-100 text-center font-mono whitespace-nowrap">
                                {item.total} طالب
                              </td>
                              <td className="p-3">
                                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
                                  {item.active > 0 && <div style={{ width: `${(item.active / item.total) * 100}%` }} className="bg-emerald-500 h-full" title={`مستمر: ${item.active}`} />}
                                  {item.transferred > 0 && <div style={{ width: `${(item.transferred / item.total) * 100}%` }} className="bg-amber-500 h-full" title={`منقول: ${item.transferred}`} />}
                                  {item.left > 0 && <div style={{ width: `${(item.left / item.total) * 100}%` }} className="bg-rose-500 h-full" title={`تارك: ${item.left}`} />}
                                  {item.graduated > 0 && <div style={{ width: `${(item.graduated / item.total) * 100}%` }} className="bg-blue-500 h-full" title={`متخرج: ${item.graduated}`} />}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                                  {item.active > 0 && (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 whitespace-nowrap inline-flex items-center gap-1">
                                      <span>مستمر: {item.active}</span>
                                      <span dir="ltr">({item.total > 0 ? Math.round((item.active / item.total) * 100) : 0}%)</span>
                                    </span>
                                  )}
                                  {item.transferred > 0 && (
                                    <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 whitespace-nowrap inline-flex items-center gap-1">
                                      <span>منقول: {item.transferred}</span>
                                      <span dir="ltr">({item.total > 0 ? Math.round((item.transferred / item.total) * 100) : 0}%)</span>
                                    </span>
                                  )}
                                  {item.left > 0 && (
                                    <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800 whitespace-nowrap inline-flex items-center gap-1">
                                      <span>تارك: {item.left}</span>
                                      <span dir="ltr">({item.total > 0 ? Math.round((item.left / item.total) * 100) : 0}%)</span>
                                    </span>
                                  )}
                                  {item.graduated > 0 && (
                                    <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 whitespace-nowrap inline-flex items-center gap-1">
                                      <span>متخرج: {item.graduated}</span>
                                      <span dir="ltr">({item.total > 0 ? Math.round((item.graduated / item.total) * 100) : 0}%)</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400 font-bold">لا توجد بيانات متاحة</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <button 
                  type="button"
                  onClick={() => setView('list')} 
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold rounded-xl text-slate-700 dark:text-slate-200 text-xs transition-colors cursor-pointer shrink-0"
                >
                  إغلاق الإحصائيات
                </button>
              </div>
            </Modal>
          );
        })()}

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
                        {s.status === 'graduated' && (s.graduationYear || s.graduationGrade || s.graduationRound) && (
                          <div className="share-detail-item col-span-2 bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 mt-1">
                            <div className="text-[11px] font-bold text-blue-900 mb-1">🎓 بيانات التخرج:</div>
                            <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-800">
                              {s.graduationYear && <div>📅 العام: <span className="font-bold">{s.graduationYear}</span></div>}
                              {s.graduationRound && <div>📋 الدور: <span className="font-bold">{s.graduationRound}</span></div>}
                              {s.graduationGrade && <div>🎒 الصف: <span className="font-bold">{s.graduationGrade}</span></div>}
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
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet size={15} className="text-blue-600" />
                        <span>سجل القيد العام</span>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                        {listOrientation === 'portrait' ? 'عمودي (62 طالب/صفحة)' : 'عرضي (63 طالب/صفحة)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-600 shrink-0">تخطيط الصفحة:</label>
                      <select 
                        value={listOrientation} 
                        onChange={(e) => setListOrientation(e.target.value as 'portrait' | 'landscape')} 
                        className="flex-1 p-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-bold outline-none cursor-pointer"
                      >
                        <option value="portrait">عمودي (طولي) - مطابق لصفحات الجوال (عمودين)</option>
                        <option value="landscape">أفقي (عرضي) - ورقة عرضية (3 أعمدة)</option>
                      </select>
                    </div>

                    <button 
                      type="button"
                      onClick={() => { 
                        document.title = 'سجل القيد العام';
                        setPrintMode('list'); 
                        setPrintRegInput(''); 
                        setShowPrintModal(false); 
                        setTimeout(() => window.print(), 500); 
                      }} 
                      className={`w-full py-2.5 ${currentTheme.primary} ${currentTheme.hover} text-white rounded-xl font-bold transition-colors text-xs flex items-center justify-center gap-2 shadow-sm`}
                    >
                      <Printer size={15} /> طباعة السجل بالكامل ({listOrientation === 'portrait' ? 'عمودي' : 'عرضي'})
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
                            document.title = 'سجل القيد العام';
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
                        const exportDocTitle = docsExportYear && docsExportYear !== 'ALL'
                          ? `صادر الوثائق لسنة ${docsExportYear}`
                          : 'صادر الوثائق - جميع السنوات';
                        document.title = exportDocTitle;
                        let styleEl = document.getElementById('docs-page-orientation-style') as HTMLStyleElement | null;
                        if (!styleEl) {
                          styleEl = document.createElement('style');
                          styleEl.id = 'docs-page-orientation-style';
                          document.head.appendChild(styleEl);
                        }
                        styleEl.innerHTML = `@page { size: ${docsOrientation}; margin: ${docsOrientation === 'portrait' ? '4mm 4mm' : '3mm 4mm'}; }`;
                        if (docsOrientation === 'landscape') {
                          document.body.classList.add('print-landscape');
                        } else {
                          document.body.classList.remove('print-landscape');
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
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-relaxed">
                          <span>{cleanName(s.firstName)}</span>
                          {s.lastName && (
                            <span className="text-blue-600 dark:text-blue-400 font-bold mr-1.5">
                              ({restoreYehDots(s.lastName)})
                            </span>
                          )}
                        </h1>
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

                        {/* بيانات التخرج */}
                        {(s.status === 'graduated' || s.graduationYear || s.graduationGrade || s.graduationRound) && (
                          <div className="pt-3 border-t border-slate-200">
                            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
                              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5 border-b border-blue-200 pb-1.5">
                                <GraduationCap size={15} className="text-blue-600" />
                                <span>بيانات التخرج الرسمية</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-[10px] font-bold text-blue-800 block">العام الدراسي:</span>
                                  <span className="font-bold text-slate-800 font-mono">{s.graduationYear || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-blue-800 block">الدور:</span>
                                  <span className="font-bold text-slate-800">{s.graduationRound || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-blue-800 block">الصف / الفرع:</span>
                                  <span className="font-bold text-slate-800">{s.graduationGrade || '—'}</span>
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
                            setFormGraduationYear(s.graduationYear || (allGraduationYears[0] || '2024-2025'));
                            setFormGraduationRound(s.graduationRound || 'الدور الأول');
                            setFormGraduationGrade(s.graduationGrade || 'السادس العلمي');
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
                              graduationYear: s.graduationYear || '',
                              graduationRound: s.graduationRound || 'الدور الأول',
                              graduationGrade: s.graduationGrade || 'السادس العلمي',
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
          <Modal onClose={() => {}} zIndex="z-[80]" dismissible={false}>
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
      
      {printMode === 'list' && (
        <PrintView 
          students={filtered} 
          title={selectedRegFilter ? `كشف الطلاب - قيد رقم ${selectedRegFilter}` : "كشف القيد العام"} 
          selectedFields={printTemplateFields} 
          orientation={listOrientation}
        />
      )}
      {printMode === 'selected' && (
        <PrintView 
          students={students.filter(s => selectedStudents.includes(s.id) && !s.isDeleted)} 
          title="الطلاب المحددين" 
          selectedFields={printTemplateFields} 
          orientation={listOrientation}
        />
      )}
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
