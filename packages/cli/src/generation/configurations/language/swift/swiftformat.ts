import { join } from 'node:path/posix';
import { PBXPROJ_NAME } from '#cli/config/files/names.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects/dependencies.ts';

import {
    SWIFTFORMAT_COMMAS,
    SWIFT_TOOLS_VERSION,
    SWIFTFORMAT_OPTIONS,
    SWIFTFORMAT_ALWAYS_OFF,
    SWIFTFORMAT_ALL_LEVEL_ON,
    SWIFTFORMAT_RECOMMENDED_OFF,
} from '#cli/config/generation/configurations/language/swift/swiftformat.ts';

function readSwiftVersion(reads: ReadCache, scope: string, projectPath: string): string | undefined {
    const packageText = findCachedText(reads, join(scope, PACKAGE_SWIFT));
    if (packageText !== undefined) return SWIFT_TOOLS_VERSION.exec(packageText)?.[1];
    const projectText = projectPath === '' ? undefined : findCachedText(reads, join(projectPath, PBXPROJ_NAME));
    return projectText === undefined ? undefined : parseBuildSettings(projectText).swiftVersion;
}

/**
Build swiftformat: the SwiftFormat settings of the repository.

@param planned the config file with its scope, level, and target path.
@returns the SwiftFormat settings of the repository.
*/
export function buildSwiftformatFile(planned: PlannedConfigFile): string {
    const { scope } = planned;
    const { reads } = planned.session;
    const level = planned.level;

    const { format } = scope.settings.values;
    const isAll = level === 'all';
    const version = readSwiftVersion(reads, scope.folder.path, getTable(scope.settings, 'swift').xcode_project ?? '');
    const ignored = listIgnoredRules(scope, 'swift/swiftformat');
    const options = {
        ...SWIFTFORMAT_OPTIONS,
        indent: format.indent_style === 'tab' ? 'tab' : format.indent_width,
        maxwidth: format.print_width,
        commas: SWIFTFORMAT_COMMAS[format.trailing_commas],
        linebreaks: format.line_ending,
        ...(version !== undefined && { swiftversion: version }),
    };
    const enabled = isAll ? SWIFTFORMAT_ALL_LEVEL_ON.filter((rule) => !ignored.includes(rule)) : [];
    const disabled = [
        ...new Set([...Object.keys(SWIFTFORMAT_ALWAYS_OFF), ...ignored, ...(isAll ? [] : SWIFTFORMAT_RECOMMENDED_OFF)]),
    ];
    return [
        ...Object.entries(options).map(([option, value]) => `--${option} ${String(value)}`),
        '',
        ...enabled.map((rule) => `--enable ${rule}`),
        '',
        ...disabled.flatMap((rule) => {
            const reason = SWIFTFORMAT_ALWAYS_OFF[rule];
            return [...(reason === undefined ? [] : [reason]), `--disable ${rule}`];
        }),
    ].join('\n');
}
