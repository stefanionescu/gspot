import { formatDetection } from '#cli/commands/init/report.ts';
import {
    CONFIGURATIONS_OPTION,
    FROM_CONFLICT_MESSAGE,
    FROM_OPTION,
    INIT_STOPPED_MESSAGE,
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
import { assertFilesCommitted } from '#cli/generation/setup/conflicts.ts';
import { formatInitPlan } from '#cli/generation/setup/file-plan.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import { readTemplate } from '#cli/generation/setup/settings.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { print, runCancelableCommand } from '#cli/system/terminal.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import type { CommandDefinition, CommandLocation, InitFlags, InitJson } from '#cli/types/commands.ts';
import type { ApplyReport, InitOptions, InitPlanning } from '#cli/types/generation.ts';
import type { CanceledCommandJson, CommandResult } from '#cli/types/system.ts';

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
