import React from 'react';

interface StudentListTemplateProps {
    students: any[];
    madrasah: any;
    className?: string; // Optional if showing all classes
    lang: 'en' | 'bn';
}

export const StudentListTemplate: React.FC<StudentListTemplateProps> = ({ students, madrasah, className, lang }) => {
    const isBn = lang === 'bn';
    
    // Group students by class if className is not provided (all classes)
    const groupedStudents: { [key: string]: any[] } = {};
    if (!className) {
        students.forEach(s => {
            const clsObj = Array.isArray(s.classes) ? s.classes[0] : s.classes;
            const clsName = clsObj?.class_name || (isBn ? 'অন্যান্য' : 'Others');
            if (!groupedStudents[clsName]) groupedStudents[clsName] = [];
            groupedStudents[clsName].push(s);
        });
    } else {
        groupedStudents[className] = students;
    }

    // Helper to calculate approximate rendered row height based on text content length
    const estimateRowHeight = (item: any): number => {
        const getLines = (text: any, charsPerLine: number): number => {
            if (!text) return 1;
            const str = String(text).trim();
            if (!str || str === '-') return 1;
            const paragraphs = str.split(/\r?\n/);
            let count = 0;
            for (const p of paragraphs) {
                const pLen = p.trim().length;
                if (pLen === 0) continue;
                count += Math.max(1, Math.ceil(pLen / charsPerLine));
            }
            return count || 1;
        };

        const nameLines = getLines(item.student_name, 26);
        const regLines = getLines(item.registration_number || item.admission_number, 16);
        const fatherLines = getLines(item.guardian_name, 24);
        const motherLines = getLines(item.mother_name, 24);
        const phone1Lines = getLines(item.guardian_phone, 16);
        const phone2Lines = getLines(item.guardian_phone_2, 16);
        
        const otherLines = Math.max(1, nameLines, regLines, fatherLines, motherLines, phone1Lines, phone2Lines);
        const otherHeight = 20 + (otherLines - 1) * 12.5;

        // Address font size is reduced (8.5px) so more characters fit per line and line height is smaller
        const addressLines = getLines(item.address, 32);
        const addressHeight = 17 + (addressLines - 1) * 10;

        return Math.max(otherHeight, addressHeight);
    };

    // Dynamic height-based pagination to support exactly 16 rows per page comfortably
    const MAX_PAGE_ROW_HEIGHT = 550;
    const MAX_ROWS_PER_PAGE = 16;

    // Flatten to pages
    const pages: { title: string; data: any[] }[] = [];
    Object.entries(groupedStudents).forEach(([cls, classStudents]) => {
        // Sort students within class by roll
        const sorted = [...classStudents].sort((a, b) => {
            const rollA = typeof a.roll === 'string' ? parseInt(a.roll) || 0 : (a.roll || 0);
            const rollB = typeof b.roll === 'string' ? parseInt(b.roll) || 0 : (b.roll || 0);
            return rollA - rollB;
        });

        let currentPageData: any[] = [];
        let currentPageHeight = 0;

        sorted.forEach((student) => {
            const rowHeight = estimateRowHeight(student);

            if (
                currentPageData.length > 0 &&
                (currentPageHeight + rowHeight > MAX_PAGE_ROW_HEIGHT || currentPageData.length >= MAX_ROWS_PER_PAGE)
            ) {
                pages.push({
                    title: cls,
                    data: currentPageData
                });
                currentPageData = [student];
                currentPageHeight = rowHeight;
            } else {
                currentPageData.push(student);
                currentPageHeight += rowHeight;
            }
        });

        if (currentPageData.length > 0) {
            pages.push({
                title: cls,
                data: currentPageData
            });
        }
    });

    return (
        <>
            {pages.map((page, pageIndex) => {
                return (
                    <div key={pageIndex} className="pdf-page-container" style={{ width: '1123px', height: '794px', padding: '25px 35px', backgroundColor: '#fff', color: '#000', fontFamily: '"Inter", "Noto Sans Bengali", system-ui, sans-serif', position: 'relative', boxSizing: 'border-box' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '3px double #3b82f6', paddingBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '4px' }}>
                                {madrasah?.logo_url && (
                                    <img src={madrasah.logo_url} alt="Logo" style={{ width: '45px', height: '45px', objectFit: 'contain' }} crossOrigin="anonymous" />
                                )}
                                <h1 style={{ 
                                    fontSize: (madrasah?.name?.length || 0) > 60 ? '16px' : (madrasah?.name?.length || 0) > 45 ? '20px' : '24px', 
                                    fontWeight: '800', 
                                    margin: '0', 
                                    color: '#1e3a8a', 
                                    lineHeight: '1.2', 
                                    display: 'block'
                                }}>{madrasah?.name || 'Madrasah Name'}</h1>
                            </div>
                            <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0', color: '#1e40af', marginTop: '2px', letterSpacing: '0.5px' }}>
                                {isBn ? 'শিক্ষার্থী তালিকা (সকল তথ্য)' : 'Student Directory (Full Information)'}
                            </h2>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                                <span style={{ backgroundColor: '#f1f5f9', padding: '2px 12px', borderRadius: '20px' }}>
                                    {isBn ? 'শ্রেণী' : 'Class'}: <span style={{ color: '#2563eb' }}>{page.title}</span>
                                </span>
                            </div>
                        </div>

                        {/* Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', tableLayout: 'fixed', border: '1px solid #cbd5e1' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                                    <th style={{ ...thStyle, width: '4%' }}>{isBn ? 'রোল' : 'Roll'}</th>
                                    <th style={{ ...thStyle, width: '9%' }}>{isBn ? 'ভর্তি/রেজি নং' : 'Reg/Adm No'}</th>
                                    <th style={{ ...thStyle, textAlign: 'left', width: '15%' }}>{isBn ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                                    <th style={{ ...thStyle, width: '5%' }}>{isBn ? 'শাখা' : 'Sec'}</th>
                                    <th style={{ ...thStyle, textAlign: 'left', width: '13%' }}>{isBn ? 'পিতার নাম' : 'Father/Guardian'}</th>
                                    <th style={{ ...thStyle, textAlign: 'left', width: '13%' }}>{isBn ? 'মাতার নাম' : "Mother's Name"}</th>
                                    <th style={{ ...thStyle, width: '10%' }}>{isBn ? 'মোবাইল ১' : 'Mobile 1'}</th>
                                    <th style={{ ...thStyle, width: '10%' }}>{isBn ? 'মোবাইল ২' : 'Mobile 2'}</th>
                                    <th style={{ ...thStyle, width: '8%' }}>{isBn ? 'জন্ম তারিখ' : 'DOB'}</th>
                                    <th style={{ ...thStyle, width: '4%' }}>{isBn ? 'রক্ত' : 'Blood'}</th>
                                    <th style={{ ...thStyle, textAlign: 'left', width: '13%' }}>{isBn ? 'ঠিকানা' : 'Address'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((item, idx) => {
                                    return (
                                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc', pageBreakInside: 'avoid' }}>
                                            <td style={tdStyle}>{item.roll || '-'}</td>
                                            <td style={tdStyle}>{item.registration_number || item.admission_number || '-'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold', color: '#1e293b', wordBreak: 'break-word', overflow: 'visible' }}>{item.student_name}</td>
                                            <td style={tdStyle}>{item.section || '-'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', wordBreak: 'break-word' }}>{item.guardian_name || '-'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', wordBreak: 'break-word' }}>{item.mother_name || '-'}</td>
                                            <td style={{ ...tdStyle, fontWeight: '500' }}>{item.guardian_phone || '-'}</td>
                                            <td style={{ ...tdStyle, fontWeight: '500' }}>{item.guardian_phone_2 || '-'}</td>
                                            <td style={tdStyle}>{item.date_of_birth || '-'}</td>
                                            <td style={{ ...tdStyle, fontWeight: 'bold', color: '#dc2626' }}>{item.blood_group || '-'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', wordBreak: 'break-word', fontSize: '8.5px', lineHeight: '1.2' }}>{item.address || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Signature block on the right */}
                        <div style={{ 
                            position: 'absolute', 
                            bottom: '50px', 
                            right: '35px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'flex-end',
                            width: '160px'
                        }}>
                            <div style={{ 
                                height: '35px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                marginBottom: '4px' 
                            }}>
                                {madrasah?.config_json?.signature_url && (
                                    <img 
                                        src={madrasah.config_json.signature_url} 
                                        style={{ height: `${madrasah.config_json.signature_height || 35}px`, objectFit: 'contain' }} 
                                        alt="Signature" 
                                        crossOrigin="anonymous" 
                                    />
                                )}
                            </div>
                            <div style={{ 
                                width: '100%', 
                                borderTop: '1px solid #cbd5e1', 
                                textAlign: 'center', 
                                paddingTop: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#1e3a8a'
                            }}>
                                {isBn ? 'প্রতিষ্ঠান প্রধান' : 'Head of Institution'}
                            </div>
                        </div>

                        {/* Footer Bar */}
                        <div style={{ 
                            position: 'absolute', 
                            bottom: '20px', 
                            left: '35px', 
                            right: '35px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '11px', 
                            color: '#475569', 
                            fontWeight: '500', 
                            borderTop: '1px solid #e2e8f0', 
                            paddingTop: '8px' 
                        }}>
                            <div>{isBn ? 'ডাউনলোড তারিখ' : 'Download Date'}: {new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}</div>
                            <div>{isBn ? `পৃষ্ঠা ${pageIndex + 1} / ${pages.length}` : `Page ${pageIndex + 1} of ${pages.length}`}</div>
                        </div>
                    </div>
                );
            })}
            
            <style>{`
                .pdf-page-container, th, td { font-family: 'Noto Sans Bengali', "Inter", system-ui, sans-serif; }
            `}</style>
        </>
    );
};

const thStyle: React.CSSProperties = {
    padding: '5px 4px',
    borderBottom: '2px solid #cbd5e1',
    borderRight: '1px solid rgba(255,255,255,0.15)',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: '11px',
    color: '#ffffff',
    whiteSpace: 'nowrap'
};

const tdStyle: React.CSSProperties = {
    padding: '3px 5px',
    borderBottom: '1px solid #cbd5e1',
    borderRight: '1px solid #e2e8f0',
    textAlign: 'center',
    color: '#334155',
    verticalAlign: 'middle',
    lineHeight: '1.25'
};
