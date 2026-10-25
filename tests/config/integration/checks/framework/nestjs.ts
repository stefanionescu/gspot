import { NESTJS_CONTROLLER, NESTJS_CONTROLLER_UNSUPPRESSED } from '#tests/config/nestjs.ts';

const NESTJS_DIRECTIVE_FINDINGS = [
    {
        file: 'src/greeting.controller.ts',
        line: 15,
        column: 5,
        message: "Unused eslint-disable directive (no problems were reported from 'gspot/no-trivial-functions').",
    },
    {
        file: 'src/greeting.controller.ts',
        line: 25,
        column: 5,
        message: "Unused eslint-disable directive (no problems were reported from 'gspot/no-trivial-functions').",
    },
] as const;

export const NESTJS_CASES = [
    {
        name: 'a route parameter decorator names its route parameter',
        check: 'javascript/eslint',
        files: {
            'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED.replace("@Param('name')", "@Param('other')"),
        },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED } },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 24,
        },
    },
    {
        name: 'class constructors and methods need no trivial-function suppression',
        check: 'javascript/eslint',
        files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED } },
        expected: NESTJS_DIRECTIVE_FINDINGS[0],
        findings: NESTJS_DIRECTIVE_FINDINGS,
    },
] as const;
