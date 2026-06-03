const fs = require('fs');

function checkTags(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let line = 1;
  let ch = 0;
  
  const stack = [];
  
  const regex = /<\/?([a-zA-Z0-9_.-]+)(?:[^>]*?)(\/?)>/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const isClosing = match[0].startsWith('</');
    const isSelfClosing = match[2] === '/';
    const tagName = match[1];

    // ignore void elements, etc., but React generally doesn't have them implicitly except for html standard
    const voidElements = ['br', 'img', 'input', 'hr', 'meta', 'link'];
    if (voidElements.includes(tagName) || isSelfClosing) {
      continue;
    }

    if (isClosing) {
      if (stack.length === 0) {
        console.log(`Unmatched closing tag </${tagName}> at index ${match.index}`);
      } else {
        const top = stack.pop();
        if (top.tag !== tagName && top.tag !== 'React.Fragment' && tagName !== 'React.Fragment') {
          console.log(`Mismatched tags: expected </${top.tag}> but found </${tagName}> at index ${match.index}`);
          console.log(`  Opened at index ${top.index}`);
        }
      }
    } else {
      stack.push({ tag: tagName, index: match.index });
    }
  }

  if (stack.length > 0) {
    console.log('Unclosed tags remaining:');
    stack.forEach(item => {
      console.log(`  <${item.tag}> opened at index ${item.index}`);
    });
  } else {
    console.log('All tags are perfectly balanced!');
  }
}

checkTags('src/components/results/engines/school/SchoolResultEngine.tsx');
