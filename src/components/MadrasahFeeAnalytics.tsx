
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Language, Institution, Class } from 'types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  Users, 
  Calendar, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Loader2, 
  Heart, 
  Wallet,
  BarChart3,
  Filter
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { isValidUUID } from 'utils/validation';

interface MadrasahFeeAnalyticsProps {
  madrasah: Institution;
  lang: Language;
  refreshKey?: number;
}

const localT = {
  monthly: { en: 'Monthly', bn: 'মাসিক' },
  yearly: { en: 'Yearly', bn: 'বার্ষিক' },
  totalIncome: { en: 'Total Income', bn: 'মোট আয়' },
  totalExpense: { en: 'Total Expense', bn: 'মোট ব্যয়' },
  balance: { en: 'Balance', bn: 'বর্তমান ব্যালেন্স' },
  incomeReport: { en: 'Income Report', bn: 'আয় রিপোর্ট' },
  expenseReport: { en: 'Expense Report', bn: 'ব্যয় রিপোর্ট' },
  studentFinancialStatus: { en: 'Student Financial Status', bn: 'ছাত্রদের আর্থিক অবস্থা' },
  totalStudents: { en: 'Total Students', bn: 'মোট ছাত্র' },
  boardingStudents: { en: 'Boarding Students', bn: 'বোর্ডিং ছাত্র' },
  monthlyDonationTrend: { en: 'Monthly Donation Trend', bn: 'মাসিক অনুদান ট্রেন্ড' },
  topDonors: { en: 'Top Donors', bn: 'সেরা দাতা' },
  noDonationData: { en: 'No donation data found', bn: 'কোনো অনুদানের তথ্য পাওয়া যায়নি' },
  title: { en: 'Madrasah Fee Analytics', bn: 'মাদরাসা ফি অ্যানালিটিক্স' },
  subtitle: { en: 'Detailed report of income, expense and financial status', bn: 'আয়-ব্যয় ও আর্থিক অবস্থার বিস্তারিত রিপোর্ট' },
};

const MadrasahFeeAnalytics: React.FC<MadrasahFeeAnalyticsProps> = ({ madrasah, lang, refreshKey }) => {
  const isDark = madrasah?.theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchAnalytics();
  }, [madrasah.id, timeRange, selectedMonth, refreshKey]);

  const fetchAnalytics = async () => {
    if (!isValidUUID(madrasah.id)) return;
    setLoading(true);
    try {
      // 1. Fetch Ledger Data
      let ledgerQuery = supabase.from('ledger').select('*').eq('institution_id', madrasah.id);
      
      if (timeRange === 'month') {
        ledgerQuery = ledgerQuery.gte('transaction_date', `${selectedMonth}-01`).lte('transaction_date', `${selectedMonth}-31`);
      } else if (timeRange === 'year') {
        ledgerQuery = ledgerQuery.gte('transaction_date', `${selectedMonth.slice(0, 4)}-01-01`).lte('transaction_date', `${selectedMonth.slice(0, 4)}-12-31`);
      }

      const { data: ledger } = await ledgerQuery;

      // 2. Fetch Students for status
      const { data: students } = await supabase.from('students').select('id, student_type, sponsor_id').eq('institution_id', madrasah.id);
      
      // 3. Process Financials
      let totalIncome = 0;
      let totalExpense = 0;
      
      const incomeBreakdown: Record<string, number> = {
        'Fee Collection': 0,
        'Donation': 0,
        'Sadaka / Zakat': 0,
        'Other': 0
      };

      const expenseBreakdown: Record<string, number> = {
        'Food': 0,
        'Salary': 0,
        'Monthly/Other': 0
      };

      const monthlyTrend: Record<string, { month: string, income: number, expense: number }> = {};
      const donorAnalysis: Record<string, number> = {};

      ledger?.forEach(entry => {
        const amount = entry.amount;
        const month = entry.transaction_date.slice(0, 7);
        
        if (!monthlyTrend[month]) {
          monthlyTrend[month] = { month, income: 0, expense: 0 };
        }

        if (entry.type === 'income') {
          totalIncome += amount;
          monthlyTrend[month].income += amount;

          // Categorize Income
          if (entry.category === 'Student Fee') {
            incomeBreakdown['Fee Collection'] += amount;
          } else if (entry.category.includes('সদকা') || entry.category.includes('যাকাত')) {
            incomeBreakdown['Sadaka / Zakat'] += amount;
          } else if (entry.category.includes('লিল্লাহ') || entry.category.includes('Donation')) {
            incomeBreakdown['Donation'] += amount;
          } else {
            incomeBreakdown['Other'] += amount;
          }

          // Donor Analysis (extracting name from description if it's a donation)
          if (entry.category.includes('Donation') || entry.category.includes('সদকা')) {
            const donorName = entry.description.split(' - ')[0] || 'Anonymous';
            donorAnalysis[donorName] = (donorAnalysis[donorName] || 0) + amount;
          }
        } else {
          totalExpense += amount;
          monthlyTrend[month].expense += amount;

          // Categorize Expense
          if (entry.category.includes('খাদ্য') || entry.category.includes('রান্না')) {
            expenseBreakdown['Food'] += amount;
          } else if (entry.category.includes('বেতন')) {
            expenseBreakdown['Salary'] += amount;
          } else {
            expenseBreakdown['Monthly/Other'] += amount;
          }
        }
      });

      // 4. Student Financial Status
      // For real "Due" status, we'd need to compare expected vs collected, 
      // but for this dashboard we'll use a simplified version or fetch from the RPC if available.
      // For now, let's use the counts we have.
      const boardingCount = students?.filter(s => s.student_type === 'boarding').length || 0;

      setData({
        summary: {
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense
        },
        incomeBreakdown: Object.entries(incomeBreakdown).map(([name, value]) => ({ name, value })),
        expenseBreakdown: Object.entries(expenseBreakdown).map(([name, value]) => ({ name, value })),
        monthlyTrend: Object.values(monthlyTrend).sort((a, b) => a.month.localeCompare(b.month)),
        topDonors: Object.entries(donorAnalysis)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
        studentStats: {
          total: students?.length || 0,
          boarding: boardingCount
        }
      });

    } catch (err) {
      console.error('Madrasah Analytics Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-[#2563EB]" size={40} />
    </div>
  );

  if (!data) return null;

  const COLORS = ['#8D30F4', '#2563EB', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-black font-noto ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{localT.title[lang]}</h2>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.subtitle[lang]}</p>
        </div>
        <div className={`flex items-center gap-2 p-1.5 rounded-2xl border shadow-sm ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <button 
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${timeRange === 'month' ? 'bg-[#2563EB] text-white shadow-md' : isDark ? 'text-slate-500 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {localT.monthly[lang]}
          </button>
          <button 
            onClick={() => setTimeRange('year')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${timeRange === 'year' ? 'bg-[#2563EB] text-white shadow-md' : isDark ? 'text-slate-500 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {localT.yearly[lang]}
          </button>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={`ml-2 px-3 py-2 rounded-xl text-xs font-black outline-none border transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          />
        </div>
      </div>

      {/* Financial Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-8 rounded-[2.5rem] border shadow-bubble relative overflow-hidden group ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-50 group-hover:scale-110 transition-transform ${isDark ? 'bg-emerald-900/20' : 'bg-emerald-50'}`} />
          <div className="relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
              <ArrowUpCircle size={24} />
            </div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.totalIncome[lang]}</p>
            <h3 className={`text-3xl font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>৳ {data.summary.totalIncome.toLocaleString('bn-BD')}</h3>
          </div>
        </div>

        <div className={`p-8 rounded-[2.5rem] border shadow-bubble relative overflow-hidden group ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-50 group-hover:scale-110 transition-transform ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`} />
          <div className="relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-500'}`}>
              <ArrowDownCircle size={24} />
            </div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.totalExpense[lang]}</p>
            <h3 className="text-3xl font-black text-red-500">৳ {data.summary.totalExpense.toLocaleString('bn-BD')}</h3>
          </div>
        </div>

        <div className={`p-8 rounded-[2.5rem] border shadow-bubble relative overflow-hidden group ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-50 group-hover:scale-110 transition-transform ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`} />
          <div className="relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}>
              <Wallet size={24} />
            </div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.balance[lang]}</p>
            <h3 className={`text-3xl font-black ${data.summary.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ৳ {data.summary.balance.toLocaleString('bn-BD')}
            </h3>
          </div>
        </div>
      </div>

      {/* Income & Expense Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income Report */}
        <div className={`p-8 rounded-[3rem] border shadow-bubble space-y-6 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
                <TrendingUp size={24} />
              </div>
              <h3 className={`text-xl font-black font-noto ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{localT.incomeReport[lang]}</h3>
            </div>
          </div>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.incomeBreakdown} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: isDark ? '#94a3b8' : '#64748b' }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
                  contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                      fontWeight: 900,
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#1e293b'
                  }}
                />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={30}>
                  {data.incomeBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {data.incomeBreakdown.map((item: any, idx: number) => (
              <div key={idx} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`text-[9px] font-black uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.name}</p>
                <p className={`text-lg font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>৳{item.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Report */}
        <div className={`p-8 rounded-[3rem] border shadow-bubble space-y-6 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-500'}`}>
                <TrendingDown size={24} />
              </div>
              <h3 className={`text-xl font-black font-noto ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{localT.expenseReport[lang]}</h3>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.expenseBreakdown} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: isDark ? '#94a3b8' : '#64748b' }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
                  contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                      fontWeight: 900,
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#1e293b'
                  }}
                />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={30}>
                  {data.expenseBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {data.expenseBreakdown.map((item: any, idx: number) => (
              <div key={idx} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`text-[9px] font-black uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.name}</p>
                <p className="text-lg font-black text-red-500">৳{item.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Student Financial Status */}
      <div className={`p-8 rounded-[3rem] border shadow-bubble space-y-6 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}>
            <Users size={24} />
          </div>
          <h3 className={`text-xl font-black font-noto ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{localT.studentFinancialStatus[lang]}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 rounded-[2rem] border flex flex-col items-center text-center ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${isDark ? 'bg-slate-800 text-blue-400' : 'bg-white text-[#2563EB]'}`}>
              <Users size={28} />
            </div>
            <h4 className={`text-2xl font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{data.studentStats.total}</h4>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{localT.totalStudents[lang]}</p>
          </div>

          <div className={`p-6 rounded-[2rem] border flex flex-col items-center text-center ${isDark ? 'bg-indigo-900/20 border-indigo-900/30' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${isDark ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-500'}`}>
              <Calendar size={28} />
            </div>
            <h4 className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{data.studentStats.boarding}</h4>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDark ? 'text-indigo-500' : 'text-indigo-400'}`}>{localT.boardingStudents[lang]}</p>
          </div>
        </div>
      </div>

      {/* Donation Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Donation Chart */}
        <div className={`lg:col-span-2 p-8 rounded-[3rem] border shadow-bubble space-y-6 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-500'}`}>
              <BarChart3 size={24} />
            </div>
            <h3 className={`text-xl font-black font-noto ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{localT.monthlyDonationTrend[lang]}</h3>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyTrend}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: isDark ? '#94a3b8' : '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: isDark ? '#94a3b8' : '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                      fontWeight: 900,
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#1e293b'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#10B981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Donors */}
        <div className={`p-8 rounded-[3rem] border shadow-bubble space-y-6 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-50 text-pink-500'}`}>
              <Heart size={24} />
            </div>
            <h3 className={`text-xl font-black font-noto ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{localT.topDonors[lang]}</h3>
          </div>

          <div className="space-y-4">
            {data.topDonors.length > 0 ? data.topDonors.map((donor: any, idx: number) => (
              <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${isDark ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-white text-slate-400 border-slate-100'}`}>
                    {idx + 1}
                  </div>
                  <p className={`text-sm font-black truncate max-w-[120px] ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'}`}>{donor.name}</p>
                </div>
                <p className="text-sm font-black text-emerald-600">৳{donor.amount.toLocaleString()}</p>
              </div>
            )) : (
              <div className="text-center py-10 text-slate-400 text-xs font-bold">{localT.noDonationData[lang]}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MadrasahFeeAnalytics;
