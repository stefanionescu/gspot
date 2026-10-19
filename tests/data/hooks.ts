/** The stubs that Husky 9 writes in .husky/_/, the folder that core.hooksPath names. */
export const HUSKY_STUBS = {
    '.husky/_/.gitignore': '*\n',
    '.husky/_/h': '#!/usr/bin/env sh\n',
    '.husky/_/pre-commit': '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n',
};

/** The authored hook managers and the local Git hook script that init must keep. */
export const HOOK_REPOSITORIES = [
    {
        name: 'another hooks folder',
        startProgram: 'mise',
        files: { '.githooks/pre-commit': '#!/bin/sh\n' },
        setting: ['config', 'core.hooksPath', '.githooks'],
        gitHook: false,
    },
    {
        name: 'a Husky folder',
        startProgram: 'npm',
        files: {
            'package.json':
                '{"private":true,"packageManager":"npm@11.10.1","devDependencies":{"@gspothq/cli":"0.1.0"}}',
            '.husky/pre-commit': 'npm test\n',
        },
        setting: undefined,
        gitHook: false,
    },
    {
        name: 'a Husky 9 folder',
        startProgram: 'npm',
        files: {
            'package.json':
                '{"private":true,"packageManager":"npm@11.10.1","devDependencies":{"@gspothq/cli":"0.1.0"}}',
            '.husky/pre-commit': 'npm test\n',
            ...HUSKY_STUBS,
        },
        setting: ['config', 'core.hooksPath', '.husky/_'],
        gitHook: false,
    },
    {
        name: 'a Lefthook configuration',
        startProgram: 'npm',
        settings: `[[ignore]]
check = "files/yamllint"
paths = ["lefthook.yml"]
reason = "This unit checks hook preservation and the instructions for the existing hook provider."
`,
        files: {
            'package.json':
                '{"private":true,"packageManager":"npm@11.10.1","devDependencies":{"@gspothq/cli":"0.1.0"}}',
            'lefthook.yml': 'pre-commit:\n',
        },
        setting: undefined,
        gitHook: false,
    },
    {
        name: 'a script in the Git hooks folder',
        startProgram: 'npm',
        files: {
            'package.json':
                '{"private":true,"packageManager":"npm@11.10.1","devDependencies":{"@gspothq/cli":"0.1.0"}}',
        },
        setting: undefined,
        gitHook: true,
    },
] as const;

export const START_COMMANDS = [
    ['npm', 'npm@11.10.1', ['exec', '--no', '--', 'gspot']],
    ['pnpm', 'pnpm@10.32.1', ['exec', 'gspot']],
    ['yarn', 'yarn@4.13.0', ['exec', 'gspot']],
    ['bun', 'bun@1.4.2', ['run', '--no-install', 'gspot']],
    ['mise', undefined, ['exec', '--', 'gspot']],
] as const;

export const HOOK_LEVEL_CASES = [
    { level: 'recommended', hooks: ['pre-commit', 'pre-push'] },
    { level: 'all', hooks: ['commit-msg', 'pre-commit', 'pre-push'] },
] as const;

export const HOOK_CASES = [
    ['pre-commit', []],
    ['pre-push', ['origin', 'https://example.com/repository.git']],
    ['commit-msg', ['message']],
] as const;

export const HOOK_PROGRAM = `console.log(JSON.stringify({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    hook: process.env.GSPOT_HOOK ?? null,
}));
`;

/** A fake git-lfs or mise that logs its name, arguments, and standard input. */
export const LOGGING_PROGRAM = String.raw`const fs = require('node:fs');
const name = require('node:path').basename(process.argv[1], '.js');
const input = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.CALLS_LOG, JSON.stringify({ name, argv: process.argv.slice(2), input }) + '\n');
`;

/** The pre-push hook that git lfs install writes today. */
export const STOCK_LFS_PRE_PUSH = String.raw`#!/bin/sh
command -v git-lfs >/dev/null 2>&1 || { printf >&2 "\n%s\n\n" "This repository is configured for Git LFS but 'git-lfs' was not found on your path. If you no longer wish to use Git LFS, remove this hook by deleting the 'pre-push' file in the hooks directory (set by 'core.hookspath'; usually '.git/hooks')."; exit 2; }
git lfs pre-push "$@"
`;

export const LFS_ATTRIBUTES = '*.bin filter=lfs diff=lfs merge=lfs -text\n';

export const SAMPLE_COMMAND =
    'const found = process.argv.slice(1).filter((path) => require("node:fs").readFileSync(path, "utf8").includes("DEFECT")); found.forEach((path) => console.log(path)); process.exitCode = found.length > 0 ? 1 : 0;';

export const INDEX_COMMAND =
    'if ((await Bun.file("source.txt").text()).trim() === "invalid") { console.log("source.txt:1: Indexed defect"); process.exitCode = 1; }';
