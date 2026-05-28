const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.css')) results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  if (file.endsWith('.tsx')) {
    // Replace fw={600} and fw={700} with fw={900} in Text tags for maximum bolding as requested
    content = content.replace(/fw=\{600\}/g, 'fw={800}');
    content = content.replace(/fw=\{700\}/g, 'fw={800}');
    content = content.replace(/fw=\{500\}/g, 'fw={800}'); // some empty state headings are 500
  } else if (file.endsWith('.css')) {
    // Replace font-weight: 600, 700 with 800
    content = content.replace(/font-weight:\s*600/g, 'font-weight: 800');
    content = content.replace(/font-weight:\s*700/g, 'font-weight: 800');
    content = content.replace(/font-weight:\s*500/g, 'font-weight: 800');
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
