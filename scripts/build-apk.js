#!/usr/bin/env node
/**
 * Self-contained Android APK build, scoped to services/app only.
 * No dependency on the root orchestrator (being removed).
 *
 * Usage: npm run build:apk [-- --release]
 */
const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const androidDir = path.join(appRoot, 'android');
const isWindows = process.platform === 'win32';
const release = process.argv.includes('--release');

function run(cmd, cwd = appRoot) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

run('npx ng build --configuration production');

if (!existsSync(androidDir)) {
  console.log('\nAndroid platform not found, adding it...');
  run('npx cap add android');
} else {
  run('npx cap copy android');
}

run('npx cap update android');

const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
const task = release ? 'assembleRelease' : 'assembleDebug';
run(`${gradlew} ${task}`, androidDir);

const variant = release ? 'release' : 'debug';
const apkPath = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  variant,
  `app-${variant}.apk`
);

console.log(`\nDone. APK should be at:\n${apkPath}`);
