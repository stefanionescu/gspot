// A clean NestJS module passes every check, and the NestJS plugin reports a route parameter its decorator does not name.
import { test, expect } from 'bun:test';
import { run } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';

import {
    GREETER,
    CONTROLLER,
    NESTJS_MODULE,
    NESTJS_TSCONFIG,
    NESTJS_DEPENDENCIES,
} from '#tests/inputs/acceptance/source/kits/kits.ts';

const MISMATCHED = CONTROLLER.replace("@Get(':name')", () => "@Get(':id')");

plantedCases(
    'the nestjs configuration',
    {
        kits: ['typescript', 'nestjs'],
        dependencies: NESTJS_DEPENDENCIES,
        files: {
            'tsconfig.json': NESTJS_TSCONFIG,
            'src/greeting.service.ts': GREETER,
            'src/greeting.controller.ts': CONTROLLER,
            'src/greeting.module.ts': NESTJS_MODULE,
        },
        without: ['naming', 'spelling', 'security', 'dependencies'],
    },
    [
        {
            check: 'typescript/eslint',
            files: { 'src/greeting.controller.ts': MISMATCHED },
            expected: {
                file: 'src/greeting.controller.ts',
                rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
                line: 20,
            },
        },
    ],
    (planted) => {
        test(
            'the lint, type, and compiler option checks accept the clean Nest module',
            async () => {
                const { root, environment } = planted();
                for (const id of ['typescript/eslint', 'typescript/tsc', 'integrity/tsconfig-options']) {
                    const clean = await run(root, ['check', '--only', id], environment);
                    expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                }
            },
            PLANTED_TIMEOUT_MS * 4,
        );
    },
);
