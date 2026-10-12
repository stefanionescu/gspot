import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { SEMGREP_CHECK } from '#tests/config/execution.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { spawnGspot, findingRows } from '#tests/setup/run-gspot.ts';

import {
    EXPRESS_SOURCES,
    EXPRESS_SCOPE_FILES,
    EXPRESS_SCOPE_SETTINGS,
    EXPRESS_SCOPE_FINDINGS,
    EXPRESS_SOURCE_FINDINGS,
} from '#tests/config/express.ts';

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))('the Express rules stay within inherited scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript', 'security'], { tables: EXPRESS_SCOPE_SETTINGS }),
        ...EXPRESS_SCOPE_FILES,
    });
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
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
    const invalidRule = join(sandbox.path, '.gspot/config/app/semgrep/express.yml');
    await Bun.write(invalidRule, 'rules: [');
    const invalid = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect((JSON.parse(invalid.stdout) as RunReport).checks.find((check) => check.scope === 'app')?.status).toBe(
        'error',
    );
});

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))(
    'the Express pack reports SQL interpolation and raw response fields without misreporting positive cases',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['express', 'security']),
            'package.json': '{"private": true, "dependencies": {"express": "5.2.1"}}\n',
            ...EXPRESS_SOURCES,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installToolProjects(sandbox.path);
        const failed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = findingRows(JSON.parse(failed.stdout) as RunReport);
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
