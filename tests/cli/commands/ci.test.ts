import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { gitOutput } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import type { InitJson } from '#cli/types/commands/init.ts';
import { buildInitArguments } from '#tests/harness/init.ts';

// Each row names the provider init proposes and the note or file its plan must carry.
test.each([
    [
        '.github/workflows/application.yml',
        'on: push\njobs:\n  application:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo app\n',
        'git@gitlab.com:example/project.git',
        'github',
        '.github/workflows/gspot.yml',
    ],
    [
        '.gitlab-ci.yml',
        'lint:\n  script: npm run lint\n',
        'git@github.com:example/project.git',
        'none',
        'no duplicate CI job',
    ],
    [
        '.github/workflows/application.yml',
        'on: push\njobs:\n  quality:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm run lint\n',
        'git@gitlab.com:example/project.git',
        'none',
        'no duplicate CI job',
    ],
] as const)(
    'init plan for %s names retained jobs and the applicable workflow',
    async (path, content, remote, provider, note) => {
        await using repository = await testdir();
        await createFileTree(repository.path, { [path]: content });
        gitOutput(repository.path, ['init', '-q']);
        gitOutput(repository.path, ['remote', 'add', 'origin', remote]);
        const result = await runGspot(repository.path, [
            ...buildInitArguments(['none'], { json: true, ci: null }),
            '--dry-run',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const plan = JSON.parse(result.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
        expect(/provider = "(\w+)"/u.exec(plan.policy)?.[1] ?? 'none').toBe(provider);
        expect(JSON.stringify(plan.plan)).toContain(note);
        expect(await readFile(join(repository.path, path), 'utf8')).toBe(content);
        expect(await Bun.file(join(repository.path, 'gspot.toml')).exists()).toBe(false);
    },
);
