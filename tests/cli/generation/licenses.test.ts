import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';

test('license configuration retains scoped exceptions and inherited license allowances', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true}',
        'app/pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\n',
        'app/child/pyproject.toml': '[project]\nname = "child"\nversion = "1.0.0"\n',
        'sibling/pyproject.toml': '[project]\nname = "sibling"\nversion = "1.0.0"\n',
        'app/child/source.py': 'selected = True\n',
        'sibling/source.py': 'selected = True\n',
        'gspot.toml': buildPolicy(['licenses'], {
            tables: '[licenses]\nallowed = ["MPL-2.0"]\n[scope."app"]\n[scope."app".licenses.exceptions."example@1.2.3"]\nlicense = "BSD"\nreason = "Reviewed installed metadata."\n[scope."app/child"]\n[scope."sibling"]\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const generated = emitAll(session);
    const parsed = new Map(session.scopes.map(({ scope, view }) => [scope.path, view.options('licenses')]));
    expect(generated.files.some(({ path }) => path.endsWith('/licenses.json'))).toBe(false);
    expect(parsed.size).toBe(4);
    for (const path of ['', 'app', 'app/child', 'sibling']) expect(parsed.get(path)!.allowed).toContain('MPL-2.0');
    for (const path of ['app', 'app/child'])
        expect(parsed.get(path)!.exceptions).toStrictEqual({
            'example@1.2.3': { license: 'BSD', reason: 'Reviewed installed metadata.' },
        });
    for (const path of ['', 'sibling']) expect(parsed.get(path)!.exceptions).toStrictEqual({});
});

test.each([{ configurations: ['licenses'] }, { configurations: [] }])(
    'exceptions alone activate descendant license tools without a root manifest: $configurations',
    async ({ configurations }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy([...configurations], {
                tables: '[licenses.exceptions."example@1.0.0"]\nlicense = "MIT"\nreason = "Reviewed installed metadata."\n[scope."docs"]\nconfigurations = ["licenses"]\n',
            }),
            'docs/package.json': '{"name":"docs","private":true}',
        });
        const session = await openSession(sandbox.path);
        const generated = emitAll(session);
        expect(generated.files.some(({ path }) => path.endsWith('/licenses.json'))).toBe(false);
        expect(
            session.scopes.find(({ scope }) => scope.path === 'docs')!.view.options('licenses').exceptions,
        ).toStrictEqual({ 'example@1.0.0': { license: 'MIT', reason: 'Reviewed installed metadata.' } });
        expect(generated.files.find(({ path }) => path === '.gspot/package.json')?.content).toContain(
            'license-checker-rseidelsohn',
        );
        expect(generated.files.find(({ path }) => path === '.gspot/pyproject.toml')).toBeUndefined();
    },
);
