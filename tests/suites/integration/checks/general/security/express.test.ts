import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { runAppliedSample } from '#tests/setup/cli/samples.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { findFileTarget } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { SEMGREP_CHECK, SEMGREP_SANDBOX } from '#tests/config/integration/checks/general/security/samples.ts';
import { spawnGspot, listFindingRows, parseCheckReport, listScopeFindingRows } from '#tests/setup/cli/commands.ts';

import {
    EXPRESS_SOURCES,
    EXPRESS_SCOPE_FILES,
    EXPRESS_SCOPE_FINDINGS,
    EXPRESS_SCOPE_SETTINGS,
    EXPRESS_SOURCE_FINDINGS,
} from '#tests/config/integration/checks/general/security/express.ts';

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);

    test('the Express Semgrep rules stay within the scopes that inherit Express, and a broken rule file is an error in its scope', async () => {
        const { root } = installedSandbox();
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['javascript', 'security'], { tables: EXPRESS_SCOPE_SETTINGS }),
            ...EXPRESS_SCOPE_FILES,
        };
        await using _sourceChange = await applySandboxChanges(
            installedSandbox(),
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
        );
        const broken = parseCheckReport(await spawnGspot(root, SEMGREP_CHECK));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(listScopeFindingRows(broken.report)).toStrictEqual([...EXPRESS_SCOPE_FINDINGS]);
        for (const path of ['app/source.js', 'app/child/source.js'])
            await writeFile(join(root, path), 'res.json({ message: "Accepted" });\n');
        const corrected = await spawnGspot(root, SEMGREP_CHECK);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const invalidRule = join(root, findFileTarget('express', 'semgrep.yml'));
        await writeFile(invalidRule, 'rules: [');
        const invalid = parseCheckReport(await spawnGspot(root, SEMGREP_CHECK));
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(invalid.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'error' },
            { scope: 'app/child', status: 'error' },
            { scope: 'sibling', status: 'passed' },
        ]);
    });

    test('the Express Semgrep rules report SQL interpolation and raw response fields, and accept parameterized queries and res.json', async () => {
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['express', 'security']),
            'package.json': '{"private": true, "dependencies": {"express": "0.0.0-test"}}\n',
            ...EXPRESS_SOURCES,
        };
        await using sample = await runAppliedSample(
            installedSandbox(),
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
            {
                commandArguments: SEMGREP_CHECK,
                corrected: {
                    'execute-template.js': EXPRESS_SOURCES['parameterized.js'],
                    'query-template.js': EXPRESS_SOURCES['parameterized.js'],
                    'field.js': EXPRESS_SOURCES['json.js'],
                    'response-template.js': EXPRESS_SOURCES['json.js'],
                },
            },
        );
        const { failed, passed: corrected } = sample;
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(listFindingRows(failed.report)).toStrictEqual([...EXPRESS_SOURCE_FINDINGS]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    });
});
