import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { findMissingDependencies } from '#cli/tools/missing.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a check that needs the dependencies of its scope is missing until its folder or one around it holds node_modules, and a scope of only gspot packages needs none', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'package.json': '{"private":true,"type":"module","dependencies":{"zod":"4.0.0"}}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'source.ts': 'export const value = 1;\n',
        'app/package.json': '{"private":true,"dependencies":{"zod":"4.0.0"}}',
        'tools/package.json': '{"private":true,"devDependencies":{"@gspothq/cli":"0.0.0-test"}}',
    });
    const session = await openSession(sandbox.path);
    const planned = session.configuredChecks.find(({ check }) => check.id === 'typescript/tsc')!;
    const planIn = (path: string) => ({ check: planned.check, scope: { ...planned.scope, path } });
    expect(findMissingDependencies(session, planned)).toStrictEqual({
        status: 'missing',
        note: 'Install the project dependencies first: node_modules is missing in the repository root.',
    });
    expect(findMissingDependencies(session, planIn('app'))).toMatchObject({ status: 'missing' });
    expect(findMissingDependencies(session, planIn('tools'))).toBeUndefined();
    await mkdir(join(sandbox.path, 'node_modules'));
    expect(findMissingDependencies(session, planned)).toBeUndefined();
    expect(findMissingDependencies(session, planIn('app'))).toBeUndefined();
});
