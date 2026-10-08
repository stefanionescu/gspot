// Native file readers report positioned findings and pass after independent fixes.
import { join } from 'node:path';
import { git } from '#tests/harness/git.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import type { RunReport } from '#cli/types/execution/check.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { REPOSITORY } from '#tests/config/tools/configurations/general/files.ts';
import { createTestRepository, prepareTestRepository, preserveRepositoryChanges } from '#tests/harness/repository.ts';

const resources = new AsyncDisposableStack();
let testRepository: OwnedTestRepository;
beforeAll(async () => {
    testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot, prepareTestRepository));
});
afterAll(async () => {
    await resources.disposeAsync();
});
test('Taplo preserves default spacing across levels and accepts authored inline formatting', async () => {
    const { root, environment } = testRepository;
    await using state = new AsyncDisposableStack();
    state.use(
        await preserveRepositoryChanges(testRepository, {
            check: 'files/taplo-format',
            files: { 'settings/inline.toml': '' },
        }),
    );
    const path = join(root, 'settings/inline.toml');
    const command = ['check', 'settings/inline.toml', '--only', 'files/taplo-format', '--json'];
    for (const level of ['recommended', 'all', 'recommended']) {
        const selected = await spawnGspot(root, ['set', 'level', level], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await Bun.write(path, 'entry={key=true}\n');
        const fixed = await spawnGspot(root, [...command, '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(path).text()).toBe('entry = { key = true }\n');
        const checked = await spawnGspot(root, command, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/taplo-format', status: 'passed', findings: [] },
        ]);
    }
});

test('Taplo applies authored native inline formatting and returns to its default', async () => {
    const { root, environment } = testRepository;
    await using state = new AsyncDisposableStack();
    state.use(
        await preserveRepositoryChanges(testRepository, {
            check: 'files/taplo-format',
            files: { 'settings/inline.toml': 'entry = { key = true }\n' },
        }),
    );
    const path = join(root, 'settings/inline.toml');
    const command = ['check', 'settings/inline.toml', '--only', 'files/taplo-format', '--json'];
    const policyPath = join(root, 'gspot.toml');
    const policy = await Bun.file(policyPath).text();
    await Bun.write(
        policyPath,
        policy +
            '\n[tools.taplo.verbatim]\ncompact_inline_tables = true\n[reasons]\n"tools.taplo.verbatim" = "The project uses compact inline tables in TOML."\n',
    );
    const setting = await spawnGspot(root, ['apply'], environment);
    expect(setting.code, setting.stdout + setting.stderr).toBe(0);
    const rejected = await spawnGspot(root, command, environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect((JSON.parse(rejected.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/taplo-format', status: 'failed', findings: [{ file: 'settings/inline.toml' }] },
    ]);
    const fixed = await spawnGspot(root, [...command, '--fix'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(path).text()).toBe('entry = {key = true}\n');
    await Bun.write(policyPath, policy);
    const reset = await spawnGspot(root, ['apply'], environment);
    expect(reset.code, reset.stdout + reset.stderr).toBe(0);
    const selected = await spawnGspot(root, ['set', 'level', 'all'], environment);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
});
test('Schema validation finds nested Unicode paths through the real tool', async () => {
    const { root, environment } = testRepository;
    await using state = new AsyncDisposableStack();
    state.use(
        await preserveRepositoryChanges(testRepository, {
            check: 'files/v8r',
            files: { 'settings/café.json': '', '.v8rrc.yml': '' },
        }),
    );
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch() {
            return new Response(Bun.file(join(root, 'schema.json')));
        },
    });
    state.defer(async () => {
        await server.stop(true);
    });
    const mapping = JSON.stringify({ 'settings/café.json': `${server.url.toString()}schema.json` });
    const setting = await spawnGspot(root, ['set', 'tools.v8r.schemas', mapping], environment);
    expect(setting.code, setting.stdout + setting.stderr).toBe(0);
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    // A conflicting authored config must not replace the generated configuration.
    await Bun.write(join(root, '.v8rrc.yml'), 'invalid: [\n');
    const path = join(root, 'settings/café.json');
    await Bun.write(path, JSON.stringify({ count: 'invalid' }));
    expect(git(root, ['add', '-A']).code).toBe(0);
    const command = ['check', '--only', 'files/v8r', '--staged', '--json'];
    const invalid = await spawnGspot(root, command, environment);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'files/v8r',
            status: 'failed',
            findings: [
                containing({
                    file: 'settings/café.json',
                    message: textContaining('must be integer'),
                }),
            ],
        },
    ]);
    await Bun.write(path, JSON.stringify({ count: 1 }));
    expect(git(root, ['add', 'settings/café.json']).code).toBe(0);
    const valid = await spawnGspot(root, command, environment);
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect((JSON.parse(valid.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/v8r', status: 'passed', findings: [] },
    ]);
});

test('TOML parsing stays offline for explicit schema directives at both levels', async () => {
    const { root, environment } = testRepository;
    await using resources = new AsyncDisposableStack();
    let requests = 0;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch() {
            requests++;
            return Response.json({ type: 'object', required: ['missing'] });
        },
    });
    resources.defer(async () => {
        await server.stop(true);
    });
    const directive = `#:schema ${server.url.toString()}schema.json\n`;
    resources.use(
        await preserveRepositoryChanges(testRepository, {
            check: 'files/taplo',
            files: { 'settings/schema.toml': directive + 'value =\n' },
        }),
    );
    const command = ['check', 'settings/schema.toml', '--only', 'files/taplo', '--json'];
    for (const level of ['recommended', 'all']) {
        const selected = await spawnGspot(root, ['set', 'level', level], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await Bun.write(join(root, 'settings/schema.toml'), directive + 'value =\n');
        const failed = await spawnGspot(root, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/taplo', status: 'failed', findings: [{ file: 'settings/schema.toml', line: 2 }] },
        ]);
        await Bun.write(join(root, 'settings/schema.toml'), directive + 'value = 1\n');
        const corrected = await spawnGspot(root, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/taplo', status: 'passed', findings: [] },
        ]);
    }
    expect(requests).toBe(0);
});
