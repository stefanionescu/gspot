import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import type { Level } from '#cli/types/configurations.ts';
import type { SampleChanges } from '#tests/types/samples.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, runGspotStep, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges, changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';

import {
    SEMGREP_CHECK,
    SEMGREP_SANDBOX,
    SEMGREP_PROJECT_FILES,
} from '#tests/config/integration/checks/general/security/samples.ts';
import {
    SWIFT_SAMPLE,
    REPOSITORY_RULE,
    PLATFORM_SOURCES,
    NEXT_CONFIG_CASES,
    BASH_DOWNLOAD_SAMPLE,
    PLATFORM_SOURCE_FIXES,
    REPOSITORY_RULE_SOURCE,
    SECURITY_RULE_FINDINGS,
    PLATFORM_SOURCE_FINDINGS,
    MALFORMED_SEMGREP_RESULTS,
    PLATFORM_ALL_SOURCE_FIXES,
    PLATFORM_ALL_SOURCE_FINDINGS,
} from '#tests/config/integration/checks/general/security/semgrep.ts';

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);

    test('Semgrep reports a Bash file it cannot parse as a finding at its position', async () => {
        await checkUnparsableBash(installedSandbox());
    });

    test('the Bash and Swift Semgrep rules report piped downloads, eval, always-accessible keychain items, and MD5, and pass after the fix', async () => {
        await checkLanguageRules(installedSandbox());
    });

    test.each(['recommended', 'all'] as const)(
        '%s Semgrep rules report raw inputs once, accept documented forms, and pass after fixes',
        async (level) => {
            await checkPlatformRules(installedSandbox(), level);
        },
    );

    test('your own Semgrep rule file reports a finding through security/semgrep and passes after the fix', async () => {
        await checkAuthoredRules(installedSandbox());
    });

    // The Next.js configuration rules run through the same Semgrep command as the other shipped Semgrep rules.
    test.each([...NEXT_CONFIG_CASES])(
        'the Next.js Semgrep rules report exactly the expected lines of next.config: $name',
        async (row) => {
            await checkNextjsOptions(installedSandbox(), row);
        },
    );
});

// Stage a Bash file that Semgrep cannot parse, check the finding at its position, and pass after the repair.
async function checkUnparsableBash(sandbox: Sandbox): Promise<void> {
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

// Check the Bash and Swift rules on their samples, then on the fixed sources.
async function checkLanguageRules(sandbox: Sandbox): Promise<void> {
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['bash', 'swift', 'security'], { level: 'all' }),
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

// Check the platform rules at one level on their samples, then on the fixed sources.
async function checkPlatformRules(sandbox: Sandbox, level: Level): Promise<void> {
    const sourceFiles = {
        'package.json': SEMGREP_PROJECT_FILES['package.json'],
        'tsconfig.json': SEMGREP_PROJECT_FILES['tsconfig.json'],
        'wrangler.toml': SEMGREP_PROJECT_FILES['wrangler.toml'],
        'supabase/config.toml': SEMGREP_PROJECT_FILES['supabase/config.toml'],
        'Value.swift': SEMGREP_PROJECT_FILES['Value.swift'],
        'gspot.toml': buildSandboxSettings(
            ['javascript', 'typescript', 'swift', 'supabase', 'cloudflare', 'security', 'xcode'],
            { level },
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
    const expected = [...PLATFORM_SOURCE_FINDINGS, ...(level === 'all' ? PLATFORM_ALL_SOURCE_FINDINGS : [])];
    expect(listFindingRows(failed.report).toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
        expected.toSorted((left, right) => left.file.localeCompare(right.file)),
    );
    const corrections = { ...PLATFORM_SOURCE_FIXES };
    if (level === 'all') Object.assign(corrections, PLATFORM_ALL_SOURCE_FIXES);
    for (const [path, source] of Object.entries(corrections)) await writeFile(join(sandbox.root, path), source);
    const corrected = parseCheckReport(await spawnGspot(sandbox.root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}

// Check that a rule file of your own reports through security/semgrep, then passes after the fix.
async function checkAuthoredRules(sandbox: Sandbox): Promise<void> {
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['typescript', 'security'], {
            tables: stringify({ tools: { semgrep: { rule_files: ['security/own.yml'] } } }),
        }),
        'src/index.ts': REPOSITORY_RULE_SOURCE,
        'src/use.ts': "import { double } from './index.ts';\n\nexport const four = double(2);\n",
        'security/own.yml': REPOSITORY_RULE,
    };
    await using _sourceChange = await applyStagedSandboxChanges(
        sandbox,
        buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
    );
    const own = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(own.code, own.stdout + own.stderr).toBe(1);
    expect(own.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'failed' }]);
    expect(listFindingRows(own.report)).toStrictEqual([{ file: 'src/use.ts', line: 3, rule: 'test-no-double' }]);
    await writeFile(join(sandbox.root, 'src/use.ts'), 'export const four = 4;\n');
    const corrected = parseCheckReport(await spawnGspot(sandbox.root, SEMGREP_CHECK));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'security/semgrep', status: 'passed', findings: [] }]);
}

// Check the Next.js configuration rules on one next.config source.
async function checkNextjsOptions(
    sandbox: Sandbox,
    { source, expected }: (typeof NEXT_CONFIG_CASES)[number],
): Promise<void> {
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
    expect(
        listFindingRows(checked.report).toSorted((left, right) => (left.line ?? 0) - (right.line ?? 0)),
    ).toStrictEqual(expected.map(({ file, line, rule }) => ({ file, line, rule })));
}

/** Write and stage the sample files, then run apply; disposal restores the index and files. */
async function applyStagedSandboxChanges(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeAppliedSandbox(sandbox, changes));
    runGitStep(sandbox.root, ['add', '--all']);
    await runGspotStep(sandbox, ['apply']);
    return resources.move();
}
