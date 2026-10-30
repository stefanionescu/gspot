import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { EXTERNAL_COMMAND_GUIDE, EXTERNAL_COMMAND_FINDINGS } from '#tests/config/checks/general/docs.ts';

test('command fences resolve local files at the repository root and skip external repositories, remote endpoints and media types', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        'docs/guide.md': EXTERNAL_COMMAND_GUIDE,
        'src/here.ts': '',
    });
    const findings = await runSandboxCheck(sandbox.path, 'docs/missing-paths');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual(
        EXTERNAL_COMMAND_FINDINGS.map((finding) => ({ file: 'docs/guide.md', rule: 'missing-path', ...finding })),
    );
});

test('Bun runs declared workspace bins before installation and still reports unknown commands', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        'package.json': '{"private":true,"workspaces":["packages/*"]}\n',
        'packages/cli/package.json': '{"name":"@example/cli","bin":{"gspot":"bin/gspot.js"}}\n',
        'packages/single/package.json': '{"name":"@example/single","bin":"bin/single.js"}\n',
        'README.md': 'Run `bun run --no-install gspot init`, `bun run single`, and `bun run --no-install absent`.\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'docs/missing-paths');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'README.md',
            line: 1,
            rule: 'missing-task',
            message: 'bun run --no-install absent names no task or script.',
        },
    ]);
});
