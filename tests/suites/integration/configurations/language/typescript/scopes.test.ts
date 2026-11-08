import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { LEVELS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import {
    KEPT_DECLARATION_FILES,
    STANDALONE_TYPESCRIPT_FILES,
    STANDALONE_TYPESCRIPT_FINDINGS,
    TYPESCRIPT_SCOPES_SANDBOX,
} from '#tests/config/integration/typescript.ts';
import { APP_SCOPE_SETTINGS } from '#tests/config/setup/languages.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

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
