import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { MARKERS } from '#cli/config/parsers/formats.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
