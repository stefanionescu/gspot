// Moving `CLAUDE.md` into `AGENTS.md`: its own text goes to the end of `AGENTS.md`, and the file goes.
import { identify } from '#cli/lifecycle/ownership/log.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import { blockSpan } from '#cli/platform/managed-blocks.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { Planned } from '#cli/types/lifecycle/output.ts';
import { MOVED_HEADING } from '#cli/config/lifecycle/ownership.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';

// The text of a file without the gspot block, trimmed; a link holds none of its own.
function authoredText(file: FileCopy): string {
    if (file.isLink === true) return '';
    const text = file.bytes.toString('utf8');
    const span = blockSpan(text, { path: 'CLAUDE.md', style: 'markdown' });
    return (span === undefined ? text : text.slice(0, span.start) + text.slice(span.end)).trim();
}

/**
 * Plans the move of `CLAUDE.md`: its own text goes to the end of `AGENTS.md` under one heading, unless `AGENTS.md`
 * already holds it, and `CLAUDE.md` goes. Git keeps the bytes of both.
 * @param log the open log
 * @returns the plans, none when there is no `CLAUDE.md`
 */
export function proposeClaudeMove(log: Log): Planned[] {
    const claude = log.files.readKeepingLinks('CLAUDE.md');
    if (claude === undefined) return [];
    const removal: Planned = {
        path: 'CLAUDE.md',
        before: claude,
        previous: log.entryFor('CLAUDE.md'),
        status: 'changed',
    };
    const moved = authoredText(claude);
    const agents = log.files.readKeepingLinks('AGENTS.md');
    const text = agents === undefined || agents.isLink === true ? '' : agents.bytes.toString('utf8');
    if (moved === '' || text.includes(moved)) return [removal];
    const head = text.trimEnd() === '' ? '' : `${text.trimEnd()}\n\n`;
    const next = { bytes: Buffer.from(`${head}${MOVED_HEADING}\n\n${moved}\n`), mode: OWNER_WRITABLE_FILE };
    // A recorded block keeps its record, which now names the file with the moved text.
    const previous = log.entryFor('AGENTS.md');
    const entry = previous === undefined ? {} : { entry: { ...previous, installed: identify(next) } };
    return [{ path: 'AGENTS.md', before: agents, previous, after: next, ...entry, status: 'changed' }, removal];
}
