#!/usr/bin/env node
/**
 * Build the web app and launch it on a running/auto-started Android emulator.
 * Self-contained, scoped to services/app only (no root orchestrator dependency).
 *
 * Usage: npm run emulator
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

run('npx ng build');

if (!existsSync(androidDir)) {
  console.log('\nAndroid platform not found, adding it...');
  run('npx cap add android');
} else {
  run('npx cap copy android');
}

run('npx cap update android');

// `cap run` boots an existing/avd-default emulator if none is running, then
// installs and launches the app on it. If multiple targets are connected, it
// prompts to pick one.
run('npx cap run android');
