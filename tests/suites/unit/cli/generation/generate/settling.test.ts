import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { GROUPS, LEVELS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import { readTree, isOnDisk } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { TOOL_LOCKFILES } from '#cli/config/configurations/structure.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SWITCH_CASES, PROJECT_FILES } from '#tests/config/generation/generate.ts';

/**
Check that the generated files report only tool lockfiles, and that a second apply changes nothing.
*/
async function expectSettled(root: string): Promise<void> {
    const before = await readTree(root);
    const preview = parseCheckReport(await runGspot(root, ['check', '--only', 'gspot/generated-files', '--json']));
    expect(preview.report.checks[0]?.status).toBe('failed');
    expect(
        preview.report.checks.flatMap(({ findings }) => findings).filter(({ file }) => !TOOL_LOCKFILES.has(file)),
    ).toStrictEqual([]);
    const repeated = await runGspot(root, ['apply', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(JSON.parse(repeated.stdout) as ApplyReport).toMatchObject({ written: [], updated: [], removed: [] });
    expect(await readTree(root)).toStrictEqual(before);
}

test.each(GROUPS.flatMap((group) => LEVELS.map((level) => ({ group, level }))))(
    '$group configurations at level $level settle in one apply',
    async ({ group, level }) => {
        const names = readConfigurations()
            .values()
            .filter((configuration) => configuration.group === group && !configuration.always_selected)
            .map(({ name }) => name)
            .toArray();
        expect(names.length).toBeGreaterThan(0);
        await using sandbox = await createGitSandbox({
            ...PROJECT_FILES,
            'gspot.toml': buildSandboxSettings(names, { level, rules: true }),
        });
        const first = await runGspot(sandbox.path, ['apply', '--json']);
        expect(first.code, first.stdout + first.stderr).toBe(0);
        expect((JSON.parse(first.stdout) as ApplyReport).written.length).toBeGreaterThan(0);
        await expectSettled(sandbox.path);
    },
);

test.each(SWITCH_CASES)('turning $name on and off settles in one apply', async ({ name, path }) => {
    await using sandbox = await createGitSandbox({ 'source.js': PROJECT_FILES['source.js'] });
    for (const enabled of [true, false]) {
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['javascript'], {
                tables: `[${name}]\nenabled = ${String(enabled)}\n${name === 'ci' ? 'provider = "github"\n' : ''}`,
            }),
        );
        const applied = await runGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, path))).toBe(enabled);
        await expectSettled(sandbox.path);
    }
});
