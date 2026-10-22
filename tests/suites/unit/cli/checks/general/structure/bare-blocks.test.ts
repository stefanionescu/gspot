import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SWIFT_BARE_BLOCKS, SWIFT_BLOCKS_FIXED } from '#tests/config/checks/general/structure/bare-blocks.ts';

test('a Swift do block without catch is reported, and a do block with catch is not', async () => {
    await using sandbox = await testdir({
        'Sources/Report.swift': SWIFT_BARE_BLOCKS,
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/bare-blocks');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'Sources/Report.swift', line: 2, rule: 'bare-block' },
        { file: 'Sources/Report.swift', line: 11, rule: 'bare-block' },
    ]);
    await writeFile(`${sandbox.path}/Sources/Report.swift`, SWIFT_BLOCKS_FIXED);
    expect(await runSandboxCheck(sandbox.path, 'structure/bare-blocks')).toStrictEqual([]);
});
