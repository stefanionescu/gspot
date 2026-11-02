import { join } from 'node:path/posix';
import { find } from '#cli/system/files/reads.ts';
import type { RunCache } from '#cli/types/system.ts';
import { getTable, selectFormat } from '#cli/settings/scopes.ts';
import { listOffRules } from '#cli/configurations/rule-options.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode.ts';
import { PBXPROJ_FILE, PACKAGE_SWIFT } from '#cli/config/parsers.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

import {
    SWIFT_FILES,
    SWIFTFORMAT_COMMAS,
    SWIFT_TOOLS_VERSION,
    SWIFTFORMAT_OPTIONS,
    SWIFTFORMAT_OFF_REASONS,
    SWIFTFORMAT_ALL_LEVEL_ON,
} from '#cli/config/configurations/swift.ts';

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
export function buildSwiftformatFile(planned: PlannedConfig): string {
    const { scope } = planned;
    const { cache } = planned.session;
    const format = selectFormat(scope.settings, SWIFT_FILES);
    const isAll = planned.level === 'all';
    const version = readSwiftVersion(cache, scope.path, getTable(scope.settings, 'swift').xcode_project ?? '');
    const disabled = listOffRules(planned);
    const options = {
        ...SWIFTFORMAT_OPTIONS,
        indent: format.indent_style === 'tab' ? 'tab' : format.indent_width,
        maxwidth: format.print_width,
        commas: SWIFTFORMAT_COMMAS[format.trailing_commas],
        linebreaks: 'lf',
        ...(version !== undefined && { swiftversion: version }),
    };
    const enabled = isAll ? SWIFTFORMAT_ALL_LEVEL_ON.filter((rule) => !disabled.includes(rule)) : [];
    return [
        ...Object.entries(options).map(([option, value]) => `--${option} ${String(value)}`),
        '',
        ...enabled.map((rule) => `--enable ${rule}`),
        '',
        ...disabled.flatMap((rule) => {
            const reason = SWIFTFORMAT_OFF_REASONS[rule];
            return [...(reason === undefined ? [] : [reason]), `--disable ${rule}`];
        }),
    ].join('\n');
}
