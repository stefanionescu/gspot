import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runSandboxStep } from '#tests/setup/install.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { SUPABASE_CASES, SUPABASE_SANDBOX } from '#tests/data/checks/supabase.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';

/** Assert the supabase scopes behavior. */
async function assertSupabaseScopes(installedSandbox: () => Sandbox): Promise<void> {
    const { root, environment } = installedSandbox();
    const files = {
        'gspot.toml': buildSandboxSettings(['supabase', 'security'], {
            level: 'all',
            scopes: [{ path: 'child' }],
        }),
        ...Object.fromEntries(
            ['supabase/functions/source.js', 'child/source.js'].map((path) => [
                path,
                'console.log(Deno.env.get("API_SECRET"));\n',
            ]),
        ),
    };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(SUPABASE_SANDBOX.files, files),
    );

    await runSandboxStep({ root: root, environment: environment, run: spawnGspot }, ['install']);
    const command = ['check', '--only', 'security/semgrep', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command, environment));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(
        report.checks
            .flatMap((check) => check.findings)
            .map(({ file, line, rule }) => ({ file, line, rule }))
            .toSorted((a, b) => a.file.localeCompare(b.file)),
    ).toStrictEqual(
        ['supabase/functions/source.js', 'child/source.js']
            .map((file) => ({
                file,
                line: 1,
                rule: 'gspot.javascript.no-secret-in-log',
            }))
            .toSorted((a, b) => a.file.localeCompare(b.file)),
    );
    for (const path of ['supabase/functions/source.js', 'child/source.js']) {
        expect(await readFile(join(root, path), 'utf8')).toBe('console.log(Deno.env.get("API_SECRET"));\n');
        await writeFile(join(root, path), 'console.log("Unable to load the record");\n');
    }
    const corrected = parseCheckReport(await spawnGspot(root, command, environment));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
}

describe.skipIf(!hasToolBuild('deno'))('Supabase samples', () => {
    const installedSandbox = registerSharedSandbox(SUPABASE_SANDBOX);

    test.skipIf(!hasToolBuild('semgrep'))(
        'manual Supabase selection reports Deno secret logs in root and child scopes',
        assertSupabaseScopes.bind(undefined, installedSandbox),
    );

    test.each([...SUPABASE_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
        const result = await runCheckSample(installedSandbox(), entry, SUPABASE_SANDBOX);
        expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
    });
});
