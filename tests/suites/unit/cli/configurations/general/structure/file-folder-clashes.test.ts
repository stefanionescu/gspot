import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('structure/file-folder-clashes reports file-folder-clash in jobs/turn.sh and passes after the fix', async () => {
    await using sandbox = await createSandbox(BASH_SANDBOX);
    await assertCheckSample(
        sandbox,
        {
            check: 'structure/file-folder-clashes',
            corrected: {
                files: {
                    'jobs/turned.sh': CLEAN_BASH_SCRIPT,
                    'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
                },
            },
            files: {
                'jobs/turn.sh': CLEAN_BASH_SCRIPT,
                'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
            },
            expected: {
                file: 'jobs/turn.sh',
                rule: 'file-folder-clash',
                line: 1,
            },
        },
        BASH_SANDBOX.cleanSource,
    );
});

test('a Markdown file with an upper-case extension beside a folder of its name is not a clash', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'guide.MD': '# Guide\n',
        'guide/setup.ts': '',
        'guide/usage.ts': '',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/file-folder-clashes')).toStrictEqual([]);
});
