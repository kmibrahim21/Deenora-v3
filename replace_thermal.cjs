const fs = require('fs');
let code = fs.readFileSync('src/components/pdf/FeeReceiptTemplate.tsx', 'utf-8');

const targetStr = `  if (isThermal) {
    return (
      <div 
        className={\`box-border p-1 bg-white flex flex-col gap-1 \${isBangla ? 'font-noto' : 'font-hind'}\`}
        style={{ width: paperSize === '58mm' ? '219px' : '302px' }}
      >
        <ReceiptContent copyType={t.studentCopy} isThermalLayout={true} />
      </div>
    );
  }`;

const replacementStr = `  if (isThermal) {
    const paperWidthPx = paperSize === '58mm' ? '219px' : '302px';
    const textBaseClass = paperSize === '58mm' ? 'text-[10px]' : 'text-[12px]';
    const textSmClass = paperSize === '58mm' ? 'text-[8px]' : 'text-[10px]';
    const textLgClass = paperSize === '58mm' ? 'text-[12px]' : 'text-[14px]';
    const feeItems = student.fee_items || [
      { name: t.monthlyFees, amount: Number(student.total_payable) }
    ];

    return (
      <div 
        className={\`box-border bg-white flex flex-col p-2 text-black \${isBangla ? 'font-noto' : 'font-hind'}\`}
        style={{ width: paperWidthPx }}
      >
        <div className="flex flex-col items-center justify-center mb-2 border-b border-dashed border-black pb-2 text-center">
          {madrasah.logo_url && (
            <img src={madrasah.logo_url} alt="Logo" className="h-8 w-8 object-contain mb-1 grayscale" crossOrigin="anonymous" />
          )}
          <h1 className={\`\${textLgClass} font-black leading-tight break-words whitespace-normal\`}>{madrasah.name}</h1>
          {madrasah.address && <p className={\`\${textSmClass} font-bold mt-0.5 break-words whitespace-normal\`}>{madrasah.address}</p>}
        </div>

        <div className="flex justify-center mb-2">
           <h2 className={\`\${textSmClass} font-black tracking-wider uppercase\`}>{t.title}</h2>
        </div>

        <div className="flex flex-col gap-0.5 mb-2 border-b border-dashed border-black pb-2">
          <div className="flex justify-between">
            <span className={\`\${textSmClass} font-bold\`}>{t.receiptNo}: {receiptId}</span>
            <span className={\`\${textSmClass} font-bold\`}>{new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US')}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className={\`\${textSmClass} font-black truncate max-w-[60%]\`}>{t.name}: {student.student_name}</span>
            <span className={\`\${textSmClass} font-bold\`}>{t.roll}: {student.roll || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className={\`\${textSmClass} font-bold truncate max-w-[60%]\`}>{t.class}: {student.class_name || student.classes?.class_name || '-'}</span>
            <span className={\`\${textSmClass} font-bold\`}>{t.month}: {month}</span>
          </div>
        </div>

        <table className="w-full mb-2">
          <thead>
            <tr className="border-b border-dashed border-black">
              <th className={\`py-1 text-left \${textSmClass} font-black\`}>{t.description}</th>
              <th className={\`py-1 text-right \${textSmClass} font-black\`}>{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {feeItems.map((item: any, idx: number) => (
              <tr key={idx}>
                <td className={\`py-0.5 pr-1 \${textBaseClass} font-bold leading-tight align-top break-words whitespace-normal\`}>{item.name}</td>
                <td className={\`py-0.5 pl-1 text-right \${textBaseClass} font-bold leading-tight align-top whitespace-nowrap\`}>{Number(item.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col gap-0.5 border-t border-dashed border-black pt-1 mb-4">
          {Number(student.discount) > 0 && (
            <div className="flex justify-between">
              <span className={\`\${textSmClass} font-bold\`}>{t.discount}</span>
              <span className={\`\${textSmClass} font-bold\`}>-{Number(student.discount).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className={\`\${textBaseClass} font-black\`}>{t.totalPaid}</span>
            <span className={\`\${textBaseClass} font-black\`}>{t.currency} {Number(student.total_paid).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-black pt-0.5 mt-0.5">
            <span className={\`\${textBaseClass} font-black\`}>{t.balanceDue}</span>
            <span className={\`\${textBaseClass} font-black\`}>{t.currency} {Math.max(0, Number(student.balance_due)).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center mt-2 border-t border-dashed border-black pt-2">
          <p className={\`\${textSmClass} font-black uppercase text-center\`}>Thank You</p>
          <p className="text-[6px] font-bold text-center mt-1 uppercase tracking-widest">{madrasah.name}</p>
        </div>
      </div>
    );
  }`;

if (code.includes(targetStr)) {
  fs.writeFileSync('src/components/pdf/FeeReceiptTemplate.tsx', code.replace(targetStr, replacementStr));
  console.log('Replaced successfully');
} else {
  console.log('Target string not found');
}
