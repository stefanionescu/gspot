import { join } from 'node:path';
import stylelint from 'stylelint';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { readFileSync, symlinkSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { STYLELINT_TOOLING } from '#tests/constants/support/cli.ts';

test.each([false, true])(
    'Stylelint adoption preserves enabled options, zero limits, and disabled rules for future files (inherited: %s)',
    async (inherited) => {
        await using sandbox = await testdir();
        const rules = {
            'color-named': ['never', { ignore: ['inside-function'] }],
            'selector-max-id': 0,
            'color-no-invalid-hex': null,
            'block-no-empty': [null],
        };
        const original =
            JSON.stringify(
                inherited
                    ? { extends: ['./config/base.json', './config/override.yml'], rules: { 'selector-max-id': 0 } }
                    : { rules },
            ) + '\n';
        await createFileTree(sandbox.path, {
            '.stylelintrc.json': original,
            'package.json': '{"private":true}\n',
            ...(inherited
                ? {
                      'config/base.json': JSON.stringify({
                          rules: { ...rules, 'color-named': 'always-where-possible', 'selector-max-id': 2 },
                      }),
                      'config/override.yml':
                          'extends: ./shared/leaf.json\nrules:\n  color-named: [never, {ignore: [inside-function]}]\n',
                      'config/shared/leaf.json': '{"rules":{"selector-max-id":1}}\n',
                  }
                : {}),
        });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        const carried = await collectCarried(sandbox.path, STYLELINT_TOOLING, new Set(['css']), []);
        expect(carried.unread).toStrictEqual([]);
        expect(carried.removed.map((entry) => entry.path)).toStrictEqual(['.stylelintrc.json']);
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            stringify({
                version: 1,
                level: 'all',
                configurations: ['css'],
                rules: { install: false },
                tools: { stylelint: carried.tools.get('stylelint')!.settings },
                ignore: carried.tools.get('stylelint')!.ignores,
            }),
        );
        const session = await openSession(sandbox.path);
        const generated = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }).files.find((file) => file.path === '.gspot/config/stylelint.json')!;
        for (const code of ['#example { color: red; }', 'a { color: #abc; }', 'a { color: #ggg; }', 'a {}']) {
            const before = await stylelint.lint({ code, configFile: join(sandbox.path, '.stylelintrc.json') });
            const after = await stylelint.lint({
                code,
                codeFilename: join(sandbox.path, 'future.css'),
                config: JSON.parse(generated.content),
                configBasedir: sandbox.path,
            });
            const findings = after.results
                .flatMap((result) => result.warnings)
                .filter((warning) => Object.hasOwn(rules, warning.rule));
            expect(findings).toHaveLength(code.startsWith('#') ? 2 : 0);
            expect(findings.map(({ rule, line, column }) => ({ rule, line, column }))).toStrictEqual(
                before.results
                    .flatMap((result) => result.warnings)
                    .map(({ rule, line, column }) => ({ rule, line, column })),
            );
            expect(after.results.flatMap((result) => result.invalidOptionWarnings)).toStrictEqual([]);
        }
        expect(readFileSync(join(sandbox.path, '.stylelintrc.json'), 'utf8')).toBe(original);
    },
);
