import { executeRun } from '#cli/execution/execute.ts';
import { applyInlineIgnores, inlineIgnores } from '#cli/execution/ignores.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { openSession } from '#cli/execution/session.ts';
import { expect, test } from 'bun:test';
import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('inline gspot-ignore comments apply to the next line when alone and the same line otherwise', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.sh': 'echo 1\n# gspot-ignore structure/call-through -- The public name is the stable one.\nx() { y; }\nz() { w; } # gspot-ignore structure/call-through\n',
    });
    const inline = inlineIgnores({ root: sandbox.path, sources: new Map() }, 'a.sh');
    expect(inline).toStrictEqual([
        { line: 3, check: 'structure/call-through', reason: 'The public name is the stable one.' },
        { line: 4, check: 'structure/call-through' },
    ]);
});

test('inline ignores apply to Swift findings across repeated runs and changed source', async () => {
    const source = 'func welcome(for name: String) -> String { return greeting(for: name) }\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["swift"]\n',
        'Sources/Welcome.swift': source,
        '.gitignore': '.gspot/\n',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['swift/trivial-function'],
        fix: false,
        isDryRun: false,
    };
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks[0]!.findings[0]!.engine).toBe('integrity');
    expect(reportSchema.parse(failed.report).checks[0]!.findings).toHaveLength(2);
    const path = join(sandbox.path, 'Sources/Welcome.swift');
    writeFileSync(path, '// gspot-ignore swift/trivial-function -- Required protocol entry point.\n' + source);
    const session = await openSession(sandbox.path);
    const allowed = await executeRun(session, options);
    expect(allowed.report.exitCode).toBe(0);
    expect(allowed.report.checks[0]?.findings).toHaveLength(0);
    const repeated = await executeRun(session, options);
    expect(repeated.report.exitCode).toBe(0);
    expect(repeated.report.checks[0]?.findings).toHaveLength(0);
    writeFileSync(path, '// gspot-ignore swift/trivial-function\n' + source);
    const unexplained = await executeRun(await openSession(sandbox.path), options);
    expect(unexplained.report.exitCode).toBe(0);
    expect(unexplained.report.checks[0]!.findings).toStrictEqual([]);
});

test('inline engine comments do not suppress external-tool findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'a.sh': '# gspot-ignore structure/custom -- Deliberate.\necho "$1"\n',
    });
    const finding = { check: 'structure/custom', file: 'a.sh', line: 2, message: 'External finding', fixable: false };
    expect(applyInlineIgnores({ root: sandbox.path, sources: new Map() }, [finding])).toStrictEqual([finding]);
});

test('missing finding paths have no inline ignores but failed reads remain errors', async () => {
    await using sandbox = await testdir();
    const finding = {
        check: 'structure/custom',
        engine: 'structure',
        file: 'missing.ts',
        line: 1,
        message: 'Required source is missing.',
        fixable: false,
    };
    expect(applyInlineIgnores({ root: sandbox.path, sources: new Map() }, [finding])).toStrictEqual([finding]);
    mkdirSync(join(sandbox.path, 'missing.ts'));
    expect(() => applyInlineIgnores({ root: sandbox.path, sources: new Map() }, [finding])).toThrow();
});

test.each(['unused-functions', 'dead-parameters', 'trivial-function', 'doc-comment'])(
    'a reasoned inline ignore suppresses only its target in structure/%s',
    async (analysis) => {
        const check = `structure/${analysis}`;
        const calls = analysis === 'unused-functions' ? '' : 'first_action one\nsecond_action two\n';
        const source = `first_action() { printf '%s\\n' ready; }\nsecond_action() { printf '%s\\n' ready; }\n${calls}`;
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
            'actions.sh': source,
            '.gitignore': '.gspot/\n',
        });
        const options = {
            stage: 'all' as const,
            skips: [],
            only: [check],
            fix: false,
            isDryRun: false,
            noCache: true,
        };
        const initial = await executeRun(await openSession(sandbox.path), options);
        expect(initial.report.checks[0]?.findings).toHaveLength(2);
        writeFileSync(
            join(sandbox.path, 'actions.sh'),
            `# gspot-ignore ${check} -- Required external callback.\n${source}`,
        );
        const result = await executeRun(await openSession(sandbox.path), options);
        expect(result.report.exitCode).toBe(1);
        expect(result.report.checks[0]?.findings).toMatchObject([{ check, file: 'actions.sh', line: 3 }]);
        expect(result.report.checks[0]?.findings).toHaveLength(1);
    },
);

test.each(['source.sh', '../outside/source.sh'])(
    'inline suppression refuses external source %s before accepting a corrected local comment',
    async (file) => {
        await using sandbox = await testdir();
        const comment = '# gspot-ignore structure/custom -- Required external interface.\necho ready\n';
        await createFileTree(sandbox.path, {
            'project/source.sh': 'echo ready\n',
            'outside/source.sh': comment,
        });
        const root = join(sandbox.path, 'project');
        unlinkSync(join(root, 'source.sh'));
        symlinkSync('../outside/source.sh', join(root, 'source.sh'));
        const finding = {
            check: 'structure/custom',
            engine: 'structure',
            file,
            line: 2,
            message: 'Finding',
            fixable: false,
        };
        expect(() => applyInlineIgnores({ root: root, sources: new Map() }, [finding])).toThrow();
        expect(await Bun.file(join(sandbox.path, 'outside/source.sh')).text()).toBe(comment);
        unlinkSync(join(root, 'source.sh'));
        writeFileSync(join(root, 'source.sh'), comment);
        expect(
            applyInlineIgnores({ root: root, sources: new Map() }, [{ ...finding, file: 'source.sh' }]),
        ).toStrictEqual([]);
    },
);
