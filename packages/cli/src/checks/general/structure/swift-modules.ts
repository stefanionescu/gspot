import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/session.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parseProjectSources } from '#cli/parsers/projects/xcode.ts';
import type { SwiftModule } from '#cli/types/checks/general/structure.ts';
import { PBXPROJ_SUFFIX, SWIFT_EXTENSION } from '#cli/config/files/names.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects/dependencies.ts';
import { NON_WORD_CHARACTERS, SWIFTPM_TARGET_FOLDERS } from '#cli/config/checks/general/structure/swift-modules.ts';

function findStringArgument(call: Node, label: string): string | undefined {
    const argument = call
        .descendantsOfType('value_argument')
        .find((node) => node.childForFieldName('name')?.text === label && node.parent?.parent?.parent?.id === call.id);
    const value = argument?.childForFieldName('value');
    return value?.type === 'line_string_literal' ? (value.childForFieldName('text')?.text ?? '') : undefined;
}

function selectDefaultFolder(folders: readonly string[], packageFolder: string, swiftFiles: string[]): string {
    const present = folders.find((folder) =>
        swiftFiles.some((file) => file.startsWith(`${posix.join(packageFolder, folder)}/`)),
    );
    return present ?? folders[0] ?? '';
}

async function listPackageModules(session: Session, path: string, swiftFiles: string[]): Promise<SwiftModule[]> {
    const tree = await parseSource('swift', readCachedText(session.reads, path));
    try {
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
    } finally {
        tree.delete();
    }
}

function listXcodeModules(session: Session, path: string, swiftFiles: string[]): SwiftModule[] {
    const project = parseProjectSources(readCachedText(session.reads, path), path);
    return project.targets.map((target) => ({
        name: target.name.replaceAll(NON_WORD_CHARACTERS, '_'),
        files: swiftFiles.filter(
            (file) =>
                target.sources.includes(file) ||
                target.folders.some(({ path, excluded }) => file.startsWith(path) && !excluded.has(file)),
        ),
    }));
}

/**
Read the files owned by each SwiftPM or Xcode module.

@param session the repository and cached project files.
@returns modules and their source paths.
*/
export async function listSwiftModules(session: Session): Promise<SwiftModule[]> {
    const paths = session.repository.files.map((file) => file.path);
    const swiftFiles = paths.filter((path) => path.endsWith(SWIFT_EXTENSION) && posix.basename(path) !== PACKAGE_SWIFT);
    const packages = paths.filter((path) => posix.basename(path) === PACKAGE_SWIFT);
    const modules = await Promise.all(packages.map((path) => listPackageModules(session, path, swiftFiles)));
    return [
        ...modules.flat(),
        ...paths
            .filter((path) => path.endsWith(PBXPROJ_SUFFIX))
            .flatMap((path) => listXcodeModules(session, path, swiftFiles)),
    ];
}
