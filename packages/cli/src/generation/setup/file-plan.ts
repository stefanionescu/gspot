import cliPackage from '#cli-package' with { type: 'json' };
import {
    ADDS_BLOCK_NOTE,
    ATTRIBUTES_ROW,
    CI_FILE_NOTE,
    CI_FILE_NOTES,
    DROPPED_LINE_SETTINGS_NOTE,
    FOREIGN_HOOK_NOTE,
    GENERATED_FILE_NOUN,
    GSPOT_FOLDER_NOTE,
    INSTALL_LOCKFILE_NOTE,
    LINT_FOLDER_MESSAGE,
    NPM_PIN_NOUN,
    PRETTIER_SCRIPT_NOTE,
    PYTHON_PIN_NOUN,
    TOOL_PIN_NOUN,
    UNREAD_SUBMODULE_MESSAGE,
} from '#cli/config/generation/setup.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { formatScope, isInScope } from '#cli/repository/scopes.ts';
import { getRequired } from '#cli/system/tables.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import { listMisePins, listPackagePins } from '#cli/tools/pins.ts';
import type { ConflictingConfigs, InitFileRow, InitPlan, InitScan } from '#cli/types/generation.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Settings } from '#cli/types/settings.ts';
import type { Generation } from '#cli/types/tools.ts';

function buildToolProjectRows(configurations: Configuration[]): InitPlan['change'] {
    const pins = listPackagePins(configurations);
    const mise = listMisePins(configurations).length;
    const npm = Object.keys(pins.npm).length;
    const python = pins.python.length;
    return [
        ...(mise === 0 ? [] : [{ path: GSPOT_PATHS.miseProject, note: formatCount(mise, TOOL_PIN_NOUN) }]),
        ...(npm === 0
            ? []
            : [{ path: GSPOT_PATHS.npmProject, note: `${formatCount(npm, NPM_PIN_NOUN)}; ${INSTALL_LOCKFILE_NOTE}` }]),
        ...(python === 0
            ? []
            : [
                  {
                      path: GSPOT_PATHS.pythonProject,
                      note: `${formatCount(python, PYTHON_PIN_NOUN)}; ${INSTALL_LOCKFILE_NOTE}`,
                  },
              ]),
    ];
}

function listOutermostScopes(name: string, scopes: InitScan['scopes']): string[] {
    const selecting = scopes
        .filter((scope) => scope.configurations.some((configuration) => configuration.name === name))
        .map((scope) => scope.path);
    return selecting
        .filter((path) => selecting.every((other) => other === path || !isInScope(path, other)))
        .map((path) => formatScope(path));
}

function buildConfigurationRows(
    { everySelected, configurations, scopes }: InitScan,
    { level }: Settings,
): InitPlan['configurations'] {
    return everySelected.map((configuration) => {
        const checks = configuration.checks.filter((check) => level === 'all' || check.level === 'basic').length;
        return {
            configuration: configuration.name,
            origin: getRequired(configurations.origins, configuration.name, 'configuration origin'),
            scopes: listOutermostScopes(configuration.name, scopes),
            checks,
            checksOff: configuration.checks.length - checks,
        };
    });
}

function buildGeneratedRow(path: string, conflicts: ConflictingConfigs): InitFileRow {
    const replaced = conflicts.deleted.find((row) => row.path === path);
    if (replaced !== undefined)
        return {
            path,
            note: [
                `replaces your file; read the old one with git show HEAD:${path}`,
                ...(replaced.unreadablePrettier ? [PRETTIER_SCRIPT_NOTE] : []),
                ...(replaced.dropsLineEndings ? [DROPPED_LINE_SETTINGS_NOTE] : []),
            ].join('; '),
        };
    return {
        path,
        note: Object.hasOwn(CI_FILE_NOTES, path)
            ? CI_FILE_NOTES[path as keyof typeof CI_FILE_NOTES]
            : GENERATED_FILE_NOUN,
    };
}

function buildAttributesRow(crlfPaths: string[]): InitFileRow {
    if (crlfPaths.length === 0) return ATTRIBUTES_ROW;
    const files = formatCount(crlfPaths.length, 'file');
    return {
        ...ATTRIBUTES_ROW,
        note: `${ATTRIBUTES_ROW.note}; then run git add --renormalize . for the ${files} that the index holds with CRLF`,
    };
}

function buildGeneratedRows(generated: Generation, conflicts: ConflictingConfigs, tracked: Set<string>): InitFileRow[] {
    return [...generated.files, ...generated.blocks.filter(({ path }) => !tracked.has(path))]
        .filter(({ path }) => !isGspotPath(path) && path !== ATTRIBUTES_ROW.path)
        .map(({ path }) => buildGeneratedRow(path, conflicts));
}

export function planInitFiles(
    scan: InitScan,
    { settings, requirements, generated }: { settings: Settings; requirements: Configuration[]; generated: Generation },
): InitPlan {
    const { repository, repositorySetup, conflicts } = scan;
    const tracked = new Set(repository.files.map((file) => file.path));
    const hasAttributes = tracked.has(ATTRIBUTES_ROW.path);
    const attributesRow = buildAttributesRow(scan.crlfPaths);
    const blockRows = generated.blocks
        .filter(({ path }) => tracked.has(path) && path !== ATTRIBUTES_ROW.path)
        .map(({ path }) => ({ path, note: ADDS_BLOCK_NOTE }));
    const settingsSource = scan.template === undefined ? '' : `, from ${scan.template.file}`;
    const write: InitPlan['write'] = [
        { path: SETTINGS_FILE, note: `your settings${settingsSource}` },
        { path: `${GSPOT_FOLDER}/`, note: GSPOT_FOLDER_NOTE },
        ...buildToolProjectRows(requirements),
        ...(hasAttributes ? [] : [attributesRow]),
        ...buildGeneratedRows(generated, conflicts, tracked),
    ];
    return {
        level: settings.level,
        ...(scan.template !== undefined && {
            from: { file: scan.template.file, leftOutSettings: scan.template.leftOut },
        }),
        configurations: buildConfigurationRows(scan, settings),
        write,
        deleted: conflicts.deleted
            .filter(({ path }) => write.every((row) => row.path !== path))
            .map(({ path, tool, unreadablePrettier }) => ({
                path,
                note: [
                    `replaced by the generated file for ${tool}`,
                    ...(unreadablePrettier ? [PRETTIER_SCRIPT_NOTE] : []),
                ].join('; '),
            })),
        keep: [
            ...conflicts.kept,
            ...listSubmodulePaths(repository.index).map((path) => ({ path, note: UNREAD_SUBMODULE_MESSAGE })),
            ...repositorySetup.ci.map((path) => ({ path, note: CI_FILE_NOTE })),
            ...repositorySetup.hooks.map(({ path }) => ({ path, note: FOREIGN_HOOK_NOTE })),
        ],
        change: [
            ...(hasAttributes ? [attributesRow] : []),
            ...(scan.pinPath === undefined ? [] : [{ path: scan.pinPath, note: `pins gspot ${cliPackage.version}` }]),
            ...blockRows,
            ...conflicts.changed,
        ],
        lintFolders: repositorySetup.lintFolders.map((folder) => ({
            path: `${folder}/`,
            note: LINT_FOLDER_MESSAGE,
        })),
        lintCommands: scan.lintCommands,
        carryover: scan.carryover,
    };
}
