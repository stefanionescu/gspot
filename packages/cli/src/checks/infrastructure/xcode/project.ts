import { posix } from 'node:path';
import { parsePbxproj } from '#cli/parsers/xcode.ts';
import { PBXPROJ } from '#cli/config/parsers/xcode.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/swift.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { XCODEPROJ_SUFFIX } from '#cli/config/checks/infrastructure/xcode.ts';

// The folder that holds the project bundle, with its trailing slash, or an empty string at the root.
function projectFolder(projectFile: string): string {
    const bundle = projectFile.slice(0, projectFile.indexOf(XCODEPROJ_SUFFIX));
    return bundle.slice(0, bundle.lastIndexOf('/') + 1);
}
/**
 * Report Swift sources outside targets.
 * @param input the check input.
 * @returns the findings.
 */
export function xcodeFilesWithoutTarget(input: CheckInput): Finding[] {
    const projects = sourcePaths(input, [PBXPROJ]).map((path) => ({
        path,
        ...parsePbxproj(readCachedBytes(input.reads, path).toString('utf8'), projectFolder(path)),
    }));
    if (projects.length === 0) return [];
    const references = projects.flatMap((project) =>
        [...project.sources].map((source) => ({
            project: project.path,
            path: source,
        })),
    );
    const referenced = new Set(references.map(({ path }) => path));
    const folders = projects.flatMap((project) => project.folders);
    const tree = sourcePaths(input, [SWIFT_EXTENSION]).filter((file) => posix.basename(file) !== PACKAGE_SWIFT);
    return tree
        .filter(
            (file) =>
                !referenced.has(file) &&
                folders.every(({ path, excluded }) => !file.startsWith(path) || excluded.has(file)),
        )
        .map((file) =>
            findingAt(input, { file, line: 1 }, 'untargeted', 'This Swift file is in no target of the project.'),
        );
}
