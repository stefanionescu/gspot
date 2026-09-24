import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { expect, spyOn, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import * as probes from '#cli/tools/tool-probe.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { existsSync, writeFileSync } from 'node:fs';
import { runEngineCheck } from '#cli/run/engines.ts';
import { copiedBlocks } from '#cli/checks/docs/copied-blocks.ts';

test.each(['missing statistics', 'invalid percentage', 'invalid clone', 'fatal exit', 'deadline', 'cancellation'])(
    'duplication rejects %s, removes temporary reports, and accepts a corrected report',
    async (failure) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash", "duplication"]\n',
            'sample.sh': 'echo example\n',
            '.gspot/config/jscpd.json': '{}\n',
        });
        const session = await openSession(directory.path);
        const [planned] = await planRun(session, { stage: 'push', skips: [], only: ['duplication/jscpd'] });
        const directories: string[] = [];
        let corrected = false;
        const probe = spyOn(probes, 'probeTool').mockReturnValue({
            name: 'jscpd',
            state: 'ok',
            path: process.execPath,
        });
        const spawn = spyOn(processes, 'run').mockImplementation(async (command) => {
            const output = command[command.indexOf('--output') + 1]!;
            directories.push(output);
            const report = {
                ...(failure === 'missing statistics' && !corrected
                    ? {}
                    : {
                          statistics: {
                              total: { percentage: failure === 'invalid percentage' && !corrected ? 'bad' : 0 },
                          },
                      }),
                duplicates: failure === 'invalid clone' && !corrected ? [{ lines: 20 }] : [],
            };
            writeFileSync(join(output, 'jscpd-report.json'), JSON.stringify(report));
            return {
                code: failure === 'fatal exit' && !corrected ? 1 : 0,
                stdout: '',
                stderr: 'Native scan failed.',
                missing: false,
                duration: 1,
                isTimedOut: failure === 'deadline' && !corrected,
                isCanceled: failure === 'cancellation' && !corrected,
            };
        });
        try {
            const failed = await runEngineCheck(session, copiedBlocks, planned!);
            expect(failed.status).toBe('error');
            expect(failed.findings).toStrictEqual([]);
            expect(directories).toHaveLength(1);
            expect(directories.every((path) => !existsSync(path))).toBe(true);
            corrected = true;
            expect((await runEngineCheck(session, copiedBlocks, planned!)).status).toBe('ok');
            expect(directories.every((path) => !existsSync(path))).toBe(true);
        } finally {
            spawn.mockRestore();
            probe.mockRestore();
        }
    },
);
