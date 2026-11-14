import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import * as revision from '#cli/engine/copies/revision.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a staged check with nothing staged prints that and exits 0 without copying the index', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': CLEAN_BASH_SCRIPT,
    });
    await applyGeneratedFiles(sandbox.path);
    commitAll(sandbox.path);
    using copies = spyOn(revision, 'copyRevision');
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--staged', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toStrictEqual([]);
    expect(checked.report.notes).toStrictEqual(['Nothing is staged.']);
    const printed = await runGspot(sandbox.path, ['check', '--staged']);
    expect({ code: printed.code, stdout: printed.stdout }).toStrictEqual({ code: 0, stdout: 'Nothing is staged.\n' });
    expect(copies).not.toHaveBeenCalled();
});
