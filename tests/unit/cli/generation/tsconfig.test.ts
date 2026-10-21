import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { writeScopeTsconfig } from '#cli/checks/typescript/compiler.ts';
import { MALFORMED_TSCONFIGS, STRICT_TSCONFIG_TEXT } from '#tests/data/checks/typescript/projects.ts';

test.each(MALFORMED_TSCONFIGS)(
    'a malformed tsconfig.json fails with its path and reason: %s',
    async (content, detail) => {
        await using sandbox = await testdir({
            'tsconfig.json': content,
            'gspot.toml': buildSandboxSettings(['typescript']),
            'source.ts': 'export const value = 1;\n',
        });

        const session = await openSession(sandbox.path);
        expect(() =>
            writeScopeTsconfig(session, session.scopes[0]!, join(sandbox.path, '.gspot/state/tsconfig.json')),
        ).toThrow(`Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}: ${detail}`);
    },
);

test('an authored project extends its own compiler options without forcing required options', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            tables: '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n',
            level: 'all',
        }),
        'source.ts': 'export const value = 1;',
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
    });

    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const path = writeScopeTsconfig(session, scope, join(sandbox.path, '.gspot/state/tsconfig.json'));
    const parsed = parseJsonFile(path, await readFile(path, 'utf8'));
    expect(parsed).toMatchObject({
        extends: '../../tsconfig.json',
    });
    expect(Object.keys(parsed['compilerOptions']!)).toStrictEqual(['typeRoots']);
});

test('projects without tsconfig.json get required options and framework options only in their scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n',
            scopes: [{ path: 'service', configurations: ['nestjs'] }],
        }),
        'source.ts': 'export const port = 8080;\n',
        'service/source.ts': 'export const port = 3000;\n',
    });
    const session = await openSession(sandbox.path);
    const projects = await Promise.all(
        session.scopes.map(async (selection) => {
            const path = writeScopeTsconfig(
                session,
                selection,
                join(sandbox.path, '.gspot/state', selection.scope.path, 'tsconfig.json'),
            );
            return { scope: selection.scope.path, config: parseJsonFile(path, await readFile(path, 'utf8')) };
        }),
    );
    for (const { config } of projects) {
        expect(config).toHaveProperty('compilerOptions.strict', true);
        expect(config).not.toHaveProperty('compilerOptions.noImplicitReturns');
    }
    expect(projects.find(({ scope }) => scope === 'service')?.config).toHaveProperty(
        'compilerOptions.experimentalDecorators',
        true,
    );
    expect(projects.find(({ scope }) => scope === '')?.config).not.toHaveProperty(
        'compilerOptions.experimentalDecorators',
    );
});
