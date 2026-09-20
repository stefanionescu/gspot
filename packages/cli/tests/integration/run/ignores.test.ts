import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { reportSchema } from '#cli/run/report/schema.ts';
import { inlineIgnores, applyInlineIgnores } from '#cli/run/ignores.ts';

test('inline gspot-ignore comments apply to the next line when alone and the same line otherwise', async () => {
    await using sandbox = await createSandbox({
        'a.sh': 'echo 1\n# gspot-ignore structure/call-through -- The public name is the stable one.\nx() { y; }\nz() { w; } # gspot-ignore structure/call-through\n',
    });
    const inline = inlineIgnores(sandbox.path, 'a.sh');
    expect(inline).toEqual([
        { line: 3, check: 'structure/call-through', reason: 'The public name is the stable one.' },
        { line: 4, check: 'structure/call-through' },
    ]);
});

test('inline ignores apply to Swift engine findings on fresh and cached runs', async () => {
    const source = 'func welcome(for name: String) -> String { return greeting(for: name) }\n';
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = ["swift"]\n',
        'Sources/Welcome.swift': source,
        '.gitignore': '.gspot/\n',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        localSkips: [],
        only: ['swift/call-through'],
        fix: false,
        isDryRun: false,
    };
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks[0]!.findings[0]!.engine).toBe('integrity');
    expect(reportSchema.parse(failed.report).checks[0]!.findings).toHaveLength(1);
    const path = join(sandbox.path, 'Sources/Welcome.swift');
    writeFileSync(path, '// gspot-ignore swift/call-through -- Required protocol entry point.\n' + source);
    const session = await openSession(sandbox.path);
    const allowed = await executeRun(session, options);
    expect(allowed.report.exitCode).toBe(0);
    expect(allowed.report.checks[0]?.findings).toHaveLength(0);
    const cached = await executeRun(session, options);
    expect(cached.report.exitCode).toBe(0);
    expect(cached.report.checks[0]?.duration).toBe(allowed.report.checks[0]?.duration);
    expect(cached.report.checks[0]?.findings).toHaveLength(0);
    writeFileSync(path, '// gspot-ignore swift/call-through\n' + source);
    const unexplained = await executeRun(await openSession(sandbox.path), options);
    expect(unexplained.report.exitCode).toBe(1);
    expect(unexplained.report.checks[0]!.findings[0]!.message).toContain('has no reason');
});

test('inline engine comments do not suppress external-tool findings', async () => {
    await using sandbox = await createSandbox({
        'a.sh': '# gspot-ignore structure/custom -- Deliberate.\necho "$1"\n',
    });
    const finding = { check: 'structure/custom', file: 'a.sh', line: 2, message: 'External finding', fixable: false };
    expect(applyInlineIgnores(sandbox.path, [finding])).toEqual([finding]);
});
