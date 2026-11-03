import { LEVELS } from '#cli/config/manifests.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { EXIT_FINDINGS } from '#cli/config/engine.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { readTemplate } from '#cli/commands/init/template.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import { formatDetection } from '#cli/commands/init/detection.ts';
import { InvalidArgumentError } from '@commander-js/extra-typings';
import { formatInitPlan } from '#cli/generation/setup/file-plan.ts';
import { print, runCancelableCommand } from '#cli/system/terminal.ts';
import { assertFilesCommitted } from '#cli/generation/setup/conflicts.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import type { CommandResult, CanceledCommandJson } from '#cli/types/system.ts';
import type { InitOptions, ApplyReport, InitPlanning } from '#cli/types/generation.ts';
import type { InitJson, InitFlags, CommandDefinition } from '#cli/types/commands/edits.ts';

import {
    FROM_OPTION,
    LEVEL_OPTION,
    NEXT_PIN_MESSAGE,
    WROTE_PLAN_MESSAGE,
    NEXT_STEPS_MESSAGE,
    FROM_CONFLICT_MESSAGE,
    CONFIGURATIONS_OPTION,
    SETTINGS_EXIST_MESSAGE,
    NO_CONFIGURATIONS_FLAG,
    INSTALLATION_STOPPED_MESSAGE,
    CONFIGURATION_LIST_SEPARATOR,
} from '#cli/config/commands/edits.ts';

const CONFIGURATIONS_CONFLICT_MESSAGE =
    '--configurations cannot run with --no-configurations. Give the names, or select none.';

/**
Install the tools of the settings that init wrote, and turn on the Git hooks, as gspot install does.

@param root the repository root.
@param written what init planned and wrote.
@param written.initPlan what planInit returned.
@param written.applied the generated files that init wrote.
@param cancelSignal stops the installers.
*/
async function installInitTools(
    root: string,
    { initPlan, applied }: { initPlan: InitPlanning; applied: ApplyReport },
    cancelSignal: AbortSignal,
): Promise<CommandResult<InitJson>> {
    const { plan, settingsText, pinPath } = initPlan;
    const session = { ...(await openSession(root, { cancelSignal })), startRunner: initPlan.session.startRunner };
    const installation = await installTools(session, {
        writer: openFiles(root),
        generated: { files: buildToolProjects(session) },
        checkTools: listHostCheckTools(session.configuredChecks),
    });
    const { installed, missing, steps } = installation;
    const notes = [...applied.notes, ...installation.notes];
    const lines = [WROTE_PLAN_MESSAGE, ...applied.notes, ...installed, ...installation.notes, ...missing];
    const next =
        pinPath === undefined
            ? NEXT_STEPS_MESSAGE
            : NEXT_PIN_MESSAGE.replace('{runner}', () => session.startRunner.name).replace('{file}', () => pinPath);
    return {
        text: [...lines, '', next].join('\n'),
        json: { root, plan, settingsText, ...applied, installed, missing, steps, notes: [...notes, next] },
        exitCode: missing.length === 0 ? 0 : EXIT_FINDINGS,
    };
}

async function runInitCommand(
    root: string,
    options: InitOptions,
): Promise<CommandResult<InitJson | CanceledCommandJson>> {
    if (findText(root, SETTINGS_FILE) !== undefined) throw new GspotError('arguments', SETTINGS_EXIST_MESSAGE);
    const initPlan = await planInit(root, options);
    await assertFilesCommitted(root, initPlan.replaced);
    print(formatDetection(initPlan.detection));
    print(formatInitPlan(initPlan.plan, initPlan.settingsText));
    const applied = await writeInitFiles(root, initPlan);
    return await runCancelableCommand(
        (cancelSignal) => installInitTools(root, { initPlan, applied }, cancelSignal),
        INSTALLATION_STOPPED_MESSAGE,
    );
}

function parseConfigurationNames(value: string, previous: InitFlags['configurations']): string[] {
    if (previous === false) throw new GspotError('arguments', CONFIGURATIONS_CONFLICT_MESSAGE);
    const names = value
        .split(CONFIGURATION_LIST_SEPARATOR)
        .map((name) => name.trim())
        .filter((name) => name !== '');
    if (names.length === 0) throw new InvalidArgumentError('Name at least one configuration.');
    return [...(Array.isArray(previous) ? previous : []), ...names];
}

function assertTemplateFlags(from: string | undefined, configurations: InitFlags['configurations']): void {
    if (from === undefined || configurations === undefined) return;
    const flag = configurations === false ? '--no-configurations' : '--configurations';
    throw new GspotError(
        'arguments',
        FROM_CONFLICT_MESSAGE.replace('{flag}', () => flag),
    );
}

export const INIT_COMMAND: CommandDefinition<[], InitFlags> = {
    name: 'init',
    options: [
        { flags: FROM_OPTION },
        { flags: CONFIGURATIONS_OPTION, parse: parseConfigurationNames },
        {
            flags: NO_CONFIGURATIONS_FLAG,
            // Commander passes a negated flag through its parser with no value, so the parser sees earlier names.
            parse: (_value: string | undefined, previous: InitFlags['configurations']): false => {
                if (Array.isArray(previous)) throw new GspotError('arguments', CONFIGURATIONS_CONFLICT_MESSAGE);
                return false;
            },
        },
        { flags: LEVEL_OPTION, choices: LEVELS },
    ],
    run: async (_arguments, { from, configurations, level }, { root, cwd }) => {
        assertTemplateFlags(from, configurations);
        const template = from === undefined ? undefined : readTemplate(from, cwd);
        return await runInitCommand(root, {
            cwd,
            level,
            template,
            configurations: configurations === false ? [] : configurations,
        });
    },
};
