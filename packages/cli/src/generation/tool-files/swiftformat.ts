import { join } from 'node:path/posix';
import { parseBuildSettings } from '#cli/parsers/xcode.ts';
import { PBXPROJ_NAME } from '#cli/config/parsers/xcode.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';
import { SWIFT_TOOLS_VERSION } from '#cli/config/generation/tool-files.ts';
import { type ToolFileContext, type SwiftVersionInput } from '#cli/types/generation/files.ts';

import {
    SWIFTFORMAT_OFF,
    SWIFTFORMAT_COMMAS,
    SWIFTFORMAT_OPTIONS,
    SWIFTFORMAT_ALL_LEVEL_ON,
    SWIFTFORMAT_RECOMMENDED_OFF,
} from '#cli/config/generation/swift.ts';

function readSwiftVersion(input: SwiftVersionInput, projectPath: string): string | undefined {
    const { scope, reads } = input;
    const packageText = readCachedText(reads, join(scope, PACKAGE_SWIFT));
    if (packageText !== undefined) return SWIFT_TOOLS_VERSION.exec(packageText)?.[1];
    const projectText = projectPath === '' ? undefined : readCachedText(reads, join(projectPath, PBXPROJ_NAME));
    return projectText === undefined ? undefined : parseBuildSettings(projectText).swiftVersion;
}
/**
 * Build the SwiftFormat file from the settings.
 *
 * @param context the tool file to build.
 * @returns the SwiftFormat settings of the repository.
 */
function buildSwiftformatFile(context: ToolFileContext): string {
    const { selection } = context;
    const { root, reads } = context.session;
    const level = context.level;

    const { format, rulesOff } = selection.view;
    const isAll = level === 'all';
    const version = readSwiftVersion(
        { root, scope: selection.scope.path, reads },
        selection.view.options('swift').xcode_project ?? '',
    );
    const document = {
        options: {
            ...SWIFTFORMAT_OPTIONS,
            indent: format.indent_style === 'tab' ? 'tab' : format.indent_width,
            maxwidth: format.print_width,
            commas: SWIFTFORMAT_COMMAS[format.trailing_commas],
            linebreaks: format.line_ending,
            ...(version === undefined ? {} : { swiftversion: version }),
        },
        enable: isAll ? SWIFTFORMAT_ALL_LEVEL_ON.filter((rule) => !rulesOff('swift/swiftformat').includes(rule)) : [],
        disable: [
            ...new Set([
                ...Object.keys(SWIFTFORMAT_OFF),
                ...rulesOff('swift/swiftformat'),
                ...(isAll ? [] : SWIFTFORMAT_RECOMMENDED_OFF),
            ]),
        ],
        comments: SWIFTFORMAT_OFF,
    };

    return (
        [
            ...Object.entries(document.options).map(([option, value]) => `--${option} ${String(value)}`),
            '',
            ...document.enable.map((rule) => `--enable ${rule}`),
            '',
            ...document.disable.flatMap((rule) => {
                const reason = document.comments[rule];
                return [...(reason === undefined ? [] : [reason]), `--disable ${rule}`];
            }),
            '',
        ].join('\n') + '\n'
    );
}

export { buildSwiftformatFile };
