import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createSandbox } from '@gspot/testing';
import type { ExistingTooling } from '#types/repository.ts';
import { collectCarried } from '#cli/lifecycle/takeover.ts';
import { askInitQuestions } from '#cli/lifecycle/questions.ts';

const tooling: ExistingTooling = {
    configs: [{ tool: 'prettier', path: '.prettierrc.json' }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};

test('formatter choices use the captured observation and a fresh failed observation is retained', async () => {
    await using sandbox = await createSandbox({ '.prettierrc.json': '{"semi":false,"tabWidth":8}\n' });
    const carried = collectCarried(sandbox.path, tooling, new Set(['formatting']));
    expect(carried.unread).toEqual([]);
    await Bun.write(join(sandbox.path, '.prettierrc.json'), 'invalid JSON');
    const answers = await askInitQuestions(
        sandbox.path,
        {
            cwd: sandbox.path,
            yes: true,
            isDryRun: true,
            json: false,
            install: false,
            allowDirty: false,
            hooks: 'none',
            ci: 'none',
            runner: 'none',
            rules: 'no',
            format: 'keep',
        },
        tooling,
        carried.formatSource,
    );
    expect(answers.format).toEqual({ indent_width: 8, semicolons: false });
    const refreshed = collectCarried(sandbox.path, tooling, new Set(['formatting']));
    expect(refreshed.unread.map((entry) => entry.path)).toEqual(['.prettierrc.json']);
    expect(refreshed.removed).toEqual([]);
});
