import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as probes from '#cli/platform/tool-probe.ts';
import { valeFindings } from '#cli/prose/vale.ts';
import { runEngineCheck } from '#cli/run/engines.ts';
import { planRun } from '#cli/run/plan.ts';
import { openSession } from '#cli/run/session.ts';

for (const extension of ['md', 'sh']) {
    test(`native Vale reports a ${extension} defect and accepts corrected source`, async () => {
        await using directory = await testdir();
        const path = `sample.${extension}`;
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\npresets = ["prose", "bash", "markdown"]\n',
            '.gspot/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
            '.gspot/styles/Example/Concrete.yml':
                'extends: existence\nmessage: "Use inspect."\nlevel: error\ntokens: [delve]\n',
            [path]: '# We delve into the records.\n',
        });
        const session = await openSession(directory.path);
        const [planned] = await planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
        const defect = await runEngineCheck(session, valeFindings, planned!);
        expect(defect.status, defect.note).toBe('fail');
        expect(defect.findings).toEqual([expect.objectContaining({ file: path, line: 1, rule: 'Example.Concrete' })]);
        await Bun.write(join(directory.path, path), '# We inspect the records.\n');
        const corrected = await runEngineCheck(session, valeFindings, planned!);
        expect(corrected.status, corrected.note).toBe('ok');
    });

    test.each(['outdated', 'deadline', 'cancellation'])(
        `Vale rejects %s for ${extension} input and accepts corrected execution`,
        async (failure) => {
            await using directory = await testdir();
            const path = `sample.${extension}`;
            const source = '# Example text\n';
            await createFileTree(directory.path, {
                'gspot.toml': 'version = 1\npresets = ["prose", "bash", "markdown"]\n[limits]\ntool_seconds = 1\n',
                '.gspot/vale.ini': 'Packages =\n',
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
                expect(failed.findings).toEqual([]);
                probe.mockReturnValue({ name: 'vale', state: 'ok', path: process.execPath });
                spawn.mockImplementation(async (command, options) => {
                    expect(options.timeoutMs).toBe(1000);
                    if (extension === 'sh') {
                        expect(command).toContain('--ext=.rb');
                        expect(options.stdin).toBe(source);
                    } else {
                        expect(command).toContain(path);
                        expect(options.stdin).toBeUndefined();
                    }
                    return {
                        code: 0,
                        stdout: JSON.stringify({
                            [extension === 'sh' ? 'stdin.rb' : join(directory.path, path)]: [
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
                    };
                });
                const corrected = await runEngineCheck(session, valeFindings, planned!);
                expect(corrected.status).toBe('fail');
                expect(corrected.findings).toEqual([
                    expect.objectContaining({ file: path, line: 1, column: 3, rule: 'gspot.Example' }),
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
