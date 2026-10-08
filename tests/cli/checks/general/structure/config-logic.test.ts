// The repository-shape integrity analyses: suppressions, policy patterns, large files, and configuration purity.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { REPOSITORY_SHAPE_POLICY } from '#tests/config/samples/structure.ts';
import { configurationLogic } from '#cli/checks/general/structure/config-logic.ts';

test('a configuration module with a function or a call is reported; literals pass', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'config/pure.ts':
            "import type { X } from '#types/x.ts';\n\nexport const NAMES: X[] = ['a'];\nexport const PATTERN = /a/u;\nexport const RAW = String.raw`\\d+`;\n",
        'config/logic.ts':
            "import { readFileSync } from 'node:fs';\n\nexport const text = readFileSync('x', 'utf8');\nexport const pick = (value: string): string => value;\n",
    });
    const paths = ['config/pure.ts', 'config/logic.ts'];
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...REPOSITORY_SHAPE_POLICY }));
    const found = await configurationLogic(
        buildCheckInput(await openSession(sandbox.path), 'structure/config-logic', { paths: paths }),
    );
    expect(found.map((finding) => `${finding.file}:${String(finding.line)}`)).toStrictEqual([
        'config/logic.ts:1',
        'config/logic.ts:3',
        'config/logic.ts:4',
    ]);
});

test('configuration imports follow project aliases and reject runtime owners', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': JSON.stringify({
            compilerOptions: { paths: { '#data/*': ['./config/*'], '#feature/*': ['./feature/*'] } },
        }),
        'config/data.ts': 'export const COUNT = 3;\n',
        'config/linked.ts': "import { COUNT } from '#data/data.ts';\nexport const LIMIT = COUNT;\n",
        'config/outside.ts': "import { COUNT } from '#feature/data.ts';\nexport const LIMIT = COUNT;\n",
        'feature/data.ts': 'export const COUNT = 3;\n',
    });
    const paths = ['config/data.ts', 'config/linked.ts', 'config/outside.ts', 'feature/data.ts'];
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...REPOSITORY_SHAPE_POLICY }));
    const findings = await configurationLogic(
        buildCheckInput(await openSession(sandbox.path), 'structure/config-logic', { paths: paths }),
    );
    expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toStrictEqual([
        ['config/outside.ts', 1, 'config-logic'],
    ]);
});
