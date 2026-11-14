import { remember } from '#cli/system/cache.ts';
import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { parseBashScript } from '#cli/parsers/code/bash/script.ts';
import type { ScriptFile } from '#cli/types/configurations/language.ts';

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
