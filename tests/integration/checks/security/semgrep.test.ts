import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { runGit } from '#tests/setup/system/git.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { Level } from '#cli/types/configurations.ts';
import type { SampleChanges } from '#tests/types/samples.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, runGspotStep, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges, changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';

import {
    SWIFT_SAMPLE,
    SEMGREP_CHECK,
    REPOSITORY_RULE,
    SEMGREP_SANDBOX,
    PLATFORM_SOURCES,
    NEXT_CONFIG_CASES,
    BASH_DOWNLOAD_SAMPLE,
    PLATFORM_SOURCE_FIXES,
    SEMGREP_PROJECT_FILES,
    REPOSITORY_RULE_SOURCE,
    SECURITY_RULE_FINDINGS,
    PLATFORM_SOURCE_FINDINGS,
    MALFORMED_SEMGREP_RESULTS,
    PLATFORM_ALL_SOURCE_FIXES,
    PLATFORM_ALL_SOURCE_FINDINGS,
} from '#tests/data/integration/checks/security/semgrep.ts';

/** Assert the semgrep parsing behavior. */
async function assertSemgrepParsing(installedSandbox: () => Sandbox): Promise<void> {
    const sandbox = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['bash', 'security']),
        'scripts/café build.sh': 'if then\n',
    };
    await using _sourceChange = await applyStagedSandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const malformed = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(1);
    expect(malformed.report.checks).toMatchObject([...MALFORMED_SEMGREP_RESULTS]);
    await writeFile(join(sandbox.root, 'scripts/café build.sh'), 'printf "%s\\n" ready\n');
    const corrected = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'passed', findings: [] }]);
}

/** Assert the shell and swift rules behavior. */
async function assertLanguageRules(installedSandbox: () => Sandbox): Promise<void> {
    const sandbox = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['bash', 'swift', 'security'], {
            level: 'all',
        }),
        'script.sh': BASH_DOWNLOAD_SAMPLE,
        'Value.swift': SWIFT_SAMPLE,
    };
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const all = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(all.code, all.stdout + all.stderr).toBe(1);
    expect(listFindingRows(all.report)).toStrictEqual([...SECURITY_RULE_FINDINGS]);
    await writeFile(join(sandbox.root, 'script.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n');
    await writeFile(
        join(sandbox.root, 'Value.swift'),
        SWIFT_SAMPLE.replace('kSecAttrAccessibleAlways', 'kSecAttrAccessibleWhenUnlockedThisDeviceOnly').replace(
            'Insecure.MD5',
            'SHA256',
        ),
    );
    const clean = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
}

/** Assert the platform rules behavior. */
async function assertPlatformRules(installedSandbox: () => Sandbox, level: Level): Promise<void> {
    const sandbox = installedSandbox();
    const sourceFiles = {
        'package.json': SEMGREP_PROJECT_FILES['package.json'],
        'tsconfig.json': SEMGREP_PROJECT_FILES['tsconfig.json'],
        'wrangler.toml': SEMGREP_PROJECT_FILES['wrangler.toml'],
        'supabase/config.toml': SEMGREP_PROJECT_FILES['supabase/config.toml'],
        'Value.swift': SEMGREP_PROJECT_FILES['Value.swift'],
        'gspot.toml': buildSandboxSettings(
            ['javascript', 'typescript', 'swift', 'supabase', 'cloudflare', 'security', 'xcode'],
            {
                level,
            },
        ),
        ...PLATFORM_SOURCES,
    };
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const command = ['check', '--only', 'security/semgrep,xcode/app-transport-security', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = listFindingRows(failed.report);
    const expected = [...PLATFORM_SOURCE_FINDINGS, ...(level === 'all' ? PLATFORM_ALL_SOURCE_FINDINGS : [])];
    expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
        expected.toSorted((left, right) => left.file.localeCompare(right.file)),
    );
    const corrections = { ...PLATFORM_SOURCE_FIXES };
    if (level === 'all') Object.assign(corrections, PLATFORM_ALL_SOURCE_FIXES);
    for (const [path, source] of Object.entries(corrections)) await writeFile(join(sandbox.root, path), source);
    const corrected = parseCheckReport(await spawnGspot(sandbox.root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}

/** Assert the authored rules behavior. */
async function assertAuthoredRules(installedSandbox: () => Sandbox): Promise<void> {
    const sandbox = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['typescript', 'security'], {
            tables: '[tools.semgrep]\nrule_files = ["security/own.yml"]\n',
        }),
        'src/index.ts': REPOSITORY_RULE_SOURCE,
        'src/use.ts': `import { double } from './index.ts';

export const four = double(2);
`,
        'security/own.yml': REPOSITORY_RULE,
    };
    await using _sourceChange = await applyStagedSandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const own = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(own.code, own.stdout + own.stderr).toBe(1);
    const report = own.report;
    expect(report.checks).toMatchObject([{ check: 'security/semgrep', status: 'failed' }]);
    expect(report.checks[0]!.findings).toContainEqual(
        matchFields<Finding>({ rule: 'test-no-double', file: 'src/use.ts', line: 3 }),
    );
    await writeFile(join(sandbox.root, 'src/use.ts'), 'export const four = 4;\n');
    const corrected = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'passed', findings: [] }]);
}

/** Assert the next config rules behavior. */
async function assertNextjsRules(
    installedSandbox: () => Sandbox,
    { source, expected }: (typeof NEXT_CONFIG_CASES)[number],
): Promise<void> {
    const sandbox = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['nextjs']),
        'next.config.ts': source,
    };
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const checked = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(checked.code, checked.stdout + checked.stderr).toBe(expected.length === 0 ? 0 : 1);
    const findings = checked.report.checks
        .flatMap(({ findings }) => findings)
        .map(({ file, line, rule }) => ({ file, line, rule }))
        .toSorted((left, right) => (left.line ?? 0) - (right.line ?? 0));
    expect(findings).toStrictEqual(expected.map(({ file, line, rule }) => ({ file, line, rule })));
}

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);
    test(
        'Semgrep reports a Bash file it cannot parse as a finding at its position',
        assertSemgrepParsing.bind(undefined, installedSandbox),
    );

    test(
        'the Bash and Swift Semgrep rules report piped downloads, eval, always-accessible keychain items, and MD5, and pass after the fix',
        assertLanguageRules.bind(undefined, installedSandbox),
    );

    test.each(['recommended', 'all'] as const)(
        '%s Semgrep rules report raw inputs once, accept documented forms, and pass after fixes',
        assertPlatformRules.bind(undefined, installedSandbox),
    );

    test(
        'your own Semgrep rule file reports a finding through security/semgrep and passes after the fix',
        assertAuthoredRules.bind(undefined, installedSandbox),
    );

    // The Next.js configuration rules run through the same Semgrep command as the other shipped Semgrep rules.
    test.each([...NEXT_CONFIG_CASES])(
        'the Next.js Semgrep rules report exactly the expected lines of next.config: $name',
        assertNextjsRules.bind(undefined, installedSandbox),
    );
});

/** Write and stage the sample files, then run apply; disposal restores the index and files. */
async function applyStagedSandboxChanges(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeAppliedSandbox(sandbox, changes));
    const staged = runGit(sandbox.root, ['add', '--all']);
    if (staged.code !== 0) throw new Error(`Staging sandbox inputs failed: ${staged.stderr}${staged.stdout}`);
    await runGspotStep(sandbox, ['apply']);
    return resources.move();
}
