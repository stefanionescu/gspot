import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/typescript.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { join, parse, dirname, resolve, relative } from 'node:path';
import { writeScopeTsconfig } from '#cli/checks/tsc/scope-tsconfig.ts';
import { DEFAULT_TSCONFIG_PROJECTS } from '#tests/config/checks/tsc.ts';
import { IMPLICIT_RETURNS_IGNORE } from '#tests/config/checks/language/typescript.ts';

test('a project with its own tsconfig.json gets a tsconfig that extends it and adds only typeRoots', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            tables: IMPLICIT_RETURNS_IGNORE,
            level: 'all',
        }),
        'source.ts': 'export const value = 1;',
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
    });

    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const path = join(sandbox.path, GSPOT_PATHS.state, 'tsconfig.json');
    writeScopeTsconfig(session, scope, path);
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
            tables: IMPLICIT_RETURNS_IGNORE,
            scopes: [{ path: 'service', configurations: ['nestjs'] }],
        }),
        'source.ts': 'export const port = 8080;\n',
        'service/source.ts': 'export const port = 3000;\n',
    });
    const toolsRoot = parse(sandbox.path).root;
    const session = await openSession(sandbox.path, { toolsRoot: toolsRoot });
    const projects = await Promise.all(
        session.scopes.map(async (scope) => {
            const path = join(sandbox.path, GSPOT_PATHS.state, scope.folder.path, 'tsconfig.json');
            writeScopeTsconfig(session, scope, path);
            const config = parseJsonFile(path, await readFile(path, 'utf8'));
            const compilerOptions = config['compilerOptions'] as Record<string, unknown>;
            compilerOptions['typeRoots'] = (compilerOptions['typeRoots'] as string[]).map((root) => {
                const found = relative(toolsRoot, resolve(dirname(path), root));
                return convertToPosixPath(found);
            });
            return { scope: scope.folder.path, config };
        }),
    );
    expect(projects).toStrictEqual([...DEFAULT_TSCONFIG_PROJECTS]);
});
