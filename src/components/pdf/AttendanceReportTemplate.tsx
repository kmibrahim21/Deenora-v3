import React from 'react';

interface AttendanceReportTemplateProps {
    reportData: any[];
    madrasah: any;
    className: string;
    month?: string; // e.g. "April 2026"
    lang: 'en' | 'bn';
    arefRuqaaFontBase64?: string | null;
    amiriFontBase64?: string | null;
    uthmanTahaFontBase64?: string | null;
    arabicCalligraphyBase64?: string | null;
}

export const AttendanceReportTemplate: React.FC<AttendanceReportTemplateProps> = ({ 
    reportData, 
    madrasah, 
    className, 
    month, 
    lang,
    arefRuqaaFontBase64,
    amiriFontBase64,
    uthmanTahaFontBase64,
    arabicCalligraphyBase64
}) => {
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

    const ROWS_PER_PAGE = 26;
    const totalPages = Math.ceil(calculatedData.length / ROWS_PER_PAGE) || 1;

    return (
        <>
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
                const pageData = calculatedData.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
                
                return (
                    <div key={pageIndex} className="page-container" style={{ width: '794px', height: '1123px', padding: '40px', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', position: 'relative', boxSizing: 'border-box' }}>
                        {/* Header Banner - Matching Reference Image Style (Borderless Adjustments) */}
                        <div style={{
                            width: '100%',
                            padding: '10px 0 15px 0',
                            backgroundColor: '#ffffff',
                            marginBottom: '15px',
                            borderBottom: '2.5px solid #0c4a7e',
                            position: 'relative',
                            height: '140px', 
                            boxSizing: 'border-box'
                        }}>
                            {/* Ornamental Corner Pieces */}
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '3px solid #0c4a7e', borderLeft: '3px solid #0c4a7e' }}></div>
                            <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '3px solid #0c4a7e', borderRight: '3px solid #0c4a7e' }}></div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', padding: '0 10px' }}>
                                
                                {/* 1. Logo on the Left - Slightly smaller to give more space to calligraphy */}
                                {madrasah?.logo_url && (
                                    <div style={{ flexShrink: 0 }}>
                                        <img src={madrasah.logo_url} alt="Logo" style={{ width: '85px', height: '85px', borderRadius: '10px', border: '1.5px solid #0c4a7e', padding: '2px', objectFit: 'contain', backgroundColor: '#fff' }} crossOrigin="anonymous" />
                                    </div>
                                )}

                                {/* 2. Content Column (Calligraphy + Names) */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1, minWidth: 0, height: '100%', justifyContent: 'center' }}>
                                    
                                    {/* Arabic Calligraphy - Only for Madrasah */}
                                    {madrasah?.institution_type === 'madrasah' && arabicCalligraphyBase64 ? (
                                        <div style={{ height: '85px', width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '0px' }}>
                                            <img 
                                                src={`data:image/webp;base64,${arabicCalligraphyBase64}`} 
                                                alt="Calligraphy" 
                                                style={{ 
                                                    height: '100%', 
                                                    width: `${madrasah?.config_json?.arabic_calligraphy_width || 100}%`, 
                                                    objectFit: 'contain' 
                                                }} 
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                    ) : null}

                                    {/* Institution Names */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: madrasah?.institution_type === 'madrasah' ? '10px' : '15px',
                                        width: '100%',
                                        marginTop: madrasah?.institution_type === 'madrasah' ? '0px' : '5px'
                                    }}>
                                        {/* Primary Name (Bengali) */}
                                        <span style={{ 
                                            fontSize: madrasah?.institution_type === 'madrasah' ? '26px' : '38px', 
                                            fontWeight: '900', 
                                            color: '#0c4a7e',
                                            fontFamily: "'Tiro Bangla', 'Noto Serif Bengali', serif",
                                            lineHeight: '1',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {madrasah?.name || 'Institution Name'}
                                        </span>

                                        {/* Elegant Divider (Optional for School if English name exists) */}
                                        {(madrasah?.name && (madrasah?.config_json as any)?.name_english) && (
                                            <div style={{ 
                                                width: madrasah?.institution_type === 'madrasah' ? '1px' : '1.5px', 
                                                height: madrasah?.institution_type === 'madrasah' ? '16px' : '22px', 
                                                backgroundColor: '#cbd5e1' 
                                            }}></div>
                                        )}

                                        {/* English Name */}
                                        {(madrasah?.config_json as any)?.name_english && (
                                            <span style={{ 
                                                fontSize: madrasah?.institution_type === 'madrasah' ? '14px' : '18px', 
                                                fontWeight: '700', 
                                                color: '#475569', 
                                                fontFamily: "'Times New Roman', Times, serif",
                                                letterSpacing: '0.04em',
                                                textTransform: 'uppercase',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(madrasah.config_json as any).name_english}
                                            </span>
                                        )}
                                    </div>

                                    {/* 3. Contact Details */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '15px',
                                        fontSize: madrasah?.institution_type === 'madrasah' ? '11px' : '13px',
                                        color: '#64748b',
                                        fontWeight: '700',
                                        marginTop: madrasah?.institution_type === 'madrasah' ? '4px' : '10px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <span style={{ color: '#0c4a7e', fontSize: '10px' }}>●</span>
                                            <span>{madrasah?.address || ''}</span>
                                        </div>
                                        {madrasah?.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <span style={{ color: '#0c4a7e', fontSize: '10px' }}>●</span>
                                                <span>{madrasah.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Title & Metadata Details */}
                        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0', color: '#1e40af' }}>
                                {isBn ? 'হাজিরা রিপোর্ট' : 'Attendance Report'}
                            </h2>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '14px', fontWeight: 'bold', color: '#475569', borderBottom: '1px dashed #cbd5e1', paddingBottom: '10px' }}>
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

                        {/* Footer - Fixed at bottom */}
                        <div style={{ 
                            position: 'absolute', 
                            bottom: '40px', 
                            left: '50px', 
                            right: '50px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-end' 
                        }}>
                            {/* Teacher Signature */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderTop: '1px solid #1e293b', width: '150px', marginBottom: '8px' }}></div>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}>
                                    {isBn ? 'শ্রেণি শিক্ষকের স্বাক্ষর' : 'Teacher Signature'}
                                </div>
                            </div>
                            
                            {/* Page Indicator */}
                            <div style={{ fontSize: '10px', color: '#94a3b8', paddingBottom: '2px' }}>
                                Page {pageIndex + 1} of {totalPages}
                            </div>
                            
                            {/* Principal Signature */}
                            <div style={{ textAlign: 'center', position: 'relative' }}>
                                <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', position: 'relative' }}>
                                    {madrasah?.config_json?.signature_url && (
                                        <img 
                                            src={madrasah.config_json.signature_url} 
                                            alt="Sig" 
                                            style={{ height: '100%', objectFit: 'contain', position: 'absolute', bottom: '0' }} 
                                            crossOrigin="anonymous" 
                                        />
                                    )}
                                    <div style={{ borderTop: '1px solid #1e293b', width: '150px', position: 'absolute', bottom: '-8px' }}></div>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b', marginTop: '12px' }}>
                                    {isBn ? 'অধ্যক্ষের স্বাক্ষর' : 'Principal Signature'}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            
            <style>{`
                ${uthmanTahaFontBase64 ? `
                @font-face {
                    font-family: 'KFGQPC Uthman Taha Naskh';
                    src: url('data:font/ttf;base64,${uthmanTahaFontBase64}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'KFGQPC_Uthmanic_Script_HAFS_Regular';
                    src: url('data:font/ttf;base64,${uthmanTahaFontBase64}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'KFGQPC Uthmanic Script HAFS Regular';
                    src: url('data:font/ttf;base64,${uthmanTahaFontBase64}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'Scheherazade New';
                    src: url('data:font/ttf;base64,${uthmanTahaFontBase64}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'Noto Naskh Arabic';
                    src: url('data:font/ttf;base64,${uthmanTahaFontBase64}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                ` : `
                @font-face {
                    font-family: 'KFGQPC Uthman Taha Naskh';
                    src: url('https://fonts.gstatic.com/l/font?kit=4UaZrFhTvxVnHDvUkUiHg8jprP4DCwI&skey=dedc87abea7dfb07&v=v21') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'KFGQPC_Uthmanic_Script_HAFS_Regular';
                    src: url('https://fonts.gstatic.com/l/font?kit=RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krQ&skey=bacb52bf696c6ae6&v=v44') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'KFGQPC Uthmanic Script HAFS Regular';
                    src: url('https://fonts.gstatic.com/l/font?kit=RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krQ&skey=bacb52bf696c6ae6&v=v44') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'Scheherazade New';
                    src: url('https://fonts.gstatic.com/l/font?kit=4UaZrFhTvxVnHDvUkUiHg8jprP4DCwI&skey=dedc87abea7dfb07&v=v21') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'Noto Naskh Arabic';
                    src: url('https://fonts.gstatic.com/l/font?kit=RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krQ&skey=bacb52bf696c6ae6&v=v44') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                `}

                ${arefRuqaaFontBase64 ? `
                @font-face {
                    font-family: 'Aref Ruqaa Calligraphy';
                    src: url('data:font/ttf;base64,${arefRuqaaFontBase64}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                ` : `@import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&display=swap');`}

                ${amiriFontBase64 ? `
                @font-face {
                    font-family: 'Amiri Calligraphy';
                    src: url('data:font/ttf;base64,${amiriFontBase64}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                ` : `@import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap');`}

                @import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@400;500;600;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Lateef:wght@200;300;400;500;600;700;800&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Tiro+Bangla&family=Noto+Serif+Bengali:wght@400;700;900&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;700;900&display=swap');
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
    padding: '4.5px 4px',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'center',
    color: '#334155'
};
