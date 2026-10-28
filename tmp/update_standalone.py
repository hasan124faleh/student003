import re

with open('public/standalone.html', 'r', encoding='utf-8') as f:
    content = f.read()

# DocsExportPrint component in JavaScript
docs_export_component = '''
         // Outgoing Documents Log Print View (طباعة صادر الوثائق - ورقة عرضية)
         const DocsExportPrint = ({ students, selectedYear }) => {
           const transferredStudents = useMemo(() => {
             let list = students.filter(s => !s.isDeleted && (s.status === 'transferred' || !!s.docDestination || !!s.docDate));
             if (selectedYear !== 'ALL') {
               list = list.filter(s => {
                 const yearFromDoc = s.docDate ? s.docDate.substring(0, 4) : '';
                 const yearFromCreated = new Date(s.createdAt).getFullYear().toString();
                 return yearFromDoc === selectedYear || (!yearFromDoc && yearFromCreated === selectedYear);
               });
             }
             return list.sort((a, b) => {
               const dateA = a.docDate || new Date(a.createdAt).toISOString().split('T')[0];
               const dateB = b.docDate || new Date(b.createdAt).toISOString().split('T')[0];
               return dateA.localeCompare(dateB);
             });
           }, [students, selectedYear]);

           const ROWS_PER_PAGE = 18;
           const totalItems = transferredStudents.length;
           const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE) || 1;
           const printDate = new Date().toLocaleDateString('ar-EG');
           
           const pages = [];
           for (let i = 0; i < totalPages; i++) {
             pages.push(transferredStudents.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE));
           }
           if (pages.length === 0) {
             pages.push([]);
           }

           return (
             <div className="print-only text-[10pt] dir-rtl font-cairo">
               <style>{`
                 @media print {
                   @page {
                     size: A4 landscape !important;
                     margin: 6mm 8mm !important;
                   }
                   html, body {
                     width: 297mm !important;
                     max-width: 297mm !important;
                     min-width: 297mm !important;
                     margin: 0 !important;
                     padding: 0 !important;
                     height: auto !important;
                     background: white !important;
                     color: black !important;
                   }
                   .no-print {
                     display: none !important;
                   }
                   .print-only {
                     display: block !important;
                   }
                   .docs-print-page {
                     width: 281mm !important;
                     min-height: 196mm !important;
                     box-sizing: border-box !important;
                     page-break-after: always !important;
                     break-after: page !important;
                     display: flex !important;
                     flex-direction: column !important;
                     justify-content: space-between !important;
                     padding: 5mm 6mm !important;
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
                     border: 1.5px solid #0f172a !important;
                     padding: 4px 6px !important;
                     color: #0f172a !important;
                     font-size: 9.5pt !important;
                     vertical-align: middle !important;
                   }
                   .docs-table th {
                     background-color: #f1f5f9 !important;
                     font-weight: 800 !important;
                     -webkit-print-color-adjust: exact !important;
                     print-color-adjust: exact !important;
                   }
                 }
               `}</style>
               
               {pages.map((pageRows, pageIdx) => (
                 <div key={pageIdx} className="docs-print-page">
                   <div>
                     {/* Official Header */}
                     <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
                       <div className="text-right text-[9pt] font-bold leading-relaxed text-slate-800 w-64">
                         <div>جمهورية العراق</div>
                         <div>وزارة التربية</div>
                         <div>المديرية العامة للتربية</div>
                       </div>

                       <div className="text-center flex-1">
                         <div className="text-xl font-black text-slate-900 tracking-wide font-cairo">
                           سجل صادر الوثائق المدرسية (الطلبة المنقولين)
                         </div>
                         <div className="text-xs font-bold text-slate-700 mt-1 bg-slate-100 inline-block px-4 py-0.5 rounded-full border border-slate-300">
                           {selectedYear === 'ALL' ? 'جميع السنوات الدراسية' : `للسنة الدراسية: ${selectedYear}`}
                         </div>
                       </div>

                       <div className="text-left text-[9pt] font-bold leading-relaxed text-slate-800 w-64">
                         <div>تاريخ الطباعة: {printDate}</div>
                         <div>الصفحة: {pageIdx + 1} من {totalPages}</div>
                         <div>إجمالي الوثائق: {totalItems}</div>
                       </div>
                     </div>

                     {/* Official Table */}
                     <table className="docs-table w-full">
                       <thead>
                         <tr className="bg-slate-100 text-center">
                           <th style={{ width: '40px' }} className="text-center font-bold">ت</th>
                           <th style={{ width: '105px' }} className="text-center font-bold">تاريخ الوثيقة</th>
                           <th style={{ width: '230px' }} className="text-right font-bold pr-2">اسم الطالب الرباعي</th>
                           <th style={{ width: '190px' }} className="text-right font-bold pr-2">الجهة الصادر إليها</th>
                           <th style={{ width: '140px' }} className="text-center font-bold">الغرض من الوثيقة</th>
                           <th style={{ width: '135px' }} className="text-center font-bold">الصف الذي انتقل فيه</th>
                           <th style={{ width: '120px' }} className="text-center font-bold">الملاحظات</th>
                         </tr>
                       </thead>
                       <tbody>
                         {Array.from({ length: ROWS_PER_PAGE }).map((_, rIdx) => {
                           const s = pageRows[rIdx];
                           const serial = pageIdx * ROWS_PER_PAGE + rIdx + 1;
                           return (
                             <tr key={rIdx} style={{ height: '32px' }}>
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

                   {/* Official Signatures Footer */}
                   <div className="pt-2 border-t-2 border-slate-900 mt-2 flex justify-between items-end px-12 text-center text-xs font-bold text-slate-900">
                     <div>
                       <div className="mb-8">منظم السجل</div>
                       <div className="border-t border-slate-800 w-36 pt-1">التوقيع والاسم</div>
                     </div>
                     <div>
                       <div className="mb-8">مدقق السجل</div>
                       <div className="border-t border-slate-800 w-36 pt-1">التوقيع والاسم</div>
                     </div>
                     <div>
                       <div className="mb-8">ختم وتوقيع مدير المدرسة</div>
                       <div className="border-t border-slate-800 w-44 pt-1">المدير</div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           );
         };
'''

# 1. Insert DocsExportPrint before const Login = () => {
if 'const DocsExportPrint' not in content:
    login_marker = '         const Login = () => {'
    if login_marker in content:
        content = content.replace(login_marker, docs_export_component + '\n' + login_marker, 1)
        print("INSERTED DocsExportPrint")
    else:
        print("LOGIN MARKER NOT FOUND")
else:
    print("DocsExportPrint ALREADY PRESENT")

# 2. Update showPrintModal in standalone.html
old_print_modal = '''                {/* Print Modal */}
                {showPrintModal && (
                    <Modal onClose={() => setShowPrintModal(false)}>
                       <div className="bg-white rounded-2xl p-5 text-center space-y-3 shadow-xl">
                          <h3 className="text-lg font-bold">خيارات الطباعة</h3>
                          <button 
                            onClick={() => { 
                              setPrintMode('list'); 
                              setPrintRegInput(''); 
                              setShowPrintModal(false); 
                              setTimeout(() => window.print(), 500); 
                            }} 
                            className={`w-full py-2.5 ${currentTheme.primary} ${currentTheme.hover} text-white rounded-xl font-bold transition-colors text-sm`}
                          >
                            طباعة السجل الحالي بالكامل
                          </button>
                          <div className="text-slate-400 text-[10px]">أو طباعة قيد محدد</div>
                          <select value={printRegInput} onChange={(e) => setPrintRegInput(e.target.value)} className={`w-full p-2.5 border rounded-xl text-center font-bold outline-none text-sm ${currentTheme.ring}`}>
                               <option value="">اختر رقم القيد...</option>
                               {Array.from(new Set(students.filter(s => !s.isDeleted).map(s => s.regNumber))).sort((a,b) => Number(a)-Number(b)).map(r => (
                                 <option key={r} value={r}>قيد {r}</option>
                               ))}
                          </select>
                          <button 
                            onClick={() => { 
                              setPrintMode('list'); 
                              setSelectedRegFilter(printRegInput); 
                              setShowPrintModal(false); 
                              setTimeout(() => window.print(), 500); 
                            }} 
                            className={`w-full py-2.5 ${currentTheme.secondary} ${currentTheme.secondaryHover} text-white rounded-xl font-bold disabled:opacity-50 transition-colors text-sm`} 
                            disabled={!printRegInput}
                          >
                            طباعة القيد المحدد
                          </button>
                       </div>
                    </Modal>
                )}'''

new_print_modal = '''                {/* Print Modal */}
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

                          {/* القسم 2: طباعة صادر الوثائق (الطلبة المنقولين) - ورقة عرضية */}
                          <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                              <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                <FileText size={16} className="text-amber-700" />
                                <span>طباعة صادر الوثائق (الطلبة المنقولين)</span>
                              </div>
                              <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                                ورقة عرضية
                              </span>
                            </div>

                            <p className="text-[11px] text-amber-900/80 leading-relaxed font-medium">
                              كشف رسمي يتضمن: (ت، تاريخ الوثيقة، اسم الطالب الرباعي، الجهة الصادر إليها، الغرض من الوثيقة، الصف الذي انتقل فيه، الملاحظات)
                            </p>

                            <div>
                              <label className="block text-[11px] font-bold text-amber-950 mb-1">
                                تحديد السنة الدراسية:
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
                )}'''

if old_print_modal in content:
    content = content.replace(old_print_modal, new_print_modal, 1)
    print("UPDATED showPrintModal")
else:
    print("OLD PRINT MODAL NOT FOUND")

# 3. Add printMode render at the end
old_render_end = '''              {printMode === 'selected' && <PrintView students={students.filter(s => selectedStudents.includes(s.id) && !s.isDeleted)} title="الطلاب المحددين" selectedFields={printTemplateFields} />}
            </>'''

new_render_end = '''              {printMode === 'selected' && <PrintView students={students.filter(s => selectedStudents.includes(s.id) && !s.isDeleted)} title="الطلاب المحددين" selectedFields={printTemplateFields} />}
              {printMode === 'docsExport' && <DocsExportPrint students={students} selectedYear={docsExportYear} />}
            </>'''

if old_render_end in content:
    content = content.replace(old_render_end, new_render_end, 1)
    print("UPDATED render end")
else:
    print("OLD RENDER END NOT FOUND")

with open('public/standalone.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("COMPLETED")
