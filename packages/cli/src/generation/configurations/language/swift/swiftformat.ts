import { join } from 'node:path/posix';
import { find } from '#cli/system/files/reads.ts';
import { PBXPROJ_FILE } from '#cli/config/files/names.ts';
import type { RunCache } from '#cli/types/system/cache.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects/dependencies.ts';

import {
    SWIFTFORMAT_CHECK,
    SWIFTFORMAT_COMMAS,
    SWIFT_TOOLS_VERSION,
    SWIFTFORMAT_OPTIONS,
    SWIFTFORMAT_ALWAYS_OFF,
    SWIFTFORMAT_ALL_LEVEL_ON,
    SWIFTFORMAT_DEFAULT_LEVEL_OFF,
} from '#cli/config/generation/configurations/language/swift/swiftformat.ts';

function readSwiftVersion(cache: RunCache, scopePath: string, projectPath: string): string | undefined {
    const packageText = find(cache, join(scopePath, PACKAGE_SWIFT));
    if (packageText !== undefined) return SWIFT_TOOLS_VERSION.exec(packageText)?.[1];
    const projectText = projectPath === '' ? undefined : find(cache, join(projectPath, PBXPROJ_FILE));
    return projectText === undefined
        ? undefined
        : parseBuildSettings(projectText, join(projectPath, PBXPROJ_FILE)).swiftVersion;
}

/**
Build swiftformat: the SwiftFormat settings of the repository.

@param planned the config file to build.
*/
export function buildSwiftformatFile(planned: PlannedConfigFile): string {
    const { scope } = planned;
    const { cache } = planned.session;
    const { format } = scope.settings.tables;
    const isAll = planned.level === 'all';
    const version = readSwiftVersion(cache, scope.path, getTable(scope.settings, 'swift').xcode_project ?? '');
    const ignored = listIgnoredRules(scope, SWIFTFORMAT_CHECK);
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
        ...new Set([
            ...Object.keys(SWIFTFORMAT_ALWAYS_OFF),
            ...ignored,
            ...(isAll ? [] : SWIFTFORMAT_DEFAULT_LEVEL_OFF),
        ]),
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
