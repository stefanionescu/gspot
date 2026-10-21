import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { parsePbxproj } from '#cli/parsers/xcode.ts';
import { PBXPROJ } from '#cli/config/parsers/xcode.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/coverage.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/swift.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependencies.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';

/**
 * Reports Swift sources that no Xcode target holds.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export function checkFilesWithoutTarget(session: Session, planned: PlannedCheck): Finding[] {
    const projects = listSourcePaths(planned.files, [PBXPROJ]).map((path) => ({
        path,
        ...parsePbxproj(readCachedText(session.reads, path), path),
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
    const tree = listSourcePaths(planned.files, [SWIFT_EXTENSION]).filter(
        (file) => posix.basename(file) !== PACKAGE_SWIFT,
    );
    return tree
        .filter(
            (file) =>
                !referenced.has(file) &&
                folders.every(({ path, excluded }) => !file.startsWith(path) || excluded.has(file)),
        )
        .map((file) =>
            buildFinding(planned, { file, line: 1 }, 'untargeted', 'This Swift file is in no target of the project.'),
        );
}
