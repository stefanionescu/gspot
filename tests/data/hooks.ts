/** The authored hook providers and the Git-local script that init must retain. */
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

export const SAMPLE_COMMAND =
    'const found = process.argv.slice(1).filter((path) => require("node:fs").readFileSync(path, "utf8").includes("DEFECT")); found.forEach((path) => console.log(path)); process.exitCode = found.length > 0 ? 1 : 0;';

export const INDEX_COMMAND =
    'if ((await Bun.file("source.txt").text()).trim() === "invalid") { console.log("source.txt:1: Indexed defect"); process.exitCode = 1; }';
