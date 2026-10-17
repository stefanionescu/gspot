import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { spawnGspot, listFindingRows } from '#tests/setup/run-gspot.ts';
import { SEMGREP_CHECK } from '#tests/data/checks/security/semgrep-rules.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    EXPRESS_SOURCES,
    EXPRESS_SCOPE_FILES,
    EXPRESS_SCOPE_FINDINGS,
    EXPRESS_SCOPE_SETTINGS,
    EXPRESS_SOURCE_FINDINGS,
    CHECKS_EXPRESS_INSTALLED_SANDBOX,
} from '#tests/data/checks/express.ts';

// Systems without a semgrep build skip every test here, so they install nothing.
const installedSandbox = hasToolBuild('semgrep') ? registerSharedSandbox(CHECKS_EXPRESS_INSTALLED_SANDBOX) : undefined;

test.skipIf(!hasToolBuild('semgrep'))('the Express rules stay within inherited scopes', async () => {
    const sandbox = { path: installedSandbox!().root };
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['javascript', 'security'], { tables: EXPRESS_SCOPE_SETTINGS }),
        ...EXPRESS_SCOPE_FILES,
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox!(),
        buildSandboxChanges(CHECKS_EXPRESS_INSTALLED_SANDBOX.files, sourceFiles),
    );
    expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
    const broken = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    const findingsByScope = (JSON.parse(broken.stdout) as RunReport).checks.flatMap(({ scope, findings }) =>
        findings.map(({ file, line, rule }) => ({ scope, file, line, rule })),
    );
    expect(findingsByScope).toStrictEqual([...EXPRESS_SCOPE_FINDINGS]);
    for (const path of ['app/source.js', 'app/child/source.js'])
        await Bun.write(join(sandbox.path, path), 'res.json({ message: "Accepted" });\n');
    await Bun.write(join(sandbox.path, 'sibling/ignored.js'), 'JSON.parse(input);\n');
    const corrected = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const invalidRule = join(sandbox.path, '.gspot/config/semgrep/express.yml');
    await Bun.write(invalidRule, 'rules: [');
    const invalid = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect((JSON.parse(invalid.stdout) as RunReport).checks.find((check) => check.scope === 'app')?.status).toBe(
        'error',
    );
});

test.skipIf(!hasToolBuild('semgrep'))(
    'the Express pack reports SQL interpolation and raw response fields without misreporting positive cases',
    async () => {
        const sandbox = { path: installedSandbox!().root };
        const sourceFiles = {
            'gspot.toml': buildSettingsText(['express', 'security']),
            'package.json': '{"private": true, "dependencies": {"express": "5.2.1"}}\n',
            ...EXPRESS_SOURCES,
        };
        await using _sourceChange = await updateSandbox(
            installedSandbox!(),
            buildSandboxChanges(CHECKS_EXPRESS_INSTALLED_SANDBOX.files, sourceFiles),
        );
        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        const failed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = listFindingRows(JSON.parse(failed.stdout) as RunReport);
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual([
            ...EXPRESS_SOURCE_FINDINGS,
        ]);
        for (const path of ['execute-template.js', 'query-template.js'])
            await Bun.write(join(sandbox.path, path), EXPRESS_SOURCES['parameterized.js']);
        for (const path of ['field.js', 'response-template.js'])
            await Bun.write(join(sandbox.path, path), EXPRESS_SOURCES['json.js']);
        const corrected = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);
