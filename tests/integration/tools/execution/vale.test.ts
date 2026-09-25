import { valeFindings } from '#cli/checks/prose/vale.ts';
import { planRun } from '#cli/execution/plan.ts';
import { openSession } from '#cli/execution/session.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { createFileTree, testdir } from 'testdirs';

import { runEngineCheck } from '#cli/execution/engines.ts';

for (const extension of ['md', 'sh']) {
    test(`native Vale reports a ${extension} defect and accepts corrected source`, async () => {
        await using directory = await testdir();
        const path = `sample.${extension}`;
        await createFileTree(directory.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["prose", "bash", "markdown"]\n',
            '.gspot/config/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
            '.gspot/config/styles/Example/Concrete.yml':
                'extends: existence\nmessage: "Use inspect."\nlevel: error\ntokens: [delve]\n',
            [path]: '# We delve into the records.\n',
        });
        const session = await openSession(directory.path);
        const [planned] = await planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
        const defect = await runEngineCheck(session, valeFindings, planned!);
        expect(defect.status, defect.note).toBe('fail');
        expect(defect.findings).toStrictEqual([
            expect.objectContaining({ file: path, line: 1, rule: 'Example.Concrete' }),
        ]);
        await Bun.write(join(directory.path, path), '# We inspect the records.\n');
        const corrected = await runEngineCheck(session, valeFindings, planned!);
        expect(corrected.status, corrected.note).toBe('ok');
    });
}
