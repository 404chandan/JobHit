const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Starting JobHit Desktop Application Packager ===');

const desktopAppDir = path.join(__dirname, 'desktop-app');
const webPortalDir = path.join(__dirname, 'web-portal');
const downloadsDir = path.join(webPortalDir, 'backend', 'downloads');
const tempPackageDir = path.join(__dirname, 'temp-package');

// 1. Ensure downloads directory exists in web-portal
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// 2. Build desktop frontend
console.log('\n--- Building Desktop Frontend ---');
try {
  execSync('npm run build', {
    cwd: path.join(desktopAppDir, 'frontend'),
    stdio: 'inherit'
  });
} catch (e) {
  console.error('Failed to compile desktop frontend. Packaging aborted.');
  process.exit(1);
}

// 3. Re-generate Prisma Client in desktop backend
console.log('\n--- Generating Prisma Client ---');
try {
  execSync('npx prisma generate', {
    cwd: path.join(desktopAppDir, 'backend'),
    stdio: 'inherit'
  });
} catch (e) {
  console.error('Warning: Failed to run npx prisma generate.');
}

// 4. Create clean temp directory for zipping
console.log('\n--- Creating Clean Temporary Package Directory ---');
if (fs.existsSync(tempPackageDir)) {
  fs.rmSync(tempPackageDir, { recursive: true, force: true });
}
fs.mkdirSync(tempPackageDir);

// 5. Use robocopy to copy desktop-app source files while excluding node_modules/dist/env
console.log('Copying files...');
try {
  // Robocopy returns various exit codes; on Windows it is highly robust.
  execSync(`robocopy "${desktopAppDir}" "${tempPackageDir}" /xd node_modules dist .git .prisma screenshots uploads /xf .env .env.local .env.development /e`, {
    stdio: 'ignore'
  });
} catch (e) {
  // robocopy exit code <= 7 is considered success.
}

// 6. Zip the temporary directory using PowerShell Compress-Archive
console.log('\n--- Compressing Archive to desktop-app.zip ---');
const zipFile = path.join(downloadsDir, 'desktop-app.zip');
try {
  execSync(`powershell -Command "Compress-Archive -Path '${tempPackageDir}\\*' -DestinationPath '${zipFile}' -Force"`, {
    stdio: 'inherit'
  });
  console.log(`\nSUCCESS: Packaged desktop application to: ${zipFile}`);
} catch (e) {
  console.error('Failed to compress ZIP archive using PowerShell.', e);
  process.exit(1);
}

// 7. Cleanup temp package directory
console.log('\n--- Cleaning up temporary files ---');
try {
  fs.rmSync(tempPackageDir, { recursive: true, force: true });
  console.log('Cleanup completed.');
} catch (e) {
  console.warn('Warning: Failed to delete temporary directory.', e);
}

console.log('\nPackaging complete!');
