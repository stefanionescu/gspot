import { posix } from 'node:path';
import type { TestFoldersOptions } from '#plugin/types/rules.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { DEFAULT_TEST, CODE_EXTENSION } from '#plugin/config/rules.ts';
import { lintedFile, lintedRoot, readDirectory, isAnyGlobMatch, relativeToRoot } from '#plugin/files.ts';

export const testFolders = createRule<TestFoldersOptions, 'misplaced'>({
    name: 'test-folders',
    meta: {
        type: 'problem',
        docs: {
            level: 'all',
            title: 'Tests directory contents',
            example:
                'With `harness: "tests/support"`, when `tests/unit/` contains `a.test.ts`, a neighboring non-test file `builders.ts` reports `misplaced`. Move `builders.ts` into `tests/support/` and update its imports. Declaration files such as `b.d.ts` can remain beside tests.',
            summary:
                'Finds a file that is not a test sitting in a folder of test files. With no harness directory, it reports nothing.',
            why: 'Harness code beside tests gets imported through relative paths and drifts away from the declared harness directory.',
            fix: 'Move the file into the configured test support directory.',
        },
        schema: [
            optionsSchema({
                pattern: { type: 'string' },
                directories: { type: 'array', items: { type: 'string' } },
                harness: { type: 'string' },
                allowed: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: { misplaced: '{{name}} is not a test but sits beside tests. Move it to {{harness}}.' },
    },
    defaultOptions: [
        {
            pattern: DEFAULT_TEST,
            directories: ['**/tests/**', '**/__tests__/**', '**/test/**'],
            allowed: [],
        },
    ],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const relative = relativeToRoot(lintedRoot(context), file);
        const test = new RegExp(options.pattern ?? DEFAULT_TEST, 'u');
        const name = posix.basename(relative);
        const harness = options.harness;
        if (harness === undefined) return {};
        const directories = options.directories ?? [];
        const allowed = options.allowed ?? [];
        return {
            Program(node) {
                if (relative.startsWith(`${harness}/`)) return;
                if (!isAnyGlobMatch(relative, directories) || isAnyGlobMatch(relative, allowed)) return;
                if (test.test(name) || name.endsWith('.d.ts') || !CODE_EXTENSION.test(name)) return;
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
