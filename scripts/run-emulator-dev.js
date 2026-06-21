#!/usr/bin/env node
/**
 * Launch the app on a running/auto-started Android emulator with live reload:
 * `cap run -l` starts `ng serve` itself and points the WebView at it (via
 * `10.0.2.2`, the address the Android emulator uses to reach the host
 * machine's `localhost`), so edits under `src/` show up without a
 * build/copy/install cycle. Self-contained, scoped to services/app only.
 *
 * Usage: npm run emulator:dev
 */
const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const androidDir = path.join(appRoot, 'android');

function run(cmd, cwd = appRoot) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

if (!existsSync(androidDir)) {
  console.log('\nAndroid platform not found, adding it...');
  run('npx ng build');
  run('npx cap add android');
}

// `cap run` prompts interactively to pick a target whenever it finds more
// than one (which on this machine includes every *configured* AVD, not
// just running ones) -- that prompt hangs non-interactive shells/CI. With
// exactly one device already booted (the common case), passing its adb
// serial as --target skips the prompt; with zero or several running
// devices, fall back to the interactive prompt so the user can choose/boot
// one themselves.
function getRunningDeviceSerial() {
  const output = execSync('adb devices').toString();
  const serials = output
    .split('\n')
    .slice(1)
    .map((line) => line.split('\t')[0].trim())
    .filter((serial) => serial.length > 0);
  return serials.length === 1 ? serials[0] : undefined;
}

const target = getRunningDeviceSerial();
const targetFlag = target ? ` --target=${target}` : '';

run(`npx cap run android -l --host=10.0.2.2${targetFlag}`);
