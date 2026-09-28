// What init fills in from the repository: every setting whose manifest says where to look (K-93).
import type { Manifest } from '#cli/types/configurations.ts';
import type { Detect, DetectedSetting } from '#cli/types/commands/init.ts';
import type { TrackedFile, ManifestFacts } from '#cli/types/repository/repository.ts';

function folderNames(files: TrackedFile[]): Set<string> {
    const folders = new Set<string>();
    for (const file of files) {
        const parts = file.path.split('/');
        for (let depth = 1; depth < parts.length; depth += 1) folders.add(parts.slice(0, depth).join('/'));
    }
    return folders;
}

// Ordered mappings can select a false or undefined value, so retain the matching entry itself.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Its callers sit at the complexity or length limit; inlining the expression pushes them over.
function firstMatch(mapping: Record<string, unknown> | undefined, names: Set<string>): [string, unknown] | undefined {
    return Object.entries(mapping ?? {}).find(([name]) => names.has(name));
}

function detectedValue(detect: Detect, dependencies: Set<string>, folders: Set<string>): unknown {
    if (detect.dependency !== undefined && dependencies.has(detect.dependency)) return true;
    const dependency = firstMatch(detect.dependencies, dependencies);
    if (dependency !== undefined) return dependency[1];
    const folder = detect.folders?.find((name) => folders.has(name));
    if (folder !== undefined) return folder;
    return firstMatch(detect.folder_values, folders)?.[1];
}

/**
 * The settings init can fill from what the repository holds, each with the value its detect table gives.
 * @param manifests the selected configurations
 * @param facts the project manifests read from the tree
 * @param files the tracked files
 * @returns the detected settings in manifest order, one per setting
 */
export function detectedSettings(
    manifests: Manifest[],
    facts: ManifestFacts[],
    files: TrackedFile[],
): DetectedSetting[] {
    const dependencies = new Set(
        facts.flatMap((fact) => [...Object.keys(fact.dependencies), ...Object.keys(fact.installed)]),
    );
    const folders = folderNames(files);
    const seen = new Set<string>();
    return manifests.flatMap((manifest) =>
        manifest.settings.flatMap((spec) => {
            if (spec.detect === undefined || seen.has(spec.name)) return [];
            const value = detectedValue(spec.detect, dependencies, folders);
            if (value === undefined) return [];
            seen.add(spec.name);
            return [{ key: spec.name, value, configuration: manifest.configuration.name }];
        }),
    );
}
