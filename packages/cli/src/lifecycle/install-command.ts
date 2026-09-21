import { hookLocation } from '#cli/lifecycle/hooks.ts';
import { pythonInstallSteps } from '#cli/lifecycle/python-project.ts';
import { toolEnvironment } from '#cli/emit/tool-environment.ts';
import { MISE_CONFIG_PATH } from '#cli/emit/runner-tasks.ts';
import { openSession } from '#cli/run/session.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { installTools } from '#cli/lifecycle/install-tools.ts';
import { packageInstallSteps } from '#cli/lifecycle/package-project.ts';
import type { CommandResult } from '#types/run.ts';
import type { InstallOptions } from '#types/commands.ts';

/** Preview or install this clone's locked tools without regenerating tracked configuration. */
export async function installCommand(options: InstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    try {
        const steps: string[][] = [];
        const failures: string[] = [];
        const projects = [
            { selected: session.packageManager !== undefined, preview: packageInstallSteps },
            { selected: toolEnvironment(session).length > 0, preview: pythonInstallSteps },
        ];
        for (const project of projects) {
            if (!project.selected) continue;
            try {
                const commands = project.preview(root);
                if (commands.length === 0) throw new Error('Run: gspot apply, then gspot install');
                steps.push(...commands);
            } catch (error) {
                failures.push(error instanceof Error ? error.message : 'Tool installation inputs are invalid.');
            }
        }
        const runner = session.policyFiles.policy.runner?.tool;
        if (runner === 'mise') steps.unshift(['mise', 'trust', MISE_CONFIG_PATH], ['mise', 'install']);
        const hooks = session.repository.hasGit && session.policyFiles.policy.hooks?.tool === 'gspot' ? hookLocation(root).absolute : undefined;
        if (options.isDryRun && failures.length > 0) throw new Error([...new Set(failures)].join('\n'));
        if (options.isDryRun)
            return {
                text:
                    steps.length === 0 && hooks === undefined
                        ? 'No managed tools or hooks to install.\n'
                        : `${[...steps.map((step) => step.join(' ')), ...(hooks === undefined ? [] : [`install hook dispatchers in ${hooks}; retain original executables as siblings`])].join('\n')}\n`,
                json: { isDryRun: true, steps, ...(hooks === undefined ? {} : { hooks }) },
                exitCode: 0,
            };
        let note = '';
        try {
            note = await installTools(session, true);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : 'Tool installation failed.');
        }
        if (failures.length > 0) throw new Error([note, ...new Set(failures)].filter(Boolean).join('\n'));
        return {
            text: `${note === '' ? 'No managed tools to install.' : note}\n`,
            json: { installed: true, steps },
            exitCode: 0,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool installation failed.';
        return { text: `${message}\n`, json: { installed: false, error: message }, exitCode: 1 };
    }
}
