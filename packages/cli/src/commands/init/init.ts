import { InvalidArgumentError } from '@commander-js/extra-typings';

import { formatDetection } from '#cli/commands/init/detection.ts';
import { readTemplate } from '#cli/commands/init/template.ts';
import {
    CONFIGURATION_LIST_SEPARATOR,
    CONFIGURATIONS_OPTION,
    FROM_CONFLICT_MESSAGE,
    FROM_OPTION,
    INSTALLATION_STOPPED_MESSAGE,
    LEVEL_OPTION,
    NEXT_PIN_MESSAGE,
    NEXT_STEPS_MESSAGE,
    SETTINGS_EXIST_MESSAGE,
    WROTE_PLAN_MESSAGE,
} from '#cli/config/commands/edits.ts';
import { EXIT_FINDINGS } from '#cli/config/engine.ts';
import { LEVELS } from '#cli/config/manifests.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { assertFilesCommitted } from '#cli/generation/setup/conflicts.ts';
import { formatInitPlan } from '#cli/generation/setup/file-plan.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { print, runCancelableCommand } from '#cli/system/terminal.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import type { CommandDefinition, InitFlags, InitJson } from '#cli/types/commands/edits.ts';
import type { ApplyReport, InitOptions, InitPlanning } from '#cli/types/generation.ts';
import type { CanceledCommandJson, CommandResult } from '#cli/types/system.ts';

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
    const names = value
        .split(CONFIGURATION_LIST_SEPARATOR)
        .map((name) => name.trim())
        .filter((name) => name !== '');
    if (names.length === 0) throw new InvalidArgumentError('Name at least one configuration.');
    return [...(previous ?? []), ...names];
}

function assertTemplateFlags(from: string | undefined, configurations: InitFlags['configurations']): void {
    if (from === undefined || configurations === undefined) return;
    throw new GspotError('arguments', FROM_CONFLICT_MESSAGE);
}

export const INIT_COMMAND: CommandDefinition<[], InitFlags> = {
    name: 'init',
    options: [
        { flags: FROM_OPTION },
        { flags: CONFIGURATIONS_OPTION, parse: parseConfigurationNames },
        { flags: LEVEL_OPTION, choices: LEVELS },
    ],
    run: async ({ flags: { from, configurations, level }, root, cwd }) => {
        assertTemplateFlags(from, configurations);
        const template = from === undefined ? undefined : readTemplate(from, cwd);
        return await runInitCommand(root, { cwd, level, template, configurations });
    },
};
