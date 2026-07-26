import React from 'react';

interface AttendanceReportTemplateProps {
    reportData: any[];
    madrasah: any;
    className: string;
    month?: string; // e.g. "April 2026"
    lang: 'en' | 'bn';
}

export const AttendanceReportTemplate: React.FC<AttendanceReportTemplateProps> = ({ reportData, madrasah, className, month, lang }) => {
    const isBn = lang === 'bn';
    
    const calculatedData = reportData.map(item => {
        const late = Number(item.late ?? item.late_days ?? 0);
        const present = Number(item.present ?? item.present_days ?? 0);
        const total = Number(item.total ?? item.total_days ?? 0);
        const absent = Number(item.absent ?? item.absent_days ?? 0);
        const holiday = Number(item.holiday ?? item.holiday_days ?? 0);
        const leave = Number(item.leave ?? item.leave_days ?? 0);
        const halfDay = Number(item.half_day ?? item.half_days ?? 0);

        const effectiveWorkingDays = Math.max(0, total - holiday);
        const attendedDays = present + late + (halfDay * 0.5);
        const pct = effectiveWorkingDays > 0 ? Math.min(100, Math.max(0, Math.round((attendedDays / effectiveWorkingDays) * 100))) : 0;

        return { ...item, late, present, absent, total, holiday, leave, halfDay, pct };
    });

    // Sort by percentage to calculate rank
    calculatedData.sort((a, b) => b.pct - a.pct);
    let currentRank = 1;
    calculatedData.forEach((item, index) => {
        if (index > 0) {
            if (item.pct !== calculatedData[index - 1].pct) {
                currentRank++;
            }
        }
        item.rank = currentRank;
    });

    // Sort back by class serial then roll
    calculatedData.sort((a, b) => {
        const orderA = a.class_sort_order ?? 999999;
        const orderB = b.class_sort_order ?? 999999;
        
        if (orderA !== orderB) return orderA - orderB;

        const rollA = typeof a.roll === 'string' ? parseInt(a.roll) || parseInt(a.roll?.replace(/\D/g,'')) || 0 : (a.roll || 0);
        const rollB = typeof b.roll === 'string' ? parseInt(b.roll) || parseInt(b.roll?.replace(/\D/g,'')) || 0 : (b.roll || 0);
        return rollA - rollB;
    });

    const ROWS_PER_PAGE = 22;
    const totalPages = Math.ceil(calculatedData.length / ROWS_PER_PAGE) || 1;

    return (
        <>
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
                const pageData = calculatedData.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
                
                return (
                    <div key={pageIndex} className="page-container" style={{ width: '794px', height: '1123px', padding: '40px', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', position: 'relative', boxSizing: 'border-box' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #3b82f6', paddingBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
                                {madrasah?.logo_url && (
                                    <img src={madrasah.logo_url} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                )}
                                <h1 style={{ 
                                    fontSize: (madrasah?.name?.length || 0) > 60 ? '14px' : (madrasah?.name?.length || 0) > 45 ? '18px' : (madrasah?.name?.length || 0) > 30 ? '22px' : '26px', 
                                    fontWeight: 'bold', 
                                    margin: '0', 
                                    color: '#1e3a8a', 
                                    lineHeight: '1.2', 
                                    display: 'block',
                                    flex: 1
                                }}>{madrasah?.name || 'Madrasah Name'}</h1>
                            </div>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0', color: '#1e40af', marginTop: '10px' }}>
                                {isBn ? 'হাজিরা রিপোর্ট' : 'Attendance Report'}
                            </h2>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>
                                <span>{isBn ? 'ক্লাস' : 'Class'}: {className}</span>
                                {month && <span>{isBn ? 'মাস' : 'Month'}: {month}</span>}
                            </div>
                        </div>

                        {/* Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <th style={thStyle}>{isBn ? 'রোল' : 'Roll'}</th>
                                    <th style={{ ...thStyle, textAlign: 'left' }}>{isBn ? 'নাম' : 'Name'}</th>
                                    <th style={thStyle}>{isBn ? 'মোট' : 'Total'}</th>
                                    <th style={thStyle}>{isBn ? 'উপস্থিত' : 'Present'}</th>
                                    <th style={thStyle}>{isBn ? 'অনুপস্থিত' : 'Absent'}</th>
                                    <th style={thStyle}>{isBn ? 'দেরি' : 'Late'}</th>
                                    <th style={thStyle}>{isBn ? 'ছুটি' : 'Leave'}</th>
                                    <th style={thStyle}>{isBn ? 'বন্ধ' : 'Holiday'}</th>
                                    <th style={thStyle}>{isBn ? 'শতকরা' : 'Percentage'}</th>
                                    <th style={thStyle}>{isBn ? 'পজিশন' : 'Position'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageData.map((item, idx) => {
                                    return (
                                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={tdStyle}>{item.roll || '-'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold' }}>{item.student_name}</td>
                                            <td style={tdStyle}>{item.total}</td>
                                            <td style={{ ...tdStyle, color: '#16a34a', fontWeight: 'bold' }}>{item.present}</td>
                                            <td style={{ ...tdStyle, color: '#dc2626' }}>{item.absent}</td>
                                            <td style={{ ...tdStyle, color: '#d97706' }}>{item.late}</td>
                                            <td style={{ ...tdStyle, color: '#6366f1' }}>{item.leave}</td>
                                            <td style={{ ...tdStyle, color: '#64748b' }}>{item.holiday}</td>
                                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{item.pct}%</td>
                                            <td style={{ ...tdStyle, fontWeight: 'bold', color: '#3b82f6' }}>{item.rank}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Footer - Only on the last page or fixed at bottom */}
                        <div style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', alignItems: 'flex-end' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ minHeight: '30px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '5px' }}>
                                    ................................................
                                </div>
                                {isBn ? 'শিক্ষকের স্বাক্ষর' : 'Teacher Signature'}
                            </div>
                            <div style={{ textAlign: 'center', paddingBottom: '10px' }}>Page {pageIndex + 1} of {totalPages}</div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ height: `${madrasah?.config_json?.signature_height || 40}px`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '5px' }}>
                                    {madrasah?.config_json?.signature_url ? (
                                        <img src={madrasah.config_json.signature_url} alt="Sig" style={{ height: `${madrasah.config_json.signature_height || 40}px`, objectFit: 'contain' }} crossOrigin="anonymous" />
                                    ) : (
                                        <span style={{ color: '#cbd5e1' }}>................................................</span>
                                    )}
                                </div>
                                {isBn ? 'অধ্যক্ষের স্বাক্ষর' : 'Principal Signature'}
                            </div>
                        </div>
                    </div>
                );
            })}
            
            <style>{`
                div, th, td { font-family: 'Noto Sans Bengali', "Inter", system-ui, sans-serif; }
            `}</style>
        </>
    );
};

const thStyle: React.CSSProperties = {
    padding: '8px 4px',
    borderBottom: '2px solid #cbd5e1',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0f172a'
};

const tdStyle: React.CSSProperties = {
    padding: '6px 4px',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'center',
    color: '#334155'
};
