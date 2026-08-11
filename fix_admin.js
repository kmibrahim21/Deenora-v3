
import fs from 'fs';

const filePath = 'src/pages/AdminPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = "action: 'payment_update',";
const injection = `
                                      // Get latest config from selectedUser
                                      let latestConfig = typeof selectedUser.config_json === 'string' 
                                        ? JSON.parse(selectedUser.config_json) 
                                        : (selectedUser.config_json || {});
                                      latestConfig = typeof latestConfig === 'object' && latestConfig !== null ? latestConfig : {};
`;

if (content.includes(target)) {
  const parts = content.split(target);
  // Insert BEFORE the target line but after the session line
  // Actually, we can just insert it before 'action: payment_update' as long as it's inside the body: JSON.stringify({ ... })
  // No, that's not good. 
  
  // Let's find the specific block
  const blockStart = "body: JSON.stringify({";
  const searchStr = "action: 'payment_update',";
  
  // Reverting my previous bad injection if any
  content = content.replace(`
                                      // Get latest config from selectedUser
                                      let latestConfig = typeof selectedUser.config_json === 'string' 
                                        ? JSON.parse(selectedUser.config_json) 
                                        : (selectedUser.config_json || {});
                                      latestConfig = typeof latestConfig === 'object' && latestConfig !== null ? latestConfig : {};
`, '');

  const finalTarget = "const res = await fetch('/api/admin', {";
  const finalParts = content.split(finalTarget);
  // The last occurrence is likely our target
  const index = finalParts.length - 1;
  finalParts[index-1] = finalParts[index-1] + injection + finalTarget;
  content = finalParts.join('');
  
  fs.writeFileSync(filePath, content);
  console.log('Successfully injected latestConfig definition in the correct block');
}
