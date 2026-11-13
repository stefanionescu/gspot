import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { LEVELS } from '#cli/config/manifests.ts';
import { MARKERS } from '#cli/config/parsers/formats.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import { PROJECT_FILES, SWITCH_CASES } from '#tests/config/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';

async function listStaleAgentsRows(root: string, change: (text: string) => string) {
    await applyGeneratedFiles(root);
    const path = join(root, 'AGENTS.md');
    await writeFile(path, change(await readFile(path, 'utf8')));
    const session = await openSession(root);
    return listStaleFiles(session, buildGeneratedFiles(session)).filter((file) => file.path === 'AGENTS.md');
}

test('changed managed keys are reported without a whole-file replacement', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"stylelint":"authored"}\n',
    });
    const session = await openSession(sandbox.path);
    const output = {
        files: [],
        blocks: [],
        managedKeys: [{ path: 'package.json', keys: [{ key: ['stylelint'], value: 'managed' }] }],
    };
    expect(listStaleFiles(session, output)).toStrictEqual([{ path: 'package.json', kind: 'changed' }]);
});

test('an up-to-date AGENTS.md block in a CRLF file is not stale', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'AGENTS.md': '# Project\n\nAuthored text.\n',
    });
    expect(await listStaleAgentsRows(sandbox.path, (text) => text.replaceAll('\n', '\r\n'))).toStrictEqual([]);
});

test('a blank line after the block start marker is stale', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'AGENTS.md': '# Project\n\nAuthored text.\n',
    });
    const { start } = MARKERS.markdown;
    expect(await listStaleAgentsRows(sandbox.path, (text) => text.replace(start, () => `${start}\n`))).toStrictEqual([
        { path: 'AGENTS.md', kind: 'changed' },
    ]);
});

test('an authored file at a generated path without the header is stale', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['format']),
        '.editorconfig': 'root = true\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        listStaleFiles(session, buildGeneratedFiles(session)).filter((file) => file.path === '.editorconfig'),
    ).toStrictEqual([{ path: '.editorconfig', kind: 'changed' }]);
});

/**
Expect that, after one write, only the tool lockfiles are stale and a second write changes nothing.
*/
async function expectSettled(root: string): Promise<void> {
    const before = await readTree(root);
    const session = await openSession(root);
    const generated = buildGeneratedFiles(session);
    expect(listStaleFiles(session, generated)).toStrictEqual(listStaleLockfiles(session, generated.files));
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
    await applyGeneratedFiles(sandbox.path);
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
