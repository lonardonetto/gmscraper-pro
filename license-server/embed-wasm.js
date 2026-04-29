// Run this ONCE before pkg build: node embed-wasm.js
// It creates wasm-data.js containing the wasm as a base64 string
const fs = require('fs');
const path = require('path');
const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const b64 = fs.readFileSync(wasmPath).toString('base64');
const outPath = path.join(__dirname, 'wasm-data.js');
fs.writeFileSync(outPath, `module.exports = Buffer.from('${b64}', 'base64');\n`);
console.log('wasm-data.js written to', outPath, '| size:', b64.length, 'chars');
