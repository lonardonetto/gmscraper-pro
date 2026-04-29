/**
 * Obfuscate sensitive main-process files before packaging.
 * Run: node scripts/obfuscate.js
 */
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const TARGETS = [
  'src/main/license-manager.js',
  'src/main/scraper-engine.js'
];

const OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false
};

TARGETS.forEach(relPath => {
  const absPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(absPath)) {
    console.warn(`Skip (not found): ${relPath}`);
    return;
  }
  const source = fs.readFileSync(absPath, 'utf8');
  const obfuscated = JavaScriptObfuscator.obfuscate(source, OPTIONS).getObfuscatedCode();
  const outPath = absPath.replace('.js', '.obf.js');
  fs.writeFileSync(outPath, obfuscated);
  console.log(`✅ Obfuscated: ${relPath} → ${path.basename(outPath)}`);
});
