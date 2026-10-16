import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxStep } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { Finding } from '#cli/types/checks/run/check.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { NEXT_CONFIG_CASES } from '#tests/data/checks/nextjs.ts';
import { listFindingRows, spawnCheckReport } from '#tests/setup/run-gspot.ts';
import { applySandboxChanges, registerSharedSandbox, applyStagedSandboxChanges } from '#tests/setup/sandbox.ts';

import {
    OWN_RULE,
    SWIFT_SAMPLE,
    SEMGREP_CHECK,
    OWN_RULE_SOURCE,
    SEMGREP_SANDBOX,
    PLATFORM_SOURCES,
    BASH_DOWNLOAD_SAMPLE,
    PLATFORM_SOURCE_FIXES,
    SEMGREP_PROJECT_FILES,
    PLATFORM_SOURCE_FINDINGS,
    PLATFORM_ALL_SOURCE_FIXES,
    PLATFORM_ALL_SOURCE_FINDINGS,
} from '#tests/data/checks/security/semgrep-rules.ts';

// Systems without a semgrep build skip every test here, so they install nothing.
const installedSandbox = hasToolBuild('semgrep') ? registerSharedSandbox(SEMGREP_SANDBOX) : undefined;

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))(
    'Semgrep reports a Bash file it cannot parse as a finding at its position',
    async () => {
        const sandbox = installedSandbox!();
        const sourceFiles = {
            'gspot.toml': buildSettingsText(['bash', 'security']),
            'scripts/café build.sh': 'if then\n',
        };
        await using _sourceChange = await applyStagedSandboxChanges(
            sandbox,
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
        );
        const malformed = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(1);
        expect(malformed.report.checks).toMatchObject([
            {
                check: 'security/semgrep',
                status: 'failed',
                findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
            },
        ]);
        await Bun.write(join(sandbox.root, 'scripts/café build.sh'), 'printf "%s\\n" ready\n');
        const corrected = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'passed', findings: [] }]);
    },
);

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))('Semgrep rules follow the level', async () => {
    const sandbox = installedSandbox!();
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['bash', 'swift', 'security'], {
            level: 'recommended',
        }),
        'script.sh': BASH_DOWNLOAD_SAMPLE,
        'Value.swift': SWIFT_SAMPLE,
    };
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const recommended = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(1);
    expect(
        recommended.report.checks
            .flatMap((check) => check.findings)
            .flatMap(({ rule }) => (rule?.startsWith('gspot.swift.') === true ? [rule] : [])),
    ).toStrictEqual(['gspot.swift.keychain-accessible-always', 'gspot.swift.weak-hash-algorithm']);
    await Bun.write(
        join(sandbox.root, 'gspot.toml'),
        buildSettingsText(['bash', 'swift', 'security'], { level: 'all' }),
    );
    await runSandboxStep(sandbox.root, ['apply'], {}, 'apply');
    const all = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
    expect(all.code, all.stdout + all.stderr).toBe(1);
    expect(listFindingRows(all.report)).toStrictEqual([
        { file: 'Value.swift', line: 1, rule: 'gspot.swift.keychain-accessible-always' },
        { file: 'Value.swift', line: 2, rule: 'gspot.swift.weak-hash-algorithm' },
        { file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 3, rule: 'gspot.bash.eval' },
        { file: 'script.sh', line: 4, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 5, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 6, rule: 'gspot.bash.curl-pipe-shell' },
        { file: 'script.sh', line: 7, rule: 'gspot.bash.curl-pipe-shell' },
    ]);
    await Bun.write(join(sandbox.root, 'script.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n');
    await Bun.write(
        join(sandbox.root, 'Value.swift'),
        SWIFT_SAMPLE.replace('kSecAttrAccessibleAlways', 'kSecAttrAccessibleWhenUnlockedThisDeviceOnly').replace(
            'Insecure.MD5',
            'SHA256',
        ),
    );
    const clean = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep')).each(['recommended', 'all'] as const)(
    '%s security packs report raw inputs once, accept documented forms, and pass after fixes',
    async (level) => {
        const sandbox = installedSandbox!();
        const sourceFiles = {
            'package.json': SEMGREP_PROJECT_FILES['package.json'],
            'tsconfig.json': SEMGREP_PROJECT_FILES['tsconfig.json'],
            'wrangler.toml': SEMGREP_PROJECT_FILES['wrangler.toml'],
            'supabase/config.toml': SEMGREP_PROJECT_FILES['supabase/config.toml'],
            'Value.swift': SEMGREP_PROJECT_FILES['Value.swift'],
            'gspot.toml': buildSettingsText(
                ['javascript', 'typescript', 'swift', 'supabase', 'cloudflare', 'security', 'xcode'],
                {
                    level: level,
                },
            ),
            ...PLATFORM_SOURCES,
        };
        await using _sourceChange = await applySandboxChanges(
            sandbox,
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
        );
        const command = ['check', '--only', 'security/semgrep', 'xcode/app-transport-security', '--json'];
        const failed = await spawnCheckReport(sandbox.root, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const findings = listFindingRows(failed.report);
        const expected = [...PLATFORM_SOURCE_FINDINGS, ...(level === 'all' ? PLATFORM_ALL_SOURCE_FINDINGS : [])];
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            expected.toSorted((left, right) => left.file.localeCompare(right.file)),
        );
        const corrections = { ...PLATFORM_SOURCE_FIXES };
        if (level === 'all') Object.assign(corrections, PLATFORM_ALL_SOURCE_FIXES);
        for (const [path, source] of Object.entries(corrections)) await Bun.write(join(sandbox.root, path), source);
        const corrected = await spawnCheckReport(sandbox.root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))('repository security rules report findings and pass after fixes', async () => {
    const sandbox = installedSandbox!();
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['typescript', 'security'], {
            tables: '[tools.semgrep]\nrule_files = ["security/own.yml"]\n',
        }),
        'src/index.ts': OWN_RULE_SOURCE,
        'src/use.ts': `import { double } from './index.ts';

export const four = double(2);
`,
        'security/own.yml': OWN_RULE,
    };
    await using _sourceChange = await applyStagedSandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const own = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
    expect(own.code, own.stdout + own.stderr).toBe(1);
    const report = own.report;
    expect(report.checks).toMatchObject([{ check: 'security/semgrep', status: 'failed' }]);
    expect(report.checks[0]!.findings).toContainEqual(
        matchFields<Finding>({ rule: 'test-no-double', file: 'src/use.ts', line: 3 }),
    );
    await Bun.write(join(sandbox.root, 'src/use.ts'), 'export const four = 4;\n');
    const corrected = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'passed', findings: [] }]);
});

// The Next.js configuration rules run through the same native Semgrep command as other shipped packs.
test.skipIf(!hasToolBuild('semgrep')).each([...NEXT_CONFIG_CASES])(
    'Semgrep checks next.config literals: $name',
    async ({ source, expected }) => {
        const sandbox = installedSandbox!();
        const sourceFiles = {
            'gspot.toml': buildSettingsText(['nextjs']),
            'next.config.ts': source,
        };
        await using _sourceChange = await applySandboxChanges(
            sandbox,
            buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
        );
        const checked = await spawnCheckReport(sandbox.root, SEMGREP_CHECK);
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.length === 0 ? 0 : 1);
        const findings = checked.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ file, line, rule }) => ({ file, line, rule }))
            .toSorted((left, right) => (left.line ?? 0) - (right.line ?? 0));
        expect(findings).toStrictEqual(expected.map(({ file, line, rule }) => ({ file, line, rule })));
    },
);
