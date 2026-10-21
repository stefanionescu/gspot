import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { parsePbxproj } from '#cli/parsers/xcode.ts';
import type { Session } from '#cli/types/planning.ts';
import { PBXPROJ } from '#cli/config/parsers/xcode.ts';
import { parseSource } from '#cli/parsers/grammars.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/swift.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependencies.ts';
import type { SwiftModule } from '#cli/types/checks/import-rules.ts';
import { SWIFTPM_TARGET_FOLDERS, SWIFT_MODULE_NAME_CHARACTERS } from '#cli/config/checks/import-rules.ts';

function readStringArgument(call: Node, label: string): string | undefined {
    const argument = call
        .descendantsOfType('value_argument')
        .find((node) => node.childForFieldName('name')?.text === label && node.parent?.parent?.parent?.id === call.id);
    const value = argument?.childForFieldName('value');
    return value?.type === 'line_string_literal' ? (value.childForFieldName('text')?.text ?? '') : undefined;
}

function findDefaultFolder(folders: readonly string[], packageFolder: string, swiftFiles: string[]): string {
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
            const name = readStringArgument(call, 'name');
            if (folders === undefined) return [];
            if (name === undefined) return [];
            const folder = posix.join(
                packageFolder,
                readStringArgument(call, 'path') ??
                    posix.join(findDefaultFolder(folders, packageFolder, swiftFiles), name),
            );
            return [{ name, files: swiftFiles.filter((file) => file.startsWith(`${folder}/`)) }];
        });
    } finally {
        tree.delete();
    }
}

function listXcodeModules(session: Session, path: string, swiftFiles: string[]): SwiftModule[] {
    const project = parsePbxproj(readCachedText(session.reads, path), path);
    return project.targets.map((target) => ({
        name: target.name.replaceAll(SWIFT_MODULE_NAME_CHARACTERS, '_'),
        files: swiftFiles.filter(
            (file) =>
                target.sources.includes(file) ||
                target.folders.some(({ path: folder, excluded }) => file.startsWith(folder) && !excluded.has(file)),
        ),
    }));
}

/**
 * List the Swift modules that the repository builds, each with its Swift files.
 *
 * @param session the repository and its tools.
 * @returns the modules of every Package.swift target and every Xcode native target.
 */
export async function listSwiftModules(session: Session): Promise<SwiftModule[]> {
    const paths = session.repository.files.map((file) => file.path);
    const swiftFiles = paths.filter((path) => path.endsWith(SWIFT_EXTENSION) && posix.basename(path) !== PACKAGE_SWIFT);
    const packages = paths.filter((path) => posix.basename(path) === PACKAGE_SWIFT);
    const modules = await Promise.all(packages.map((path) => listPackageModules(session, path, swiftFiles)));
    return [
        ...modules.flat(),
        ...paths
            .filter((path) => path.endsWith(PBXPROJ))
            .flatMap((path) => listXcodeModules(session, path, swiftFiles)),
    ];
}
