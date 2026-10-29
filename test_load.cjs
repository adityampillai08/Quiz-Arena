// Node.js CommonJS verification - use require with .js extension
try {
  const scoring = require('./js/core/scoring.js');
  console.log('Scoring module loaded successfully');
  console.log('Exports:', Object.keys(scoring));
} catch(e) {
  console.log('Error loading scoring module:', e.message);
}