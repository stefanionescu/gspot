import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runAppliedSample } from '#tests/setup/sample-checks.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { SEMGREP_CHECK, SEMGREP_SANDBOX } from '#tests/data/checks/security/semgrep-rules.ts';

import {
    EXPRESS_SOURCES,
    EXPRESS_SCOPE_FILES,
    EXPRESS_SCOPE_FINDINGS,
    EXPRESS_SCOPE_SETTINGS,
    EXPRESS_SOURCE_FINDINGS,
} from '#tests/data/checks/express.ts';

/** Assert the express scopes behavior. */
async function assertExpressScopes(installedSandbox: () => Sandbox): Promise<void> {
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
    const findingsByScope = broken.report.checks.flatMap(({ scope, findings }) =>
        findings.map(({ file, line, rule }) => ({ scope, file, line, rule })),
    );
    expect(findingsByScope).toStrictEqual([...EXPRESS_SCOPE_FINDINGS]);
    for (const path of ['app/source.js', 'app/child/source.js'])
        await writeFile(join(root, path), 'res.json({ message: "Accepted" });\n');
    const corrected = await spawnGspot(root, SEMGREP_CHECK);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const invalidRule = join(root, '.gspot/configurations/framework/express/semgrep.yml');
    await writeFile(invalidRule, 'rules: [');
    const invalid = parseCheckReport(await spawnGspot(root, SEMGREP_CHECK));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.report.checks.find((check) => check.scope === 'app')?.status).toBe('error');
}

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = registerSharedSandbox(SEMGREP_SANDBOX);
    test('the Express rules stay within inherited scopes', assertExpressScopes.bind(undefined, installedSandbox));

    test('the Express pack reports SQL interpolation and raw response fields without misreporting positive cases', async () => {
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
        const findings = listFindingRows(failed.report);
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual([
            ...EXPRESS_SOURCE_FINDINGS,
        ]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    });
});
