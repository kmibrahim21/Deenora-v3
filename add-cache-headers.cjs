const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'api');
const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
    const filePath = path.join(apiDir, file);
    let data = fs.readFileSync(filePath, 'utf8');
    
    // Only add to GET handlers, but wait, some are just single handlers.
    // Let's add it right after Access-Control headers
    if (!data.includes('Cache-Control')) {
        // Find line with Access-Control-Allow-Methods
        if (data.includes('Access-Control-Allow-Methods')) {
             if (file !== 'auth.ts') {
                 data = data.replace(/res\.setHeader\('Access-Control-Allow-Methods',.*/g, 
                     match => `${match}\n  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');`);
                 fs.writeFileSync(filePath, data, 'utf8');
                 console.log(`Added Cache-Control to ${file}`);
             }
        }
    }
});
