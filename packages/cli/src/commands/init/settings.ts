// What init fills in from the repository: every setting whose manifest says where to look (K-93).
import type { Manifest } from '#cli/configurations/manifests.ts';
import type { SettingSpec } from '#cli/configurations/schema.ts';
import type { ManifestFacts } from '#cli/repository/manifests.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';

type Detect = NonNullable<SettingSpec['detect']>;

function dependencyNames(facts: ManifestFacts[]): Set<string> {
    return new Set(facts.flatMap((fact) => [...Object.keys(fact.dependencies), ...Object.keys(fact.installed)]));
}

function folderNames(files: TrackedFile[]): Set<string> {
    const folders = new Set<string>();
    for (const file of files) {
        const parts = file.path.split('/');
        for (let depth = 1; depth < parts.length; depth += 1) folders.add(parts.slice(0, depth).join('/'));
    }
    return folders;
}

function detectedValue(detect: Detect, dependencies: Set<string>, folders: Set<string>): unknown {
    if (detect.dependency !== undefined && dependencies.has(detect.dependency)) return true;
    for (const [name, value] of Object.entries(detect.dependencies ?? {})) if (dependencies.has(name)) return value;
    for (const folder of detect.folders ?? []) if (folders.has(folder)) return folder;
    for (const [folder, value] of Object.entries(detect.folder_values ?? {})) if (folders.has(folder)) return value;
    return undefined;
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
    const dependencies = dependencyNames(facts);
    const folders = folderNames(files);
    const found: DetectedSetting[] = [];
    for (const manifest of manifests)
        for (const spec of manifest.settings) {
            if (spec.detect === undefined || found.some((entry) => entry.key === spec.name)) continue;
            const value = detectedValue(spec.detect, dependencies, folders);
            if (value !== undefined) found.push({ key: spec.name, value, configuration: manifest.configuration.name });
        }
    return found;
}

export type DetectedSetting = { key: string; value: unknown; configuration: string };
