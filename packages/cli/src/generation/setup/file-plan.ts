import { styleText } from 'node:util';
import { isInScope } from '#cli/system/paths.ts';
import { getRequired } from '#cli/system/tables.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import type { Generation } from '#cli/types/tools.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { Settings } from '#cli/types/settings.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { Configuration } from '#cli/types/manifests.ts';
import { formatCount, formatScope } from '#cli/system/text.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { listMisePins, listPackagePins } from '#cli/tools/pins.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { CARRYOVER_GROUPS, CARRYOVER_HEADING } from '#cli/config/repository/setup.ts';
import type { InitPlan, InitScan, InitFileRow, CarryoverRow, ConflictingConfigs } from '#cli/types/generation.ts';

import {
    COLUMN_GAP,
    ORIGIN_WIDTH,
    NPM_PIN_NOUN,
    CI_FILE_NOTE,
    CI_FILE_NOTES,
    TOOL_PIN_NOUN,
    CI_OFF_MESSAGE,
    ATTRIBUTES_ROW,
    ADDS_BLOCK_NOTE,
    PYTHON_PIN_NOUN,
    GSPOT_FOLDER_NOTE,
    FOREIGN_HOOK_NOTE,
    DELETED_RULES_NOTE,
    GENERATED_FILE_NOUN,
    CONFIGURATION_WIDTH,
    LINT_FOLDER_MESSAGE,
    PRETTIER_SCRIPT_NOTE,
    LINT_FOLDERS_HEADING,
    CHANGE_LATER_MESSAGE,
    ALWAYS_SELECTED_NOUN,
    LINT_COMMANDS_HEADING,
    INSTALL_LOCKFILE_NOTE,
    UNREAD_SUBMODULE_MESSAGE,
    DROPPED_LINE_SETTINGS_NOTE,
} from '#cli/config/generation.ts';

function buildToolProjectRows(configurations: Configuration[]): InitPlan['change'] {
    const pins = listPackagePins(
        configurations.map((configuration) => ({
            ...configuration,
            tools: configuration.tools.filter((tool) => tool.kind === 'program'),
        })),
    );
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

function formatFileSection(title: string, rows: InitFileRow[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
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

function formatCheckCounts(rows: InitPlan['configurations'], level: InitPlan['level']): string {
    const checks = rows.reduce((total, row) => total + row.checks, 0);
    const checksOff = rows.reduce((total, row) => total + row.checksOff, 0);
    return `${formatCount(checks, 'check')} (${String(checksOff)} off at ${level})`;
}

function formatConfigurationSection(rows: InitPlan['configurations'], level: InitPlan['level']): string[] {
    const always = rows.filter((row) => row.origin === 'always');
    const selected = rows.filter((row) => row.origin !== 'always');
    const scopeWidth = Math.max(0, ...selected.map((row) => row.scopes.join(', ').length));
    const lines = selected.map((row) =>
        [
            row.configuration.padEnd(CONFIGURATION_WIDTH),
            row.origin.padEnd(ORIGIN_WIDTH),
            row.scopes.join(', ').padEnd(scopeWidth),
            formatCheckCounts([row], level),
        ].join(' '),
    );
    const alwaysLine = `${formatCount(always.length, ALWAYS_SELECTED_NOUN)}: ${formatCheckCounts(always, level)}`;
    return ['configurations', ...[...lines, alwaysLine].map((line) => `  ${line}`), ''];
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

/**
Word the table of what init carries: one line per replaced config, and one per weakening that needs a reason.

@param rows one row per replaced config.
*/
export function listCarryoverLines(rows: CarryoverRow[]): InitFileRow[] {
    return rows.flatMap((row) => {
        const groups = Object.entries(CARRYOVER_GROUPS)
            .filter(([key]) => row[key as keyof typeof CARRYOVER_GROUPS].length > 0)
            .map(([key, title]) => `${title}: ${row[key as keyof typeof CARRYOVER_GROUPS].join(', ')}`);
        const note = [...(row.covered > 0 ? [`covered: ${String(row.covered)}`] : []), ...groups].join('; ');
        return [
            ...(note === '' ? [] : [{ path: row.path, note }]),
            ...row.reasons.map((line) => ({ path: row.path, note: `needs a reason: ${line}` })),
        ];
    });
}

/**
Build the file changes that init reports before it writes them.

@param scan the repository facts, answers, and configurations.
@param settings the validated gspot.toml and its generated files.
@param settings.settings the parsed gspot.toml for file generation.
@param settings.requirements the configurations whose tools the checks need.
@param settings.generated the files to write and their ownership plan.
*/
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
    const write: InitPlan['write'] = [
        {
            path: SETTINGS_FILE,
            note: 'your settings' + (scan.template === undefined ? '' : ', from ' + scan.template.file),
        },
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

/**
Format the plan that init prints before it writes anything.

@param plan the configurations and file changes to preview.
@param settingsText the gspot.toml text that init writes.
*/
export function formatInitPlan(plan: InitPlan, settingsText: string): string {
    const lines = [
        ...formatConfigurationSection(plan.configurations, plan.level),
        ...(plan.from === undefined
            ? []
            : formatFileSection(
                  `left out of ${plan.from.file}`,
                  plan.from.leftOutSettings.map(({ key, note }) => ({ path: key, note })),
              )),
        ...formatFileSection('write', plan.write),
        ...formatFileSection(
            `delete ${styleText('dim', DELETED_RULES_NOTE, { stream: process.stdout })}`,
            plan.deleted,
        ),
        ...formatFileSection('keep', plan.keep),
        ...formatFileSection('change', plan.change),
        ...formatFileSection(LINT_FOLDERS_HEADING, plan.lintFolders),
        ...formatFileSection(CARRYOVER_HEADING, listCarryoverLines(plan.carryover)),
        ...formatFileSection(
            LINT_COMMANDS_HEADING,
            plan.lintCommands.map(({ file, line, command, fix }) => ({
                path: `${file}:${String(line)}`,
                note: `${command}  ${fix}`,
            })),
        ),
        CI_OFF_MESSAGE,
        CHANGE_LATER_MESSAGE,
        '',
        SETTINGS_FILE,
        ...settingsText
            .trimEnd()
            .split('\n')
            .map((line) => (line === '' ? '' : `  ${line}`)),
    ];
    return `${lines.join('\n')}\n`;
}
