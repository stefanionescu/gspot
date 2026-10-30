import { remember } from '#cli/system/cache.ts';
import { read } from '#cli/system/files/reads.ts';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseBashScript } from '#cli/parsers/code/bash.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { type ScriptFile } from '#cli/types/checks/language/bash.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files/classify.ts';
import { BASH_SOURCE_COMMANDS } from '#cli/config/checks/language/bash/scripts.ts';

const PARSED_SCRIPTS = Symbol('parsed scripts');

async function readScript(session: Session, file: TrackedFile): Promise<ScriptFile> {
    const text = read(session.cache, file.path);
    const syntax = await parseBashScript(text, session);
    return {
        ...syntax,
        path: file.path,
        lines: text.split('\n'),
        executable: file.executable,
    };
}

/**
Parses the scope scripts once and shares them across checks.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function readScripts(session: Session, planned: PlannedCheck): Promise<ScriptFile[]> {
    const files = planned.files.filter((file) => file.kind === 'source' && file.tags.includes(SCRIPT_TAG));
    const key = JSON.stringify([planned.scope.path, files.map((file) => file.path)]);
    return remember(session.cache, PARSED_SCRIPTS, key, async () => {
        const scripts: ScriptFile[] = [];
        for (const file of files) scripts.push(await readScript(session, file));
        return scripts;
    });
}

/**
Find calls that can reach a function in one script.

@param scripts the parsed scripts of the scope.
@param target the script that defines the function.
@param name the identifier to match in command calls.
@returns calls in its own script or scripts that source a library.
*/
export function listFunctionCalls(scripts: ScriptFile[], target: ScriptFile, name: string): ScriptFile['calls'] {
    const callers = scripts.filter(
        (file) => file === target || file.commands.some((call) => BASH_SOURCE_COMMANDS.has(call.name)),
    );
    return callers.flatMap((file) => file.calls.filter((call) => call.name === name));
}
