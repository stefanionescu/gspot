import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import type { CoverageReport } from '#cli/types/parsers/swift/coverage.ts';
import { swiftCoverageSchema, swiftPackageCoverageSchema } from '#cli/parsers/schema/swift-coverage.ts';

/**
 * Attribute covered source lines to Swift Package Manager's actual target declarations.
 * @param text native compiler coverage export at the reported Swift path.
 * @param packageText the native package description, including custom target paths.
 * @param folder the selected package folder in the source copy.
 * @returns source target coverage without test targets or derived runner sources.
 */
export function parseSwiftCoverage(text: string, packageText: string, folder: string): CoverageReport {
    const report = swiftCoverageSchema.parse(JSON.parse(text));
    const description = swiftPackageCoverageSchema.parse(JSON.parse(packageText));
    const root = realpathSync(folder);
    const measured = new Map(
        report.data.flatMap((data) => data.files).map((file) => [file.filename, file.summary.lines]),
    );
    return {
        targets: description.targets
            .filter((target) => target.type !== 'test' && target.module_type === 'SwiftTarget')
            .flatMap((target) => {
                const lines = target.sources.flatMap((source) => {
                    const file = measured.get(resolve(root, target.path, source));
                    return file === undefined ? [] : [file];
                });
                if (lines.length === 0)
                    throw new Error(`The Swift coverage report has no source lines for target ${target.name}.`);
                const count = lines.reduce((total, entry) => total + entry.count, 0);
                const covered = lines.reduce((total, entry) => total + entry.covered, 0);
                return [{ name: target.name, lineCoverage: count === 0 ? 1 : covered / count }];
            }),
    };
}
