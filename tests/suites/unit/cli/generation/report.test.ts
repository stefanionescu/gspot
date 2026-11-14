import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { listInstallNotes } from '#cli/generation/report.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { TOOLS_CHANGED_NOTE, STALE_LOCKFILE_NOTE } from '#cli/config/generation/files.ts';

test('the install notes name changed tools after the first write, and a missing lockfile after a repeated one', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true}',
    });
    const session = await openSession(sandbox.path);
    const writer = openFiles(sandbox.path);
    const generated = buildGeneratedFiles(session);
    const first = await writeGeneratedFiles(session, generated, writer);
    expect(await listInstallNotes(session, generated, first)).toStrictEqual([TOOLS_CHANGED_NOTE]);
    const repeated = await writeGeneratedFiles(session, generated, writer);
    expect(await listInstallNotes(session, generated, repeated)).toStrictEqual([STALE_LOCKFILE_NOTE]);
});
