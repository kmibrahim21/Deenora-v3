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
    
    const ROWS_PER_PAGE = 30;
    const totalPages = Math.ceil(reportData.length / ROWS_PER_PAGE) || 1;

    return (
        <>
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
                const pageData = reportData.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
                
                return (
                    <div key={pageIndex} className="page-container" style={{ width: '794px', height: '1123px', padding: '40px', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', position: 'relative', boxSizing: 'border-box' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #3b82f6', paddingBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
                                {madrasah?.logo_url && (
                                    <img src={madrasah.logo_url} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                )}
                                <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0', color: '#1e3a8a' }}>{madrasah?.name || 'Madrasah Name'}</h1>
                            </div>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0', color: '#1e40af' }}>
                                {isBn ? 'হাজিরা রিপোর্ট' : 'Attendance Report'}
                            </h2>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>
                                <span>{isBn ? 'ক্লাস' : 'Class'}: {className}</span>
                                {month && <span>{isBn ? 'মাস' : 'Month'}: {month}</span>}
                            </div>
                        </div>

                        {/* Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <th style={thStyle}>{isBn ? 'রোল' : 'Roll'}</th>
                                    <th style={{ ...thStyle, textAlign: 'left' }}>{isBn ? 'নাম' : 'Name'}</th>
                                    <th style={thStyle}>{isBn ? 'মোট' : 'Total'}</th>
                                    <th style={thStyle}>{isBn ? 'উপস্থিত' : 'Present'}</th>
                                    <th style={thStyle}>{isBn ? 'অনুপস্থিত' : 'Absent'}</th>
                                    <th style={thStyle}>{isBn ? 'দেরি' : 'Late'}</th>
                                    <th style={thStyle}>{isBn ? 'শতকরা' : 'Percentage'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageData.map((item, idx) => {
                                    const late = item.late_days || 0;
                                    const pct = item.total_days > 0 ? Math.round(((item.present_days + late) / item.total_days) * 100) : 0;
                                    return (
                                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={tdStyle}>{item.roll || '-'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold' }}>{item.student_name}</td>
                                            <td style={tdStyle}>{item.total_days}</td>
                                            <td style={{ ...tdStyle, color: '#16a34a' }}>{item.present_days}</td>
                                            <td style={{ ...tdStyle, color: '#dc2626' }}>{item.absent_days}</td>
                                            <td style={{ ...tdStyle, color: '#d97706' }}>{late}</td>
                                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{pct}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Footer - Only on the last page or fixed at bottom */}
                        <div style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                            <div>.............................<br/>{isBn ? 'শিক্ষকের স্বাক্ষর' : 'Teacher Signature'}</div>
                            <div style={{ textAlign: 'center' }}>Page {pageIndex + 1} of {totalPages}</div>
                            <div style={{ textAlign: 'right' }}>.............................<br/>{isBn ? 'অধ্যক্ষের স্বাক্ষর' : 'Principal Signature'}</div>
                        </div>
                    </div>
                );
            })}
            
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap');
                div, th, td { font-family: 'Noto Sans Bengali', sans-serif; }
            `}</style>
        </>
    );
};

const thStyle: React.CSSProperties = {
    padding: '10px 8px',
    borderBottom: '2px solid #cbd5e1',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0f172a'
};

const tdStyle: React.CSSProperties = {
    padding: '8px',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'center',
    color: '#334155'
};
