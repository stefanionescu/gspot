import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { SUPABASE_SANDBOX } from '#tests/data/checks/supabase.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, runGspotStep, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

// The Supabase sandbox installs Deno, and the rule runs through Semgrep.
describe.skipIf(!hasToolBuild('deno') || !hasToolBuild('semgrep'))('Supabase secret-log rule', () => {
    const installedSandbox = shareInstalledSandbox(SUPABASE_SANDBOX);
    test(
        'a selected supabase configuration brings the JavaScript secret-log rule to Deno code in the root and a child scope',
        assertSupabaseScopes.bind(undefined, installedSandbox),
    );
});

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

    await runGspotStep({ root, environment, run: spawnGspot }, ['install']);
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
                rule: 'gspot.javascript.secret-in-log',
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
