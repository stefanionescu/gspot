import { print } from '#cli/system/terminal.ts';
import { LEVELS } from '#cli/config/manifests.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { EXIT_FINDINGS } from '#cli/config/system.ts';
import { findText } from '#cli/system/files/reads.ts';
import { formatDetection } from '#cli/commands/init/report.ts';
import { listHostCheckTools } from '#cli/engine/plan/tools.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import { formatInitPlan } from '#cli/generation/setup/report.ts';
import { readTemplate } from '#cli/generation/setup/template.ts';
import { runCancelableCommand } from '#cli/system/processes/signals.ts';
import { assertFilesCommitted } from '#cli/generation/setup/conflicts.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import type { CommandResult, CanceledCommandJson } from '#cli/types/system.ts';
import type { ApplyReport, InitOptions, InitPlanning } from '#cli/types/generation.ts';
import { FROM_OPTION, LEVEL_OPTION, CONFIGURATIONS_OPTION } from '#cli/config/commands/help.ts';
import type { InitJson, InitFlags, CommandLocation, CommandDefinition } from '#cli/types/commands.ts';

import {
    NEXT_PIN_MESSAGE,
    NEXT_STEPS_MESSAGE,
    WROTE_PLAN_MESSAGE,
    INIT_STOPPED_MESSAGE,
    FROM_CONFLICT_MESSAGE,
    SETTINGS_EXIST_MESSAGE,
} from '#cli/config/commands/setup.ts';

async function installInitTools(
    root: string,
    { initPlan, applied }: { initPlan: InitPlanning; applied: ApplyReport },
    cancelSignal: AbortSignal,
): Promise<CommandResult<InitJson>> {
    const { plan, settingsText, pinPath } = initPlan;
    const session = await openSession(root, { cancelSignal, startRunner: initPlan.session.startRunner });
    const installation = await installTools(session, { checkTools: listHostCheckTools(session) });
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

async function runInitCommand({
    root,
    level,
    template,
    configurations,
}: InitOptions & CommandLocation): Promise<CommandResult<InitJson | CanceledCommandJson>> {
    if (findText(root, SETTINGS_FILE) !== undefined) throw new GspotError('arguments', SETTINGS_EXIST_MESSAGE);
    const initPlan = await planInit(root, { level, template, configurations });
    await assertFilesCommitted(root, initPlan.replaced);
    print(formatDetection(initPlan.detection));
    print(formatInitPlan(initPlan.plan, initPlan.settingsText));
    return await runCancelableCommand(
        async (cancelSignal) =>
            installInitTools(root, { initPlan, applied: await writeInitFiles(root, initPlan) }, cancelSignal),
        INIT_STOPPED_MESSAGE,
    );
}

export const INIT_COMMAND: CommandDefinition<[], InitFlags, InitOptions> = {
    name: 'init',
    options: [
        { flags: FROM_OPTION },
        { flags: CONFIGURATIONS_OPTION, list: 'Name at least one configuration.' },
        { flags: LEVEL_OPTION, choices: LEVELS },
    ],
    parse: ({ flags: { from, configurations, level }, cwd }) => {
        if (from !== undefined && configurations !== undefined)
            throw new GspotError('arguments', FROM_CONFLICT_MESSAGE);
        return { level, template: from === undefined ? undefined : readTemplate(from, cwd), configurations };
    },
    run: runInitCommand,
};
