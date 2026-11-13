import { expect, test } from 'bun:test';

import { planChecks } from '#cli/engine/plan/checks.ts';
import { buildCheckSession } from '#cli/engine/run/checks.ts';
import { listCopyFiles } from '#cli/engine/run/tool-runs/configs.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/stale.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a Markdown command run in a copy keeps the config files its manifest writes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });

    const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    const planned = planChecks(session, { stage: 'commit', only: ['markdown/markdownlint'] })[0]!;
    expect(listCopyFiles(session, planned, planned.check.command!)).toStrictEqual([
        'README.md',
        getManifestTarget('markdown', 'markdownlint-cli2.mjs'),
        getManifestTarget('markdown', 'markdownlint.jsonc'),
    ]);
    expect(() => listCopyFiles(session, planned, ['markdownlint-cli2', '{config_file:absent}'])).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining('{config_file:absent}') as string,
        }),
    );
});
