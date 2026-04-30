const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Obfuscation configuration
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 1,
  debugProtection: true,
  debugProtectionInterval: 4000,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 1,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// Files to obfuscate
const filesToObfuscate = [
  'main.js',
  'preload.js'
];

function obfuscateFile(filePath) {
  try {
    console.log(`Obfuscating ${filePath}...`);
    
    const inputCode = fs.readFileSync(filePath, 'utf8');
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(inputCode, obfuscationOptions);
    
    // Create backup
    fs.writeFileSync(filePath + '.backup', inputCode);
    
    // Write obfuscated code
    fs.writeFileSync(filePath, obfuscatedCode.getObfuscatedCode());
    
    console.log(`Successfully obfuscated ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error obfuscating ${filePath}:`, error.message);
    return false;
  }
}

// Obfuscate all files
function obfuscateAll() {
  console.log('Starting code obfuscation for keygen...');
  
  let successCount = 0;
  filesToObfuscate.forEach(file => {
    if (obfuscateFile(file)) {
      successCount++;
    }
  });
  
  console.log(`Obfuscation complete: ${successCount}/${filesToObfuscate.length} files processed`);
}

// Restore original files
function restoreOriginal() {
  console.log('Restoring original files...');
  
  filesToObfuscate.forEach(file => {
    const backupFile = file + '.backup';
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, file);
      fs.unlinkSync(backupFile);
      console.log(`Restored ${file}`);
    }
  });
  
  console.log('All files restored');
}

// Command line interface
const command = process.argv[2];

if (command === 'obfuscate') {
  obfuscateAll();
} else if (command === 'restore') {
  restoreOriginal();
} else {
  console.log('Usage: node obfuscate.js [obfuscate|restore]');
  console.log('  obfuscate - Obfuscate all source files');
  console.log('  restore   - Restore original files from backups');
}
