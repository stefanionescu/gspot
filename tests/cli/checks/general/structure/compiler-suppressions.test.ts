import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { COMPILER_SOURCE } from '#tests/config/samples/typescript.ts';
import { suppressionComments } from '#cli/checks/general/structure/suppressions.ts';

import {
    COMPILER_REASON,
    COMPILER_DIRECTIVES,
} from '#tests/config/cli/checks/general/structure/compiler-suppressions.ts';

test.each(['javascript', 'typescript'])(
    '%s compiler suppressions exclude quoted markers and require meaningful reasons',
    async (language) => {
        await using sandbox = await testdir();
        const ending = language === 'javascript' ? 'js' : 'ts';
        const paths = COMPILER_DIRECTIVES.map((directive) => `${directive}.${ending}`);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([language]),
            ...Object.fromEntries(
                COMPILER_DIRECTIVES.map((directive, index) => [
                    paths[index]!,
                    `// @ts-${directive}\n${COMPILER_SOURCE}`,
                ]),
            ),
            [`control.${ending}`]: COMPILER_SOURCE,
            [`string.${ending}`]: 'export const example = "// @ts-ignore";\n',
        });
        const session = await openSession(sandbox.path);
        const comments = await suppressionComments(
            session.root,
            session.scopes,
            session.reads,
            session.repository.files,
        );
        expect(
            comments.map(({ file, line, form, reason, forbidden }) => ({ file, line, form, reason, forbidden })),
        ).toStrictEqual(
            paths
                .toSorted((left, right) => left.localeCompare(right))
                .map((file) => ({ file, line: 1, form: 'tsc', reason: undefined, forbidden: false })),
        );
        const missing = await runGspot(sandbox.path, ['check', '--only', 'structure/suppressions', '--json']);
        expect(missing.code, missing.stdout + missing.stderr).toBe(1);
        expect(
            (JSON.parse(missing.stdout) as RunReport).checks.flatMap(({ findings }) =>
                findings.map(({ file, line, rule }) => ({ file, line, rule })),
            ),
        ).toStrictEqual(
            paths
                .toSorted((left, right) => left.localeCompare(right))
                .map((file) => ({ file, line: 1, rule: 'tsc-no-reason' })),
        );
        for (const [index, directive] of COMPILER_DIRECTIVES.entries())
            await Bun.write(
                join(sandbox.path, paths[index]!),
                `// @ts-${directive}: ${COMPILER_REASON}\n${COMPILER_SOURCE}`,
            );
        const reasoned = await runGspot(sandbox.path, ['check', '--only', 'structure/suppressions', '--json']);
        expect(reasoned.code, reasoned.stdout + reasoned.stderr).toBe(0);
        for (const [index, directive] of COMPILER_DIRECTIVES.entries())
            expect(await Bun.file(join(sandbox.path, paths[index]!)).text()).toBe(
                `// @ts-${directive}: ${COMPILER_REASON}\n${COMPILER_SOURCE}`,
            );
    },
);
