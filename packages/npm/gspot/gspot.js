#!/usr/bin/env node
// The launcher: runs the platform package that installed for this machine.
'use strict';

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { familySync } = require('detect-libc');
const targets = require('./targets.json');

const libc = process.platform === 'linux' ? familySync() : null;
const target = targets.find(
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Array.find requires a predicate for platform selection.
    (candidate) => candidate.os === process.platform && candidate.cpu === process.arch && candidate.libc === libc,
);
if (!target) {
    process.stderr.write(`gspot has no build for ${process.platform} ${process.arch} ${libc ?? 'unknown libc'}.\n`);
    process.exit(2);
}
const platformPackage = target.package;
const binaryName = process.platform === 'win32' ? 'gspot.exe' : 'gspot';

let binary;
try {
    binary = join(require.resolve(`${platformPackage}/package.json`), '..', binaryName);
} catch {
    binary = undefined;
}

if (!binary || !existsSync(binary)) {
    process.stderr.write(
        `gspot has no build for ${process.platform} ${process.arch} in this install (${platformPackage} is not installed).\n` +
            'Install it with your package manager, or take the binary from the release page: https://github.com/stefanionescu/gspot/releases\n',
    );
    process.exit(2);
}

const child = spawn(binary, process.argv.slice(2), { stdio: 'inherit' });
/** @type {NodeJS.Signals[]} */
const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
/**
 * Forward the received signal to the child process.
 * @param {NodeJS.Signals} signal The process signal received by the launcher.
 * @returns Whether the signal was sent to the child process.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Signal listeners need a stable callback identity for removal after child exit.
const forward = (signal) => child.kill(signal);
for (const signal of signals) process.on(signal, forward);
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The child process emits startup failures through an error listener.
child.on('error', (error) => {
    process.stderr.write(`gspot could not start: ${error.message}\n`);
    process.exit(2);
});
child.on('close', (code, signal) => {
    for (const forwarded of signals) process.removeListener(forwarded, forward);
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
});
