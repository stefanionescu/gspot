import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('commitlint refuses inactive scope-case options and keeps them when no scopes are named', async () => {
    const tables = '[tools.commitlint.rules]\nscope-case = ["always", "upper-case"]\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown'], { level: 'all', tables, scopes: [{ path: 'web' }] }),
        'web/README.md': '# Web\n',
    });
    commitAll(sandbox.path);
    const session = await openSession(sandbox.path);
    expect(() => {
        buildGeneratedFiles(session);
    }).toThrow(matchFields<GspotError>({ name: 'GspotError', code: 'settings' }));
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['markdown'], { level: 'all', tables }));
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    const target = getManifestTarget('commits', 'commitlint.json');
    const content = generated.files.find(({ path }) => path === target)!.content;
    expect(findValueAt(JSON.parse(content), ['rules', 'scope-case'])).toStrictEqual([2, 'always', 'upper-case']);
});
