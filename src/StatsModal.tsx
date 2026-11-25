import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
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
import type { Student } from './App';

interface StatsModalContentProps {
  students: Student[];
  currentTheme: { primary: string };
  onClose: () => void;
  onSelectReg: (reg: string) => void;
}

export default function StatsModalContent({
  students,
  currentTheme,
  onClose,
  onSelectReg,
}: StatsModalContentProps) {
  const {
    grandTotal,
    activeTotal,
    transferredTotal,
    leftTotal,
    graduatedTotal,
    regStats,
    pieData,
    barData,
  } = useMemo(() => {
    let total = 0;
    let active = 0;
    let transferred = 0;
    let left = 0;
    let graduated = 0;

    const statsMap: Record<
      string,
      { total: number; active: number; transferred: number; left: number; graduated: number }
    > = {};

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (s.isDeleted) continue;
      total++;

      const isTransferredDoc = s.status === 'transferred' || !!s.docDestination || !!s.docDate;
      if (!s.status || s.status === 'active') active++;
      if (isTransferredDoc) transferred++;
      if (s.status === 'left') left++;
      if (s.status === 'graduated') graduated++;

      const reg = s.regNumber;
      if (!statsMap[reg]) {
        statsMap[reg] = { total: 0, active: 0, transferred: 0, left: 0, graduated: 0 };
      }
      statsMap[reg].total++;
      const status = s.status || 'active';
      if (statsMap[reg][status] !== undefined) {
        statsMap[reg][status]++;
      }
    }

    const sortedRegs = Object.entries(statsMap)
      .map(([reg, counts]) => ({ reg, ...counts }))
      .sort((a, b) => Number(a.reg) - Number(b.reg));

    const pie = [
      { name: 'مستمر', value: active, color: '#10b981' },
      { name: 'منقول', value: transferred, color: '#f59e0b' },
      { name: 'تارك', value: left, color: '#ef4444' },
      { name: 'متخرج', value: graduated, color: '#3b82f6' }
    ].filter(item => item.value > 0);

    const bar = sortedRegs.map(r => ({
      name: `قيد ${r.reg}`,
      مستمر: r.active,
      منقول: r.transferred,
      تارك: r.left,
      متخرج: r.graduated,
      total: r.total
    }));

    return {
      grandTotal: total,
      activeTotal: active,
      transferredTotal: transferred,
      leftTotal: left,
      graduatedTotal: graduated,
      regStats: sortedRegs,
      pieData: pie,
      barData: bar,
    };
  }, [students]);

  return (
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
        {/* Summary Metric Cards */}
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

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2.5">
            {regStats.length > 0 ? regStats.map((item) => {
              const pctActive = item.total > 0 ? Math.round((item.active / item.total) * 100) : 0;
              const pctTransferred = item.total > 0 ? Math.round((item.transferred / item.total) * 100) : 0;
              const pctLeft = item.total > 0 ? Math.round((item.left / item.total) * 100) : 0;
              const pctGraduated = item.total > 0 ? Math.round((item.graduated / item.total) * 100) : 0;
              return (
                <div
                  key={item.reg}
                  onClick={() => onSelectReg(item.reg)}
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

          {/* Desktop Table */}
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
                    onClick={() => onSelectReg(item.reg)}
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
        onClick={onClose}
        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold rounded-xl text-slate-700 dark:text-slate-200 text-xs transition-colors cursor-pointer shrink-0"
      >
        إغلاق الإحصائيات
      </button>
    </div>
  );
}
