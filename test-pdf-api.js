const html = `<html><head><style>body{background:red;}</style></head><body><h1>Hello</h1></body></html>`;
fetch('http://localhost:3000/api/pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html })
}).then(res => res.arrayBuffer()).then(buf => {
  console.log("PDF generated! Length:", buf.byteLength);
}).catch(err => console.error(err));
