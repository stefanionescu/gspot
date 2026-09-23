// A leaf folder holding one code file.
import { posix } from 'node:path';
import { createRule } from '#plugin/rules/definition.ts';
import { optionsSchema, stringList } from '#plugin/rules/options.ts';

import {
    CODE_EXTENSIONS,
    lintedFile,
    lintedRoot,
    isAnyGlobMatch,
    readDirectory,
    relativeToRoot,
} from '#plugin/files.ts';

const DEFAULT_IGNORED = ['node_modules', 'dist', 'build', 'coverage', '.git'];

function isIgnored(relative: string, ignored: string[], allow: string[]): boolean {
    if (ignored.some((segment) => relative.split('/').includes(segment))) return true;
    const directory = posix.dirname(relative);
    return isAnyGlobMatch(directory, allow) || isAnyGlobMatch(`${directory}/`, allow);
}

export const noSingleFileFolders = createRule<SingleFileFoldersOptions, 'lone'>({
    name: 'no-single-file-folders',
    meta: {
        type: 'problem',
        docs: {
            example:
                'A folder `lone/` containing only `only.ts` reports `lone`. Move `only.ts` beside related files in the parent folder, remove the empty folder, and update imports.',
            summary: 'Finds a folder that holds one code file and nothing else.',
            why: 'A folder of one file adds a level to every path and promises siblings that never arrive.',
            fix: 'Move the file up beside its neighbors, or allow the folder with a reason under structure.single_file_folder_allowed.',
        },
        schema: [optionsSchema({ extensions: stringList, ignorePaths: stringList, allow: stringList })],
        messages: {
            lone: 'This folder holds only {{name}}. Move the file up beside its neighbors, or allow the folder with a reason.',
        },
    },
    defaultOptions: [{ extensions: CODE_EXTENSIONS, ignorePaths: DEFAULT_IGNORED, allow: [] }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const relative = relativeToRoot(lintedRoot(context), file);
        if (isIgnored(relative, options.ignorePaths ?? DEFAULT_IGNORED, options.allow ?? [])) return {};
        const extensions = options.extensions ?? CODE_EXTENSIONS;
        return {
            Program(node) {
                const entries = readDirectory(posix.dirname(file));
                if (entries.some((entry) => entry.kind === 'dir')) return;
                const code = entries.filter(
                    (entry) =>
                        entry.kind === 'file' &&
                        !entry.name.endsWith('.d.ts') &&
                        extensions.some((extension) => entry.name.endsWith(extension)),
                );
                const [only] = code;
                if (only !== undefined && code.length === 1)
                    context.report({ node, messageId: 'lone', data: { name: only.name } });
            },
        };
    },
});

export type SingleFileFoldersOptions = [{ extensions?: string[]; ignorePaths?: string[]; allow?: string[] }];
