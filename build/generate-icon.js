// Simple icon generator for GitHub Actions builds
const fs = require('fs');
const path = require('path');

// Create a minimal ICO file (Windows icon)
function createMinimalIcon() {
  // This is a minimal valid ICO file structure
  const icoHeader = Buffer.from([
    0x00, 0x00, // Reserved
    0x01, 0x00, // ICO type
    0x01, 0x00, // Number of images
    0x10,       // Width (16px)
    0x10,       // Height (16px)
    0x00,       // Colors
    0x00,       // Reserved
    0x01, 0x00, // Color planes
    0x20, 0x00, // Bits per pixel
    0x40, 0x00, 0x00, 0x00, // Image size
    0x16, 0x00, 0x00, 0x00, // Image offset
    // Minimal BMP header for 16x16 32bpp
    0x28, 0x00, 0x00, 0x00, // BMP header size
    0x10, 0x00, 0x00, 0x00, // Width
    0x20, 0x00, 0x00, 0x00, // Height (double for XOR+AND)
    0x01, 0x00,             // Planes
    0x20, 0x00,             // Bits per pixel
    0x00, 0x00, 0x00, 0x00, // Compression
    0x00, 0x04, 0x00, 0x00, // Image size
    0x00, 0x00, 0x00, 0x00, // X pixels per meter
    0x00, 0x00, 0x00, 0x00, // Y pixels per meter
    0x00, 0x00, 0x00, 0x00, // Colors used
    0x00, 0x00, 0x00, 0x00  // Important colors
  ]);
  
  // Add some pixel data (transparent blue square)
  const pixelData = Buffer.alloc(1024); // 16x16 * 4 bytes per pixel
  for (let i = 0; i < pixelData.length; i += 4) {
    pixelData[i] = 0x00;     // B
    pixelData[i + 1] = 0x00; // G  
    pixelData[i + 2] = 0xFF; // R
    pixelData[i + 3] = 0x80; // Alpha (semi-transparent)
  }
  
  return Buffer.concat([icoHeader, pixelData]);
}

// Create the icon files
try {
  const iconData = createMinimalIcon();
  
  // Write ICO file
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), iconData);
  
  // Write a simple PNG file (minimal valid PNG)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x10, // Width: 16
    0x00, 0x00, 0x00, 0x10, // Height: 16
    0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
    0x1F, 0x15, 0xC4, 0x89, // CRC
    0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9C, 0x62, 0x00, 0x02, 0x00, 0x00, 0x05, 0x00, 0x01, // Compressed data
    0x0D, 0x0A, 0x2D, 0xB4, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  fs.writeFileSync(path.join(__dirname, 'icon.png'), pngHeader);
  
  console.log('Icons generated successfully');
} catch (error) {
  console.error('Error generating icons:', error);
  process.exit(1);
}
