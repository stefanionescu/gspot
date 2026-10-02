// Moving `CLAUDE.md` into `AGENTS.md`: its own text goes to the end of `AGENTS.md`, and the file goes.
import { blockSpan } from '#cli/generation/markers.ts';
import { identity } from '#cli/lifecycle/ownership/log.ts';
import type { Read } from '#cli/types/platform/platform.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { Planned } from '#cli/types/lifecycle/lifecycle.ts';
import { MOVED_HEADING } from '#cli/config/lifecycle/ownership.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/lifecycle/lifecycle.ts';

// The text of a file without the gspot block, trimmed; a link holds none of its own.
function authoredText(file: Read): string {
    if (file.isLink === true) return '';
    const text = file.bytes.toString('utf8');
    const span = blockSpan(text, 'markdown');
    return (span === undefined ? text : text.slice(0, span.start) + text.slice(span.end)).trim();
}

/**
 * Plans the move of `CLAUDE.md`: its own text goes to the end of `AGENTS.md` under one heading, unless `AGENTS.md`
 * already holds it, and `CLAUDE.md` goes. Git keeps the bytes of both.
 * @param log the open log
 * @returns the plans, none when there is no `CLAUDE.md`
 */
export function proposeClaudeMove(log: Log): Planned[] {
    const claude = log.files.readEntry('CLAUDE.md');
    if (claude === undefined) return [];
    const removal: Planned = {
        path: 'CLAUDE.md',
        current: claude,
        previous: log.entryFor('CLAUDE.md'),
        status: 'changed',
    };
    const moved = authoredText(claude);
    const agents = log.files.readEntry('AGENTS.md');
    const text = agents === undefined || agents.isLink === true ? '' : agents.bytes.toString('utf8');
    if (moved === '' || text.includes(moved)) return [removal];
    const head = text.trimEnd() === '' ? '' : `${text.trimEnd()}\n\n`;
    const next = { bytes: Buffer.from(`${head}${MOVED_HEADING}\n\n${moved}\n`), mode: OWNER_WRITABLE_FILE };
    // A recorded block keeps its record, which now names the file with the moved text.
    const previous = log.entryFor('AGENTS.md');
    const entry = previous === undefined ? {} : { entry: { ...previous, installed: identity(next) } };
    return [{ path: 'AGENTS.md', current: agents, previous, next, ...entry, status: 'changed' }, removal];
}
