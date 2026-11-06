import { BASH_SOURCE_COMMANDS } from '#cli/config/configurations/bash.ts';
import { SCRIPT_TAG } from '#cli/config/parsers.ts';
import { parseBashScript } from '#cli/parsers/code/bash.ts';
import { remember } from '#cli/system/cache.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { ScriptFile } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { Session } from '#cli/types/tools.ts';

const PARSED_SCRIPTS = Symbol('parsed scripts');

async function readScript(session: Session, file: TrackedFile): Promise<ScriptFile> {
    const text = readText(session.cache, file.path);
    const syntax = await parseBashScript(text, session);
    return {
        ...syntax,
        path: file.path,
        lines: text.split('\n'),
        executable: file.executable,
    };
}

export function readScripts(session: Session, planned: PlannedCheck): Promise<ScriptFile[]> {
    const files = planned.files.filter((file) => file.kind === 'source' && file.tags.includes(SCRIPT_TAG));
    const key = JSON.stringify([planned.scope.path, files.map((file) => file.path)]);
    return remember(session.cache, PARSED_SCRIPTS, key, async () => {
        const scripts: ScriptFile[] = [];
        for (const file of files) scripts.push(await readScript(session, file));
        return scripts;
    });
}

export function listFunctionCalls(scripts: ScriptFile[], target: ScriptFile, name: string): ScriptFile['calls'] {
    const callers = scripts.filter(
        (file) => file === target || file.commands.some((call) => BASH_SOURCE_COMMANDS.has(call.name)),
    );
    return callers.flatMap((file) => file.calls.filter((call) => call.name === name));
}
