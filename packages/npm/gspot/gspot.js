#!/usr/bin/env node
// The launcher: runs the platform package that installed for this machine.
'use strict';

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const platformPackage = `@gspot/cli-${process.platform}-${process.arch}`;
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

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
    process.stderr.write(`gspot could not start: ${result.error.message}\n`);
    process.exit(2);
}
process.exit(result.status ?? 1);
