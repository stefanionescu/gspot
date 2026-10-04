// A tool config and its pointer exist only where an enabled check consumes the tool.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { configuredChecks } from '#cli/execution/planning/plan.ts';

import {
    EDITORCONFIG_POLICY,
    SWIFT_FORMAT_POLICY,
    NESTED_PYTHON_POLICY,
} from '#tests/config/cli/generation/config-consumers.ts';

test('a sibling type checker does not generate its config or pointer in a Ruff-only Python scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_PYTHON_POLICY,
        'linted/source.py': 'value = 1\n',
        'typed/source.py': 'value: int = 1\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/linted/ruff.toml');
    expect(paths).not.toContain('.gspot/config/linted/basedpyrightconfig.json');
    expect(paths).not.toContain('linted/pyrightconfig.json');
    expect(paths).toContain('.gspot/config/typed/ruff.toml');
    expect(paths).toContain('.gspot/config/typed/basedpyrightconfig.json');
    expect(paths).toContain('typed/pyrightconfig.json');
});

test('TypeScript-only input activates Knip and does not generate an unused JavaScript compiler config', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["typescript"]\n[agent_rules]\nenabled = false\n',
        'src/main.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const paths = emitAll(session).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/tsconfig.json');
    expect(paths).toContain('.gspot/config/knip.json');
    expect(paths).not.toContain('.gspot/config/jsconfig.json');
    expect(configuredChecks(session).map((check) => check.spec.name)).toContain('javascript/knip');
    expect(configuredChecks(session).map((check) => check.spec.name)).toContain('javascript/rules-off');
});

test('ignoring SwiftLint and Periphery retains SwiftFormat without their config files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SWIFT_FORMAT_POLICY,
        'main.swift': 'let value = 1\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.gspot/config/swiftformat');
    expect(paths).not.toContain('.gspot/config/swiftlint.yml');
    expect(paths).not.toContain('.gspot/config/periphery.yml');
    expect(paths).not.toContain('.gspot/package.json');
});

test('EditorConfig can remain active without generating a Prettier config or ignore file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EDITORCONFIG_POLICY,
        'sample.json': '{"value":1}\n',
    });
    const paths = emitAll(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths).toContain('.editorconfig');
    expect(paths).not.toContain('.gspot/config/prettier.json');
    expect(paths).not.toContain('.prettierignore');
});
