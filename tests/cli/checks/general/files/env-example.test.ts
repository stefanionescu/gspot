import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { envExample } from '#cli/checks/general/files.ts';
import { buildEngineInput } from '#tests/harness/input.ts';

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
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            level: 'all',
            configurations: ['files'],
            dotenv: { templates: ['example.env'], accessor: 'config.$env' },
        }),
    );
    const input = buildEngineInput(await openSession(sandbox.path), 'files/env-example', {
        paths: Object.keys(source),
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
            buildEngineInput(await openSession(sandbox.path), 'files/env-example', { paths: Object.keys(source) }),
        ),
    ).toStrictEqual([]);
});

test('environment reads without a template in their scope remain unchecked', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.env.example': 'KNOWN=value\n',
        'app/source.ts': 'process.env.MISSING;\n',
    });
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['files'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["files"]\n',
        }),
    );
    const input = buildEngineInput(await openSession(sandbox.path), 'files/env-example', {
        scope: 'app',
        paths: ['.env.example', 'app/source.ts'],
    });
    expect(envExample(input)).toStrictEqual([]);
});
