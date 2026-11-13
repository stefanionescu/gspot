import { posix } from 'node:path';

import type { Node } from 'web-tree-sitter';

import { SWIFTPM_TARGET_FOLDERS } from '#cli/config/parsers/projects.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { listSwiftCallArguments } from '#cli/parsers/code/swift.ts';
import { readText } from '#cli/system/files/reads.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { ParseCache, SwiftModule } from '#cli/types/parsers.ts';

function findStringArgument(call: Node, label: string): string | undefined {
    const value = listSwiftCallArguments(call)
        .find((argument) => argument.childForFieldName('name')?.text === label)
        ?.childForFieldName('value');
    return value?.type === 'line_string_literal' ? (value.childForFieldName('text')?.text ?? '') : undefined;
}

function selectDefaultFolder(folders: readonly string[], packageFolder: string, swiftFiles: string[]): string {
    const present = folders.find((folder) =>
        swiftFiles.some((file) => file.startsWith(`${posix.join(packageFolder, folder)}/`)),
    );
    return present ?? folders[0] ?? '';
}

export async function listPackageModules(
    sources: ParseCache,
    path: string,
    swiftFiles: string[],
): Promise<SwiftModule[]> {
    using tree = await parseSource('swift', readText(sources.cache, path), sources);
    const packageFolder = extractParentFolder(path);
    return tree.rootNode.descendantsOfType('call_expression').flatMap((call) => {
        const callee = call.namedChildren[0];
        const kind = callee?.type === 'prefix_expression' ? callee.childForFieldName('target')?.text : undefined;
        const folders = SWIFTPM_TARGET_FOLDERS[kind ?? ''];
        if (folders === undefined) return [];
        const name = findStringArgument(call, 'name');
        if (name === undefined) return [];
        const folder = posix.join(
            packageFolder,
            findStringArgument(call, 'path') ??
                posix.join(selectDefaultFolder(folders, packageFolder, swiftFiles), name),
        );
        return [{ name, files: swiftFiles.filter((file) => file.startsWith(`${folder}/`)) }];
    });
}
