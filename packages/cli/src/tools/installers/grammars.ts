import { createHash } from 'node:crypto';
import { dirname, basename } from 'node:path';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { GrammarName } from '#cli/types/parsers.ts';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { downloadArchive } from '#cli/tools/installers/vale.ts';
import { replaceBoundedFile } from '#cli/system/files/bounded.ts';
import { GRAMMAR_TOOL_NOUN } from '#cli/config/tools/installers.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import type { ToolInstall, DownloadSession } from '#cli/types/tools.ts';
import { buildGrammarPath, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';

import {
    TAG_GRAMMARS,
    GRAMMAR_NAMES,
    GRAMMAR_RELEASES,
    GRAMMAR_ARCHIVE_LIMIT,
    CONFIGURATION_GRAMMARS,
} from '#cli/config/parsers.ts';

function listRepositoryGrammars(install: ToolInstall): GrammarName[] {
    const { repository, scopes } = install.session;
    const names = new Set<string | undefined>([
        ...listSelectedConfigurations(scopes).flatMap(({ name }) => CONFIGURATION_GRAMMARS[name] ?? []),
        ...repository.files.flatMap((file) => [
            findGrammarByExtension(file.path),
            ...file.tags.map((tag) => TAG_GRAMMARS[tag]),
        ]),
    ]);
    return GRAMMAR_NAMES.filter((name) => names.has(name));
}

/**
Download a grammar into the shared folder and check it against its SHA-256 value, unless that folder holds it. The
grammar moves into place from a staged file, because checks in other repositories read the shared folder at any time.

@param grammar the grammar to download.
@param session the time limit and the cancel signal of the download.
@returns whether it downloaded the grammar.
*/
export async function downloadGrammar(grammar: GrammarName, session: DownloadSession): Promise<boolean> {
    const { url, sha256 } = GRAMMAR_RELEASES[grammar];
    const path = buildGrammarPath(grammar);
    if (existsSync(path) && createHash('sha256').update(readFileSync(path)).digest('hex') === sha256) return false;
    const bytes = await downloadArchive(session, { url, name: grammar, limit: GRAMMAR_ARCHIVE_LIMIT });
    if (createHash('sha256').update(bytes).digest('hex') !== sha256)
        throw new GspotError(
            'install',
            `The ${grammar} grammar failed SHA-256 verification, so gspot kept no copy. Run gspot install again, and check that no proxy rewrites the download.`,
        );
    mkdirSync(dirname(path), { recursive: true });
    replaceBoundedFile({ root: dirname(path) }, basename(path), { bytes, mode: OWNER_WRITABLE_FILE });
    return true;
}

/**
Download each grammar that the repository needs and the shared folder lacks.

@param install what install needs for this step.
@returns the line about the grammars that it downloaded, or an empty string.
*/
export async function installGrammars(install: ToolInstall): Promise<string> {
    const downloads = await Promise.all(
        listRepositoryGrammars(install).map((grammar) => downloadGrammar(grammar, install.session)),
    );
    const downloaded = downloads.filter(Boolean).length;
    return downloaded === 0 ? '' : `installed ${formatCount(downloaded, GRAMMAR_TOOL_NOUN)}`;
}
