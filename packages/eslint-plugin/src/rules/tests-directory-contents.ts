// A file that is not a test, sitting beside test files.
import { posix } from 'node:path';
import { createRule, optionsSchema } from '#plugin/rules/definition.ts';
import { lintedFile, lintedRoot, isAnyGlobMatch, readDirectory, relativeToRoot } from '#plugin/files.ts';

const DEFAULT_TEST = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
const CODE_FILE = /\.[cm]?[jt]sx?$/u;

export const testsDirectoryContents = createRule<TestsDirectoryContentsOptions, 'misplaced'>({
    name: 'tests-directory-contents',
    meta: {
        type: 'problem',
        docs: {
            title: 'Tests directory contents',
            example:
                'When `tests/unit/` contains `a.test.ts`, a neighboring non-test file `builders.ts` reports `misplaced`. Move `builders.ts` into `tests/support/` and update its imports. Declaration files such as `b.d.ts` can remain beside tests.',
            summary: 'Finds a file that is not a test sitting in a folder of test files.',
            why: 'Harness code beside tests gets imported through relative paths and drifts away from the declared harness directory.',
            fix: 'Move the file into the configured test support directory.',
        },
        schema: [
            optionsSchema({
                testPattern: { type: 'string' },
                testDirectories: { type: 'array', items: { type: 'string' } },
                harnessDirectory: { type: 'string' },
                excluded: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: { misplaced: '{{name}} is not a test but sits beside tests. Move it to {{harness}}.' },
    },
    defaultOptions: [
        {
            testPattern: DEFAULT_TEST,
            testDirectories: ['**/tests/**', '**/__tests__/**', '**/test/**'],
            harnessDirectory: 'tests/support',
            excluded: [],
        },
    ],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const relative = relativeToRoot(lintedRoot(context), file);
        const test = new RegExp(options.testPattern ?? DEFAULT_TEST, 'u');
        const name = posix.basename(relative);
        const harness = options.harnessDirectory ?? 'tests/support';
        if (
            relative.startsWith(`${harness}/`) ||
            !(!test.test(name) && !name.endsWith('.d.ts') && CODE_FILE.test(name)) ||
            !(
                isAnyGlobMatch(relative, options.testDirectories ?? []) &&
                !isAnyGlobMatch(relative, options.excluded ?? [])
            )
        )
            return {};
        return {
            Program(node) {
                const siblings = readDirectory(posix.dirname(file));
                if (siblings.every((entry) => !(entry.kind === 'file' && test.test(entry.name)))) return;
                context.report({
                    node,
                    messageId: 'misplaced',
                    data: { name, harness },
                });
            },
        };
    },
});

export type TestsDirectoryContentsOptions = [
    { testPattern?: string; testDirectories?: string[]; harnessDirectory?: string; excluded?: string[] },
];
