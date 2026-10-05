import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlinkSync, readFileSync } from 'node:fs';
import { readRepository } from '#cli/repository/read.ts';
import { getTooling } from '#cli/configurations/takeover.ts';
import { RUNNER_CASES } from '#tests/config/cli/repository/runners.ts';

test.each(RUNNER_CASES)(
    '$name reports $runner without inventing a runner file',
    async ({ paths, runner, runnerFile }) => {
        await using sandbox = await testdir();
        const tree: Record<string, string> = Object.fromEntries(
            paths.map((path) => [path, path.endsWith('.json') ? '{}\n' : ''] as const),
        );
        tree['source.ts'] = 'export {};\n';
        await createFileTree(sandbox.path, tree);
        const repository = await readRepository(sandbox.path, [], [], []);
        const tooling = getTooling(sandbox.path, repository.files, []);
        expect(tooling.runner).toBe(runner);
        expect(tooling.runnerFile).toBe(runnerFile);
        expect(Object.hasOwn(tooling, 'runnerFile')).toBe(runnerFile !== undefined);
        for (const [path, content] of Object.entries(tree))
            expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(content);
        for (const path of paths) unlinkSync(join(sandbox.path, path));
        const restored = await readRepository(sandbox.path, [], [], []);
        const remaining = getTooling(sandbox.path, restored.files, []);
        expect(remaining.runner).toBe('none');
        expect(Object.hasOwn(remaining, 'runnerFile')).toBe(false);
        expect(readFileSync(join(sandbox.path, 'source.ts'), 'utf8')).toBe('export {};\n');
    },
);
