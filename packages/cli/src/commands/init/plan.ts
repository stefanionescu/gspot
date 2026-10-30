import { formatCount } from '#cli/system/text.ts';
import { getColors } from '#cli/system/terminal.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import { GENERATED_FILE_NOUN } from '#cli/config/generation/write.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { listMisePins, listToolProjectPins } from '#cli/manifests/tools.ts';
import type { InitPlan, InitScan, InitFileRow } from '#cli/types/commands/init.ts';

import {
    COLUMN_GAP,
    ORIGIN_WIDTH,
    NPM_PIN_NOUN,
    CI_FILE_NOTE,
    CI_FILE_NOTES,
    TOOL_PIN_NOUN,
    CI_OFF_MESSAGE,
    ATTRIBUTES_ROW,
    PYTHON_PIN_NOUN,
    GSPOT_FOLDER_NOTE,
    DELETED_RULES_NOTE,
    CONFIGURATION_WIDTH,
    LINT_FOLDER_MESSAGE,
    LINT_FOLDERS_HEADING,
    CHANGE_LATER_MESSAGE,
    UNREAD_SUBMODULE_MESSAGE,
} from '#cli/config/commands/init/plan.ts';

function buildToolProjectRows(configurations: Configuration[]): InitPlan['change'] {
    const pins = listToolProjectPins(configurations);
    const mise = listMisePins(configurations).length;
    const npm = Object.keys(pins.npm).length;
    const python = pins.python.length;
    return [
        ...(mise === 0 ? [] : [{ path: GSPOT_PATHS.miseProject, note: formatCount(mise, TOOL_PIN_NOUN) }]),
        ...(npm === 0
            ? []
            : [{ path: GSPOT_PATHS.npmProject, note: `${formatCount(npm, NPM_PIN_NOUN)}; matching lockfile` }]),
        ...(python === 0
            ? []
            : [
                  {
                      path: GSPOT_PATHS.pythonProject,
                      note: `${formatCount(python, PYTHON_PIN_NOUN)}; matching uv.lock and tool environment`,
                  },
              ]),
    ];
}

function formatFileSection(title: string, rows: InitFileRow[]): string[] {
    if (rows.length === 0) return [];
    const width = Math.max(...rows.map((row) => row.path.length)) + COLUMN_GAP;
    return [title, ...rows.map((row) => `  ${row.path.padEnd(width)}${row.note}`), ''];
}

function buildConfigurationRows(
    { everySelected, configurations }: InitScan,
    { level }: Settings,
): InitPlan['configurations'] {
    return everySelected.map((configuration) => {
        const checks = configuration.checks.filter((check) => level === 'all' || check.level === 'basic').length;
        return {
            configuration: configuration.name,
            origin: configurations.origins.get(configuration.name) as InitPlan['configurations'][number]['origin'],
            checks,
            checksOff: configuration.checks.length - checks,
        };
    });
}

function formatConfigurationSection(rows: InitPlan['configurations'], level: InitPlan['level']): string[] {
    if (rows.length === 0) return ['configurations', '  none', ''];
    const lines = rows.map((row) => {
        return `  ${row.configuration.padEnd(CONFIGURATION_WIDTH)} ${row.origin.padEnd(ORIGIN_WIDTH)} ${formatCount(row.checks, 'check')} (${String(row.checksOff)} off at ${level})`;
    });
    return ['configurations', ...lines, ''];
}

/**
Build the plan that init shows before you accept it.

@param scan the repository facts, answers, and configurations.
@param settings the validated gspot.toml and its generated files.
@param settings.settings the parsed gspot.toml for file generation.
@param settings.settingsText the proposed gspot.toml text.
@param settings.requirements the configurations whose tools the checks need.
@param settings.generated the files to write and their ownership plan.
*/
export function planInitFiles(
    scan: InitScan,
    {
        settings,
        requirements,
        generated,
    }: { settings: Settings; settingsText: string; requirements: Configuration[]; generated: Generation },
): InitPlan {
    const { repository, repositorySetup, conflicts } = scan;
    const attributes = repository.hasGit ? [ATTRIBUTES_ROW] : [];
    const hasAttributes = repository.files.some((file) => file.path === ATTRIBUTES_ROW.path);
    const write: InitPlan['write'] = [
        {
            path: SETTINGS_FILE,
            note: 'your settings' + (scan.template === undefined ? '' : ', from ' + scan.template.file),
        },
        { path: `${GSPOT_FOLDER}/`, note: GSPOT_FOLDER_NOTE },
        ...buildToolProjectRows(requirements),
        ...(hasAttributes ? [] : attributes),
        ...[...generated.files, ...generated.blocks]
            .filter(({ path }) => !path.startsWith(`${GSPOT_FOLDER}/`) && path !== ATTRIBUTES_ROW.path)
            .map(({ path }) => {
                const replaced = conflicts.deleted.find((row) => row.path === path);
                if (replaced !== undefined)
                    return {
                        path,
                        note: [
                            `replaces your file; read the old one with git show HEAD:${path}`,
                            ...replaced.note.split(';').slice(1),
                        ].join(';'),
                    };
                return {
                    path,
                    note: Object.hasOwn(CI_FILE_NOTES, path)
                        ? CI_FILE_NOTES[path as keyof typeof CI_FILE_NOTES]
                        : GENERATED_FILE_NOUN,
                };
            }),
    ];
    return {
        level: settings.level,
        ...(scan.template === undefined
            ? {}
            : { template: { file: scan.template.file, leftOut: scan.template.leftOut } }),
        configurations: buildConfigurationRows(scan, settings),
        write,
        delete: conflicts.deleted.filter(({ path }) => write.every((row) => row.path !== path)),
        keep: [
            ...conflicts.kept,
            ...listSubmodulePaths(repository.index).map((path) => ({ path, note: UNREAD_SUBMODULE_MESSAGE })),
            ...repositorySetup.ci.map((path) => ({ path, note: CI_FILE_NOTE })),
        ],
        change: [...(hasAttributes ? attributes : []), ...conflicts.changed],
        lintFolders: repositorySetup.lintFolders.map((folder) => ({
            path: `${folder}/`,
            note: LINT_FOLDER_MESSAGE,
        })),
    };
}

/**
Format the plan that init prints before it writes anything.

@param plan the configurations and file changes to preview.
*/
export function formatInitPlan(plan: InitPlan): string {
    const { dim } = getColors();
    const lines = [
        ...formatConfigurationSection(plan.configurations, plan.level),
        ...(plan.template === undefined
            ? []
            : formatFileSection(
                  `left out of ${plan.template.file}`,
                  plan.template.leftOut.map(({ key, note }) => ({ path: key, note })),
              )),
        ...formatFileSection('write', plan.write),
        ...formatFileSection(`delete ${dim(DELETED_RULES_NOTE)}`, plan.delete),
        ...formatFileSection('keep', plan.keep),
        ...formatFileSection('change', plan.change),
        ...formatFileSection(LINT_FOLDERS_HEADING, plan.lintFolders),
        CI_OFF_MESSAGE,
        CHANGE_LATER_MESSAGE,
    ];
    return `${lines.join('\n')}\n`;
}
