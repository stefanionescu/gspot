import { test, expect } from 'bun:test';
import { git } from '#tests/support/cli/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { checkInput } from '#tests/support/cli/input.ts';
import { envFiles } from '#cli/checks/security/env/files.ts';
import { refusalFor } from '#cli/commands/check/selection.ts';
import type { CheckOptions } from '#cli/types/commands/check.ts';
import { envExample } from '#cli/checks/security/env/example.ts';

test('staged refusal and tracked-file checks agree on environment files and templates in nested folders', async () => {
    await using directory = await testdir();
    const privateFiles = ['.env', '.env.local', 'nested/.dev.vars', 'nested/.dev.vars.production'];
    const templates = ['.env.example', '.env.template', 'nested/.env.sample', 'nested/.dev.vars.example'];
    await createFileTree(
        directory.path,
        Object.fromEntries([...privateFiles, ...templates].map((path) => [path, 'EXAMPLE=value\n'])),
    );
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-f', '.']).code).toBe(0);
    const input = await checkInput(directory.path, 'integrity/env-files', [], { kits: ['secrets'] });
    expect(envFiles(input).map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        privateFiles.map((file) => ({ file, rule: 'tracked-environment-file' })),
    );
    const options: CheckOptions = {
        cwd: directory.path,
        paths: [],
        staged: true,
        fix: false,
        isDryRun: false,
        skips: [],
        quiet: true,
        verbose: false,
        noCache: true,
    };
    const refused = refusalFor(options, 'commit', [...privateFiles, ...templates]);
    expect(refused?.exitCode).toBe(1);
    expect(refused?.json).toStrictEqual({ failed: ['integrity/env-files'], files: privateFiles });
    expect(refusalFor(options, 'commit', templates)).toBeUndefined();
});

test('environment templates preserve first missing reads per file and escaped custom accessors', async () => {
    await using sandbox = await testdir();
    const source = {
        'config/example.env': 'export KNOWN=example\n# ignored\n',
        'src/first.ts':
            'process.env.KNOWN; process.env.MISSING; process.env["MISSING"];\nconfig.$env("CUSTOM");\nprocess.env.MISSING;\n',
        'src/second.py': 'os.environ["MISSING"]; os.getenv("OTHER");\nos.environ.get("OTHER");\n',
        'src/ignored.txt': 'process.env.TEXT\n',
    };
    await createFileTree(sandbox.path, source);
    const input = await checkInput(sandbox.path, 'configs/env-example', Object.keys(source), {
        kits: ['configs'],
        tools: { dotenv: { templates: ['example.env'], accessor: 'config.$env' } },
    });
    expect(envExample(input).map(({ file, line, message: diagnostic }) => ({ file, line, diagnostic }))).toStrictEqual([
        { file: 'src/first.ts', line: 1, diagnostic: 'MISSING is read here and appears in no environment template.' },
        { file: 'src/first.ts', line: 2, diagnostic: 'CUSTOM is read here and appears in no environment template.' },
        { file: 'src/second.py', line: 1, diagnostic: 'MISSING is read here and appears in no environment template.' },
        { file: 'src/second.py', line: 1, diagnostic: 'OTHER is read here and appears in no environment template.' },
    ]);
    await Bun.write(`${sandbox.path}/config/example.env`, 'KNOWN=value\nMISSING=value\nCUSTOM=value\nOTHER=value\n');
    expect(
        envExample(
            await checkInput(sandbox.path, 'configs/env-example', Object.keys(source), {
                kits: ['configs'],
                tools: { dotenv: { templates: ['example.env'], accessor: 'config.$env' } },
            }),
        ),
    ).toStrictEqual([]);
});

test('environment reads without a template in their scope remain unchecked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
    });
    const input = await checkInput(sandbox.path, 'configs/env-example', ['.env.example', 'app/source.ts'], {
        kits: ['configs'],
    });
    input.scope = 'app';
    expect(envExample(input)).toStrictEqual([]);
});
