import { join } from 'node:path';
import * as probes from '#cli/tools/probe.ts';
import { expect, spyOn, test } from 'bun:test';
import { planRun } from '#cli/execution/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { valeFindings } from '#cli/checks/prose/vale.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { containing } from '#tests/support/expectations.ts';

for (const extension of ['md', 'sh']) {
    test.each(['outdated', 'deadline', 'cancellation'])(
        `Vale rejects %s for ${extension} input and accepts corrected execution`,
        async (failure) => {
            await using directory = await testdir();
            const path = `sample.${extension}`;
            const source = '# Example text\n';
            await createFileTree(directory.path, {
                'gspot.toml':
                    'version = 1\nconfigurations = ["prose", "bash", "markdown"]\n[limits]\ntool_seconds = 1\n',
                '.gspot/config/vale.ini': 'Packages =\n',
                [path]: source,
            });
            const session = await openSession(directory.path);
            const [planned] = await planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
            const probe = spyOn(probes, 'probeTool').mockReturnValue({
                name: 'vale',
                state: failure === 'outdated' ? 'outdated' : 'ok',
                path: process.execPath,
                found: '0.0.1',
            });
            const spawn = spyOn(processes, 'run').mockResolvedValue({
                code: 1,
                stdout: '',
                stderr: '',
                missing: false,
                duration: 1,
                isTimedOut: failure === 'deadline',
                isCanceled: failure === 'cancellation',
            });
            try {
                const failed = await runEngineCheck(session, valeFindings, planned!);
                expect(failed.status).toBe(failure === 'outdated' ? 'missing' : 'error');
                expect(failed.findings).toStrictEqual([]);
                probe.mockReturnValue({ name: 'vale', state: 'ok', path: process.execPath });
                spawn.mockImplementation((command, options) => {
                    expect(options.timeoutMs).toBe(1000);
                    // A shell script goes by path like Markdown: vale.ini maps sh to the Python format (K-176).
                    expect(command).toContain(path);
                    expect(options.stdin).toBeUndefined();
                    return Promise.resolve({
                        code: 0,
                        stdout: JSON.stringify({
                            [join(directory.path, path)]: [
                                {
                                    Line: 1,
                                    Span: [3, 5],
                                    Check: 'gspot.Example',
                                    Message: 'Use a concrete example.',
                                },
                            ],
                        }),
                        stderr: '',
                        missing: false,
                        duration: 1,
                    });
                });
                const corrected = await runEngineCheck(session, valeFindings, planned!);
                expect(corrected.status).toBe('fail');
                expect(corrected.findings).toStrictEqual([
                    containing({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
                ]);
                spawn.mockResolvedValue({ code: 0, stdout: '{}', stderr: '', missing: false, duration: 1 });
                expect((await runEngineCheck(session, valeFindings, planned!)).status).toBe('ok');
            } finally {
                spawn.mockRestore();
                probe.mockRestore();
            }
        },
    );
}
