import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import type { RestrictedSyntaxOptions } from '#eslint-plugin/types/structure.ts';
import { restrictedSyntax } from '#eslint-plugin/rules/structure/restricted-syntax.ts';

buildRuleTester().run<keyof (typeof restrictedSyntax)['meta']['messages'], RestrictedSyntaxOptions>(
    'restricted-syntax',
    restrictedSyntax,
    {
        valid: [
            'enum Color { Red }',
            {
                name: 'a file outside the files of the selector',
                code: 'enum Color { Red }',
                filename: '/repo/lib/color.ts',
                options: [{ selector: 'TSEnumDeclaration', message: 'Use a union.', files: ['src/**'] }],
            },
            {
                name: 'a file that the selector ignores',
                code: 'enum Color { Red }',
                filename: '/repo/src/legacy/color.ts',
                options: [{ selector: 'TSEnumDeclaration', message: 'Use a union.', ignores: ['src/legacy/**'] }],
            },
            {
                name: 'a file outside the root matches no files',
                code: 'enum Color { Red }',
                filename: '/elsewhere/src/color.ts',
                options: [{ selector: 'TSEnumDeclaration', message: 'Use a union.', files: ['src/**'] }],
            },
        ],
        invalid: [
            {
                code: 'enum Color { Red }',
                options: [{ selector: 'TSEnumDeclaration', message: 'Use a union.' }],
                errors: [{ messageId: 'restricted', data: { message: 'Use a union.' } }],
            },
            {
                name: 'a file inside the files of the selector',
                code: 'enum Color { Red }',
                filename: '/repo/src/color.ts',
                options: [
                    { selector: 'TSEnumDeclaration', message: 'Use a union.', files: ['src/**'] },
                    { selector: 'TSEnumDeclaration', message: 'Not in libraries.', files: ['lib/**'] },
                ],
                errors: [{ messageId: 'restricted', data: { message: 'Use a union.' } }],
            },
            {
                name: 'two options with one selector report both messages',
                code: 'debugger;',
                options: [
                    { selector: 'DebuggerStatement', message: 'Remove the debugger.' },
                    { selector: 'DebuggerStatement', message: 'Commit no debugger.' },
                ],
                errors: [
                    { messageId: 'restricted', data: { message: 'Remove the debugger.' } },
                    { messageId: 'restricted', data: { message: 'Commit no debugger.' } },
                ],
            },
            {
                code: 'run();',
                options: [{ selector: 'CallExpression', message: 'x' }],
                settings: { gspot: {} },
                errors: [{ messageId: 'restricted' }],
            },
            {
                code: 'run();',
                filename: 'c:/repo/src/file.ts',
                options: [{ selector: 'CallExpression', message: 'x', files: ['src/**'] }],
                settings: { gspot: { root: 'C:/repo' } },
                errors: [{ messageId: 'restricted' }],
            },
        ],
    },
);
