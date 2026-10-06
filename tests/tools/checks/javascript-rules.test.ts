import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { rulesOff } from '#cli/checks/language/javascript/rules-off.ts';

import {
    REQUIRED_RULE_FILES,
    REQUIRED_RULE_MESSAGES,
    REQUIRED_RULE_OVERRIDE,
    FRAMEWORK_RULE_OVERRIDE,
} from '#tests/config/tools/checks/javascript-rules.ts';

test.each(['recommended', 'all'] as const)(
    '%s audits every language ending and Node script in its own scope',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...REQUIRED_RULE_FILES,
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[[scope]]\npath = "child"\nconfigurations = ["javascript"]\n',
            }),
        });
        await createEslint(sandbox.path);
        const session = await openSession(sandbox.path);
        const input = buildEngineInput(session, 'javascript/rules-off');
        const config = join(sandbox.path, '.gspot/config/eslint.config.mjs');
        const generated = readFileSync(config, 'utf8');
        chmodSync(config, 0o644);
        expect(await rulesOff(input)).toStrictEqual([]);
        writeFileSync(join(sandbox.path, '.gspot/config/base.mjs'), generated);
        writeFileSync(config, REQUIRED_RULE_OVERRIDE);
        const findings = await rulesOff(input);
        expect(
            findings.map(({ message }) => message).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(
            [
                REQUIRED_RULE_MESSAGES.eqeqeq,
                REQUIRED_RULE_MESSAGES.typed,
                ...(level === 'all' ? [REQUIRED_RULE_MESSAGES.declarations] : []),
            ].toSorted((left, right) => left.localeCompare(right)),
        );
        expect(
            findings.every(
                ({ check, file, line, rule, fixable }) =>
                    check === 'javascript/rules-off' &&
                    file === '.gspot/config/eslint.config.mjs' &&
                    line === 1 &&
                    rule === 'rule-off' &&
                    !fixable,
            ),
        ).toBe(true);
        const child = await rulesOff(buildEngineInput(session, 'javascript/rules-off', { scope: 'child' }));
        expect(child.map(({ message }) => message).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            [
                'Enable eqeqeq for 1 file (child/source.js). The javascript configuration requires this rule.',
                ...(level === 'all'
                    ? [
                          'Enable import-x/exports-last for 1 file (child/source.js). The javascript configuration requires this rule.',
                      ]
                    : []),
            ].toSorted((left, right) => left.localeCompare(right)),
        );
        writeFileSync(config, generated);
        expect(await rulesOff(input)).toStrictEqual([]);
        expect(await rulesOff(buildEngineInput(session, 'javascript/rules-off', { scope: 'child' }))).toStrictEqual([]);
    },
);

test('native coverage retains framework requirements alongside shared language requirements', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'react']),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx"}}\n',
        'source.jsx': 'export const value = 1;\n',
        'source.tsx': 'export const value = 1;\n',
    });
    await createEslint(sandbox.path);
    const input = buildEngineInput(await openSession(sandbox.path), 'javascript/rules-off');
    const config = join(sandbox.path, '.gspot/config/eslint.config.mjs');
    const generated = readFileSync(config, 'utf8');
    chmodSync(config, 0o644);
    expect(await rulesOff(input)).toStrictEqual([]);
    writeFileSync(join(sandbox.path, '.gspot/config/base.mjs'), generated);
    writeFileSync(config, FRAMEWORK_RULE_OVERRIDE);
    const findings = await rulesOff(input);
    expect(findings.map(({ message }) => message).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'Enable eqeqeq for 2 files (source.jsx, source.tsx). The javascript configuration requires this rule.',
        'Enable react-hooks/rules-of-hooks for 2 files (source.jsx, source.tsx). The react configuration requires this rule.',
    ]);
    writeFileSync(config, generated);
    expect(await rulesOff(input)).toStrictEqual([]);
});

test('native coverage respects a reasoned rule exception without suppressing other requirements', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...REQUIRED_RULE_FILES,
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[[ignore]]\ncheck = "javascript/eslint"\nrule = "eqeqeq"\nreason = "The fixture verifies an accepted equality rule exception."\n',
        }),
    });
    await createEslint(sandbox.path);
    const input = buildEngineInput(await openSession(sandbox.path), 'javascript/rules-off');
    const config = join(sandbox.path, '.gspot/config/eslint.config.mjs');
    const generated = readFileSync(config, 'utf8');
    chmodSync(config, 0o644);
    expect(await rulesOff(input)).toStrictEqual([]);
    writeFileSync(join(sandbox.path, '.gspot/config/base.mjs'), generated);
    writeFileSync(config, REQUIRED_RULE_OVERRIDE);
    const findings = await rulesOff(input);
    expect(findings.map(({ message }) => message)).toStrictEqual([REQUIRED_RULE_MESSAGES.typed]);
    writeFileSync(config, generated);
    expect(await rulesOff(input)).toStrictEqual([]);
});
