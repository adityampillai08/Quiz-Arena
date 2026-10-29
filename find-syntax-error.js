// find-syntax-error.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = getAllJsFiles(path.join(__dirname, 'js'));

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    new vm.SourceTextModule(code, { initializeImportMeta() {} });
    console.log('OK:', path.relative(__dirname, file));
  } catch (err) {
    console.error('SYNTAX ERROR IN:', path.relative(__dirname, file));
    console.error(err);
  }
}
