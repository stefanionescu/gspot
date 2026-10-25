import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseBashScript } from '#cli/parsers/code/bash.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { type ScriptFile } from '#cli/types/checks/language/bash.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files/classify.ts';

const PARSED_SCRIPTS = { create: () => new Map<string, Promise<ScriptFile[]>>() };

async function readScript(session: Session, file: TrackedFile): Promise<ScriptFile> {
    const text = readCachedText(session.reads, file.path);
    const syntax = await parseBashScript(text, session);
    return {
        ...syntax,
        path: file.path,
        lines: text.split('\n'),
        isExecutable: file.executable,
    };
}

/**
Parses the scope scripts once and shares them across checks.

@param session the repository and its tools.
@param planned the scope files and parser resources.
@returns the parsed scripts.
*/
export function readScripts(session: Session, planned: PlannedCheck): Promise<ScriptFile[]> {
    const files = planned.files.filter((file) => file.kind === 'source' && file.tags.includes(SCRIPT_TAG));
    const key = JSON.stringify([planned.scope.path, files.map((file) => file.path)]);
    return getCachedMapValue(session.reads, PARSED_SCRIPTS, key, async () => {
        const scripts: ScriptFile[] = [];
        for (const file of files) scripts.push(await readScript(session, file));
        return scripts;
    });
}
