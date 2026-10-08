import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { exportTemplate } from '#cli/policy/templates.ts';
import { emitPolicy, parseTomlText } from '#cli/policy/file.ts';
import { reconcileConfigurations } from '#cli/lifecycle/reconcile.ts';
import { REFERENCE_FILES, GENERATED_SELECTIONS } from '#tests/config/cli/repository/generated.ts';

test.each(GENERATED_SELECTIONS)(
    'selected configurations classify their declared files: $configurations $tables',
    async ({ configurations, tables, generated }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(configurations, { tables }),
            ...REFERENCE_FILES,
        });
        const session = await openSession(sandbox.path);
        const classified = session.repository.files.filter(({ path }) => path.endsWith('.d.ts'));
        expect(
            classified
                .filter(({ kind }) => kind === 'generated')
                .map(({ path }) => path)
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(generated.toSorted((left, right) => left.localeCompare(right)));
        expect(
            classified.filter(({ path }) => path.endsWith('handwritten.d.ts')).map(({ kind }) => kind),
        ).toStrictEqual(['source', 'source']);
    },
);

test('authored declarations and Git attributes precede configuration-generated paths', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['nextjs', 'cloudflare'], {
            tables: '[[vendored]]\npaths = ["next-env.d.ts"]\nreason = "The upstream declaration stays unchanged."\n[scope."app"]\nconfigurations = ["nextjs", "cloudflare"]',
        }),
        ...REFERENCE_FILES,
        '.gitattributes':
            'worker-configuration.d.ts linguist-vendored\napp/next-env.d.ts -text\napp/worker-configuration.d.ts !linguist-vendored\n',
    });
    const session = await openSession(sandbox.path);
    const files = new Map(session.repository.files.map((file) => [file.path, file]));
    expect(files.get('next-env.d.ts')).toMatchObject({ kind: 'vendored', kindSource: 'vendored' });
    expect(files.get('worker-configuration.d.ts')).toMatchObject({ kind: 'vendored', kindSource: '.gitattributes' });
    expect(files.get('app/next-env.d.ts')).toMatchObject({ kind: 'binary', kindSource: '.gitattributes' });
    expect(files.get('app/worker-configuration.d.ts')).toMatchObject({ kind: 'generated', kindSource: 'cloudflare' });
});

test('a native fixer refresh retains configuration-generated paths without exporting internal declarations', async () => {
    const text = 'configurations=["nextjs","cloudflare"]\n[scope."app"]\nconfigurations=["nextjs","cloudflare"]\n';
    await using sandbox = await testdir({ 'gspot.toml': text, ...REFERENCE_FILES });
    const session = await openSession(sandbox.path);
    const before = session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path);
    expect(before).toHaveLength(4);
    const report = await executeRun(session, buildRunOptions({ only: ['gspot/policy-layout'], fix: true }));
    expect(report.report.checks.find(({ check }) => check === 'gspot/policy-layout')?.status).toBe('passed');
    expect(report.fixes?.changed).toContain('gspot.toml');
    expect(session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path)).toStrictEqual(
        before,
    );
    const authored = parseTomlText(text, 'gspot.toml', 'policy');
    const canonical = emitPolicy(text, authored);
    expect(canonical).not.toContain('[[generated]]');
    expect(canonical).not.toContain('configuration =');
    const template = exportTemplate(text, 'web.gspot-template.toml').text;
    expect(template).not.toContain('[[generated]]');
    expect(template).not.toContain('configuration =');
    reconcileConfigurations(session).mutate(authored);
    expect(authored['generated']).toBeUndefined();
    expect(authored['declarations']).toBeUndefined();
    expect(session.policyFiles.text).toBe(text);
});
