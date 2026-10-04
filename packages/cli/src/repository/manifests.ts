import { readText } from '#cli/platform/source.ts';
import { isPrivateToolPath } from '#cli/repository/selectors.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { manifestParser, parsePackageManifest } from '#cli/parsers/packages.ts';
import type { ManifestSummary, PackageManifest } from '#cli/types/parsers/packages.ts';

/**
 * Validated summaries from every supported manifest in the tree.
 * @param root the repository root
 * @param files the tracked files
 * @returns one fields entry per supported manifest
 */
export function readManifests(root: string, files: TrackedFile[]): ManifestSummary[] {
    return files
        .filter(
            (file) =>
                file.kind === 'source' &&
                !isPrivateToolPath(file.path) &&
                !file.path.split('/').includes('node_modules'),
        )
        .flatMap((file) => {
            try {
                const parse = manifestParser(file.path);
                if (parse === undefined) return [];
                const text = readText(root, file.path);
                if (text === undefined) throw new Error(`Manifest is missing: ${file.path}`);
                return [parse(text)];
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
            }
        });
}

/**
 * Read and validate the package fields used by repository and check consumers.
 * @param root the repository root
 * @param path the repository-relative package.json path
 * @returns the validated package fields, or undefined when the file is absent
 */
export function readPackageManifest(root: string, path: string): PackageManifest | undefined {
    const text = readText(root, path);
    if (text === undefined) return undefined;
    return parsePackageManifest(text, path);
}
