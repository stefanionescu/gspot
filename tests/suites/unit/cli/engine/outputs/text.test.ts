import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { outputSchema } from '#cli/schemas/manifests/checks.ts';

test('a grouped finding for a file link that leaves the root reports nothing', () => {
    const output = outputSchema.parse({
        format: 'grouped',
        file_pattern: '^Errors in (?<file>.+)$',
        pattern: String.raw`^\[(?<rule>[A-Z0-9]+)\] (?<message>\S+ \| .*)$`,
    });
    const root = resolve('/repo');
    const stdout = [
        'Errors in docs/a.md',
        `[ERROR] ${pathToFileURL(join(root, 'docs/gone.md')).href} | Cannot find file`,
        `[ERROR] ${pathToFileURL(resolve('/v0.1.0/README.md')).href} | Cannot find file`,
    ].join('\n');
    const check = { runs: 'files' as const, id: 'docs/lychee', help: 'Fix it.', output };
    const findings = parseOutput(check, stdout, '', { root, cwd: root });
    expect(findings.map(({ file }) => file)).toStrictEqual(['docs/a.md']);
});

test('a finding in a check copy that names an installed package or a file outside holds no absolute path', async () => {
    await using sandbox = await testdir({
        'node_modules/vite/index.d.ts': '',
        'outside/types.d.ts': '',
        'repository/node_modules/vite/index.d.ts': '',
        'repository/.gspot-copies/1-copy/src/app.ts': '',
    });
    const output = outputSchema.parse({ format: 'regex', pattern: '^(?<file>[^:]+):(?<message>.+)$' });
    const check = { runs: 'files' as const, id: 'typescript/tsc', help: 'Fix it.', output };
    const repository = join(sandbox.path, 'repository');
    const root = join(repository, '.gspot-copies/1-copy');
    const installed = join(repository, 'node_modules/vite/index.d.ts');
    const stdout = [
        `${installed}:Cannot read ${repository}/package.json`,
        `${join(sandbox.path, 'outside/types.d.ts')}:Outside`,
    ].join('\n');
    expect(parseOutput(check, stdout, '', { root, cwd: root })).toMatchObject([
        { file: 'node_modules/vite/index.d.ts', message: 'Cannot read package.json' },
        { file: '../../../outside/types.d.ts', message: 'Outside' },
    ]);
});
