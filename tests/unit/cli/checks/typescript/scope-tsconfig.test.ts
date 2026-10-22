import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writeScopeTsconfig } from '#cli/checks/typescript/scope-tsconfig.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/data/checks/typescript/projects.ts';

test('a project with its own tsconfig.json gets a tsconfig that extends it and adds only typeRoots', async () => {
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
        session.scopes.map(async (scope) => {
            const path = writeScopeTsconfig(
                session,
                scope,
                join(sandbox.path, '.gspot/state', scope.folder.path, 'tsconfig.json'),
            );
            return { scope: scope.folder.path, config: parseJsonFile(path, await readFile(path, 'utf8')) };
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
