import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { SEMGREP_CHECK } from '#tests/config/execution.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { spawnGspot, findingRows } from '#tests/setup/run-gspot.ts';
import type { Finding, RunReport } from '#cli/types/execution/check.ts';

import {
    OWN_RULE,
    SWIFT_SAMPLE,
    OWN_RULE_SOURCE,
    PLATFORM_SOURCES,
    BASH_DOWNLOAD_SAMPLE,
    PLATFORM_SOURCE_FIXES,
    SEMGREP_PROJECT_FILES,
    PLATFORM_SOURCE_FINDINGS,
    PLATFORM_ALL_SOURCE_FIXES,
    PLATFORM_ALL_SOURCE_FINDINGS,
} from '#tests/config/security.ts';

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))(
    'Semgrep reports a Bash file it cannot parse as a finding at its position',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText(['bash', 'security']),
            'scripts/café build.sh': 'if then\n',
        });
        commitAll(sandbox.path);
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installToolProjects(sandbox.path);
        const malformed = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(1);
        expect((JSON.parse(malformed.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'security/semgrep',
                status: 'failed',
                findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
            },
        ]);
        await Bun.write(join(sandbox.path, 'scripts/café build.sh'), 'printf "%s\\n" ready\n');
        const corrected = await spawnGspot(sandbox.path, SEMGREP_CHECK);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'security/semgrep', status: 'passed', findings: [] },
        ]);
    },
);

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))('Semgrep rules follow the level', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['bash', 'swift', 'security'], {
            level: 'recommended',
        }),
        'script.sh': BASH_DOWNLOAD_SAMPLE,
        'Value.swift': SWIFT_SAMPLE,
    });
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const recommended = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(1);
    expect(
        (JSON.parse(recommended.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .flatMap(({ rule }) => (rule?.startsWith('gspot.swift.') === true ? [rule] : [])),
    ).toStrictEqual(['gspot.swift.keychain-accessible-always', 'gspot.swift.weak-hash-algorithm']);
    await Bun.write(join(sandbox.path, 'gspot.toml'), settingsText(['bash', 'swift', 'security'], { level: 'all' }));
    const awaitedCommand = await spawnGspot(sandbox.path, ['apply']);
    expect(awaitedCommand.code).toBe(0);
    const all = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(all.code, all.stdout + all.stderr).toBe(1);
    expect(findingRows(JSON.parse(all.stdout) as RunReport)).toStrictEqual([
        { file: 'Value.swift', line: 1, rule: 'gspot.swift.keychain-accessible-always' },
        { file: 'Value.swift', line: 2, rule: 'gspot.swift.weak-hash-algorithm' },
        { file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 3, rule: 'gspot.bash.eval' },
        { file: 'script.sh', line: 4, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 5, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 6, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 7, rule: 'gspot.bash.curl-pipe-shell' },
    ]);
    await Bun.write(join(sandbox.path, 'script.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n');
    await Bun.write(
        join(sandbox.path, 'Value.swift'),
        SWIFT_SAMPLE.replace('kSecAttrAccessibleAlways', 'kSecAttrAccessibleWhenUnlockedThisDeviceOnly').replace(
            'Insecure.MD5',
            'SHA256',
        ),
    );
    const clean = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    '%s security packs report raw inputs once, accept documented forms, and pass after fixes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': SEMGREP_PROJECT_FILES['package.json'],
            'tsconfig.json': SEMGREP_PROJECT_FILES['tsconfig.json'],
            'wrangler.toml': SEMGREP_PROJECT_FILES['wrangler.toml'],
            'supabase/config.toml': SEMGREP_PROJECT_FILES['supabase/config.toml'],
            'Value.swift': SEMGREP_PROJECT_FILES['Value.swift'],
            'gspot.toml': settingsText(
                ['javascript', 'typescript', 'swift', 'supabase', 'cloudflare', 'security', 'xcode'],
                {
                    level: level,
                },
            ),
            ...PLATFORM_SOURCES,
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installToolProjects(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', 'xcode/app-transport-security', '--json'];
        const failed = await spawnGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = findingRows(JSON.parse(failed.stdout) as RunReport);
        const expected = [...PLATFORM_SOURCE_FINDINGS, ...(level === 'all' ? PLATFORM_ALL_SOURCE_FINDINGS : [])];
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            expected.toSorted((left, right) => left.file.localeCompare(right.file)),
        );
        const corrections = { ...PLATFORM_SOURCE_FIXES };
        if (level === 'all') Object.assign(corrections, PLATFORM_ALL_SOURCE_FIXES);
        for (const [path, source] of Object.entries(corrections)) await Bun.write(join(sandbox.path, path), source);
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))('repository security rules report findings and pass after fixes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript', 'security'], {
            tables: '[tools.semgrep]\nrule_files = ["security/own.yml"]\n',
        }),
        'src/index.ts': OWN_RULE_SOURCE,
        'src/use.ts': `import { double } from './index.ts';

export const four = double(2);
`,
        'security/own.yml': OWN_RULE,
    });
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const own = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(own.code, own.stdout + own.stderr).toBe(1);
    const report = JSON.parse(own.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'security/semgrep', status: 'failed' }]);
    expect(report.checks[0]!.findings).toContainEqual(
        containing<Finding>({ rule: 'test-no-double', file: 'src/use.ts', line: 3 }),
    );
    await Bun.write(join(sandbox.path, 'src/use.ts'), 'export const four = 4;\n');
    const corrected = await spawnGspot(sandbox.path, SEMGREP_CHECK);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'security/semgrep', status: 'passed', findings: [] },
    ]);
});
