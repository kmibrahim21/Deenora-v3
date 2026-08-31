export const normalizePhone = (phone: string | undefined | null): string => {
  if (!phone) return '';
  let p = phone.replace(/[^0-9]/g, '');
  if (p.startsWith('01')) return '88' + p;
  if (p.startsWith('1')) return '880' + p;
  return p;
};

export const getSmsLengthInfo = (message: string) => {
  // Normalize CRLF (\r\n) and CR (\r) to standard LF (\n) line endings
  const normalized = (message || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const isBangla = /[^\x00-\x7F]/.test(normalized);
  const len = normalized.length;
  
  if (len === 0) return { parts: 0, length: 0, maxAllowed: isBangla ? 70 : 160, isBangla };

  let parts = 1;
  let maxAllowed = isBangla ? 70 : 160;

  if (isBangla) {
    if (len > 70) {
      parts = Math.ceil(len / 67);
      maxAllowed = parts * 67;
    }
  } else {
    if (len > 160) {
      parts = Math.ceil(len / 153);
      maxAllowed = parts * 153;
    }
  }

  return { parts, length: len, maxAllowed, isBangla };
};
