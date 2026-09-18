// A file that is not a test, sitting beside test files.
import { posix } from 'node:path';
import { createRule } from '#plugin/rule.ts';
import { optionsSchema, stringList } from '#plugin/options.ts';
import type { TestsDirectoryContentsOptions } from '#plugin-types/options.ts';
import { lintedFile, lintedRoot, isAnyGlobMatch, readDirectory, relativeToRoot } from '#plugin/files.ts';

const DEFAULT_TEST = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
const CODE_FILE = /\.[cm]?[jt]sx?$/u;

function isCandidate(name: string, test: RegExp): boolean {
    return !test.test(name) && !name.endsWith('.d.ts') && CODE_FILE.test(name);
}

function isInTestDirectory(relative: string, options: TestsDirectoryContentsOptions[0]): boolean {
    return isAnyGlobMatch(relative, options.testDirectories ?? []) && !isAnyGlobMatch(relative, options.excluded ?? []);
}

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
            excluded: [
                '**/tests/harness/**',
                '**/tests/fixtures/**',
                '**/tests/mocks/**',
                '**/tests/vitest/**',
                '**/tests/lifecycle/**',
            ],
        },
    ],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const relative = relativeToRoot(lintedRoot(context), file);
        const test = new RegExp(options.testPattern ?? DEFAULT_TEST, 'u');
        const name = posix.basename(relative);
        if (!isCandidate(name, test) || !isInTestDirectory(relative, options)) return {};
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
