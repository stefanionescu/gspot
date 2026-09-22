// A file that is not a test, sitting beside test files.
import { posix } from 'node:path';
import { createRule } from '#plugin/rules/definition.ts';
import { optionsSchema, stringList } from '#plugin/rules/options.ts';

import { lintedFile, lintedRoot, isAnyGlobMatch, readDirectory, relativeToRoot } from '#plugin/files.ts';

const DEFAULT_TEST = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
const CODE_FILE = /\.[cm]?[jt]sx?$/u;

export const testsDirectoryContents = createRule<TestsDirectoryContentsOptions, 'misplaced'>({
    name: 'tests-directory-contents',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds a file that is not a test sitting in a folder of test files.',
            why: 'Harness code beside tests gets imported through relative paths and drifts away from the declared harness directory.',
            fix: 'Move the file into the harness directory the repository declares (tools.vitest.harness_dir).',
        },
        schema: [
            optionsSchema({
                testPattern: { type: 'string' },
                testDirectories: stringList,
                harnessDirectory: { type: 'string' },
                excluded: stringList,
            }),
        ],
        messages: { misplaced: '{{name}} is not a test but sits beside tests. Move it to {{harness}}.' },
    },
    defaultOptions: [
        {
            testPattern: DEFAULT_TEST,
            testDirectories: ['**/tests/**', '**/__tests__/**', '**/test/**'],
            harnessDirectory: 'tests/harness',
            excluded: ['**/tests/harness/**', '**/tests/mocks/**', '**/tests/vitest/**', '**/tests/lifecycle/**'],
        },
    ],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const relative = relativeToRoot(lintedRoot(context), file);
        const test = new RegExp(options.testPattern ?? DEFAULT_TEST, 'u');
        const name = posix.basename(relative);
        if (
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
                    data: { name, harness: options.harnessDirectory ?? 'tests/harness' },
                });
            },
        };
    },
});

export type TestsDirectoryContentsOptions = [
    { testPattern?: string; testDirectories?: string[]; harnessDirectory?: string; excluded?: string[] },
];
