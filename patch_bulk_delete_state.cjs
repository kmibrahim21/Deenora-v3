const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

if (!code.includes('bulkDeleteTab')) {
    code = code.replace(
        /const \[rejectConfirm, setRejectConfirm\] = useState<Transaction \| null>\(null\);/,
        `const [rejectConfirm, setRejectConfirm] = useState<Transaction | null>(null);
  const [bulkDeleteTab, setBulkDeleteTab] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);`
    );
}

fs.writeFileSync('src/pages/AdminPanel.tsx', code);
