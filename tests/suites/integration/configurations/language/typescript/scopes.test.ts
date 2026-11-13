import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { LEVELS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { APP_SCOPE_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const KEPT_DECLARATION_FILES = [
    'app/ambient.d.ts',
    'app/emitted/generated.ts',
    'app/vendor/dependency.ts',
    '.gspot/node_modules/@types/private/index.d.ts',
] as const;

const TYPESCRIPT_SCOPES_SANDBOX = {
    install: false,
    configurations: ['typescript'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n' },
} as const;

const STANDALONE_TYPESCRIPT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'source.ts': 'export const rootValue = 1;\n',
    'app/source.ts': `export const value = privateValue;
export const project = acceptedNumber;
export function select(flag: boolean) { if (flag) return 1; }
`,
    'app/ambient.d.ts': 'export {};\ndeclare global { const acceptedNumber: number; }\n',
    '.gitattributes': 'app/emitted/** linguist-generated\napp/vendor/** linguist-vendored\n',
    'app/emitted/generated.ts': 'This generated input is not TypeScript.\n',
    'app/vendor/dependency.ts': 'This vendored input is not TypeScript.\n',
    '.gspot/node_modules/@types/private/index.d.ts': 'export {};\ndeclare global { const privateValue: number; }\n',
} as const;

const PRIVATE_GLOBAL_FINDING = {
    file: 'app/source.ts',
    line: 1,
    column: 22,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
} as const;

const STANDALONE_TYPESCRIPT_FINDINGS = {
    basic: [PRIVATE_GLOBAL_FINDING],
    all: [
        PRIVATE_GLOBAL_FINDING,
        {
            file: 'app/source.ts',
            line: 3,
            column: 17,
            rule: 'TS7030',
            message: 'Not all code paths return a value.',
        },
    ],
} as const;

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SCOPES_SANDBOX);

test.each([...LEVELS])(
    "typescript/tsc at level %s checks each scope alone and keeps the authored declarations, without gspot's own @types",
    async (level) => {
        const { root } = installedSandbox();
        await using _sourceChange = await changeSandbox(installedSandbox(), {
            files: {
                ...STANDALONE_TYPESCRIPT_FILES,
                '.gitignore': `${GSPOT_FOLDER}/\nnode_modules/\n`,
                'gspot.toml': buildSandboxSettings(['typescript'], {
                    level,
                    tables: APP_SCOPE_SETTINGS,
                }),
            },
        });
        const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'failed' },
        ]);
        expect(broken.report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
            STANDALONE_TYPESCRIPT_FINDINGS[level].map((finding) => matchFields(finding)),
        );
        await writeFile(
            join(root, 'app/source.ts'),
            `export const value = 1;
export const project = acceptedNumber;
export function select(flag: boolean) { return flag ? 1 : 0; }
`,
        );
        const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toStrictEqual([
            matchFields({ scope: '', status: 'passed', findings: [] }),
            matchFields({ scope: 'app', status: 'passed', findings: [] }),
        ]);
        for (const path of KEPT_DECLARATION_FILES)
            expect(await readFile(join(root, path), 'utf8')).toBe(STANDALONE_TYPESCRIPT_FILES[path]);
    },
);
