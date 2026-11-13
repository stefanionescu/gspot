import { posix } from 'node:path';

import { NON_WORD_CHARACTERS } from '#cli/config/configurations/structure.ts';
import { SWIFT_EXTENSION } from '#cli/config/parsers/code.ts';
import { PACKAGE_SWIFT, PBXPROJ_SUFFIX } from '#cli/config/parsers/projects.ts';
import { listPackageModules } from '#cli/parsers/projects/swift-package.ts';
import { isInTargetFolder, parseProjectSources } from '#cli/parsers/projects/xcode/sources.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { SwiftModule } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

function listXcodeModules(session: Session, path: string, swiftFiles: string[]): SwiftModule[] {
    const project = parseProjectSources(readText(session.cache, path), path);
    return project.targets.map((target) => ({
        name: target.name.replaceAll(NON_WORD_CHARACTERS, '_'),
        files: swiftFiles.filter((file) => target.sources.includes(file) || isInTargetFolder(file, target.folders)),
    }));
}

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
