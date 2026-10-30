import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { SUPABASE_SANDBOX } from '#tests/config/integration/checks/samples.ts';
import { writeSandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { SECRET_LOG_FILES } from '#tests/config/integration/checks/general/security/supabase.ts';
import { spawnGspot, runGspotStep, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

describe.skipIf(!hasToolBuild('deno') || !hasToolBuild('semgrep'))('Supabase secret-log rule', () => {
    const installedSandbox = shareInstalledSandbox(SUPABASE_SANDBOX);

    test('a selected supabase configuration brings the JavaScript secret-log rule to Deno code in the root and a child scope', async () => {
        const { root } = installedSandbox();
        const files = {
            'gspot.toml': buildSandboxSettings(['supabase', 'security'], {
                level: 'all',
                scopes: [{ path: 'child' }],
            }),
            ...Object.fromEntries(SECRET_LOG_FILES.map((path) => [path, 'console.log(Deno.env.get("API_SECRET"));\n'])),
        };
        await using _sourceChange = await writeSandboxChanges(
            installedSandbox(),
            buildSandboxChanges(SUPABASE_SANDBOX.files, files),
        );

        await runGspotStep(installedSandbox(), ['install']);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = parseCheckReport(await spawnGspot(root, command));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(listFindingRows(failed.report)).toStrictEqual(
            SECRET_LOG_FILES.map((file) => ({ file, line: 1, rule: 'gspot.javascript.secret-in-log' })),
        );
        for (const path of SECRET_LOG_FILES)
            await writeFile(join(root, path), 'console.log("Unable to load the record");\n');
        const corrected = parseCheckReport(await spawnGspot(root, command));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(listFindingRows(corrected.report)).toStrictEqual([]);
    });
});
