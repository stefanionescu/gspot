import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { parsePbxproj } from '#cli/parsers/xcode.ts';
import { PBXPROJ } from '#cli/config/parsers/xcode.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/coverage.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/swift.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import { XCODEPROJ_SUFFIX } from '#cli/config/checks/infrastructure/xcode.ts';

/**
 * Finds the folder that holds the project bundle.
 * @param projectFile the path of the project.pbxproj file.
 * @returns the folder with a trailing slash, or '' at the root.
 */
function getProjectFolder(projectFile: string): string {
    const bundle = projectFile.slice(0, projectFile.indexOf(XCODEPROJ_SUFFIX));
    return bundle.slice(0, bundle.lastIndexOf('/') + 1);
}

/**
 * Reports Swift sources that no Xcode target holds.
 * @param input the scope files to read.
 * @returns the findings.
 */
export function checkFilesWithoutTarget(input: CheckInput): Finding[] {
    const projects = listSourcePaths(input.files, [PBXPROJ]).map((path) => ({
        path,
        ...parsePbxproj(readCachedBytes(input.reads, path).toString('utf8'), getProjectFolder(path)),
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
    const tree = listSourcePaths(input.files, [SWIFT_EXTENSION]).filter(
        (file) => posix.basename(file) !== PACKAGE_SWIFT,
    );
    return tree
        .filter(
            (file) =>
                !referenced.has(file) &&
                folders.every(({ path, excluded }) => !file.startsWith(path) || excluded.has(file)),
        )
        .map((file) =>
            buildFinding(input, { file, line: 1 }, 'untargeted', 'This Swift file is in no target of the project.'),
        );
}
