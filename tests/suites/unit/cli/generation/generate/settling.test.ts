import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { TOOL_LOCKFILES } from '#cli/config/configurations/structure.ts';
import { LEVELS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { PROJECT_FILES, SWITCH_CASES } from '#tests/config/generation/generate.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';

/**
Check that the generated files report only tool lockfiles, and that a second write changes nothing.
*/
async function expectSettled(root: string): Promise<void> {
    const before = await readTree(root);
    const preview = parseCheckReport(await runGspot(root, ['check', '--only', 'gspot/generated-files', '--json']));
    expect(preview.report.checks[0]?.status).toBe('failed');
    expect(
        preview.report.checks.flatMap(({ findings }) => findings).filter(({ file }) => !TOOL_LOCKFILES.has(file)),
    ).toStrictEqual([]);
    const repeated = await applyGeneratedFiles(root);
    expect(repeated).toMatchObject({ written: [], updated: [], deleted: [] });
    expect(await readTree(root)).toStrictEqual(before);
}

test.each([...LEVELS])('every configuration at level %s settles in one write', async (level) => {
    const names = readConfigurations()
        .values()
        .filter((configuration) => !configuration.always_selected)
        .map(({ name }) => name)
        .toArray();
    await using sandbox = await createGitSandbox({
        ...PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(names, { level, rules: true }),
    });
    const first = await applyGeneratedFiles(sandbox.path);
    expect(first.written.length).toBeGreaterThan(0);
    await expectSettled(sandbox.path);
});

test.each(SWITCH_CASES)('turning $name on and off settles in one write', async ({ name, path }) => {
    await using sandbox = await createGitSandbox({ 'source.js': PROJECT_FILES['source.js'] });
    for (const enabled of [true, false]) {
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['javascript'], {
                tables: `[${name}]\nenabled = ${String(enabled)}\n${name === 'ci' ? 'provider = "github"\n' : ''}`,
            }),
        );
        await applyGeneratedFiles(sandbox.path);
        expect(existsSync(join(sandbox.path, path))).toBe(enabled);
        await expectSettled(sandbox.path);
    }
});
