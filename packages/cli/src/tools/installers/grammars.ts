import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { ToolInstall } from '#cli/types/tools.ts';
import type { GrammarName } from '#cli/types/parsers.ts';
import { downloadArchive } from '#cli/tools/installers/vale.ts';
import { GRAMMAR_TOOL_NOUN } from '#cli/config/tools/installers.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
Download each grammar that the repository needs and the shared folder lacks, and check it against its SHA-256 value.

@param install what install needs for this step.
@returns the line about the grammars that it downloaded, or an empty string.
*/
export async function installGrammars(install: ToolInstall): Promise<string> {
    const missing = listRepositoryGrammars(install).filter((grammar) => {
        const path = buildGrammarPath(grammar);
        return (
            !existsSync(path) ||
            createHash('sha256').update(readFileSync(path)).digest('hex') !== GRAMMAR_RELEASES[grammar].sha256
        );
    });
    for (const grammar of missing) {
        const { url, sha256 } = GRAMMAR_RELEASES[grammar];
        const bytes = await downloadArchive(install, { url, name: grammar, limit: GRAMMAR_ARCHIVE_LIMIT });
        if (createHash('sha256').update(bytes).digest('hex') !== sha256)
            throw new GspotError('install', `The ${grammar} grammar failed SHA-256 verification.`);
        const path = buildGrammarPath(grammar);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, bytes);
    }
    return missing.length === 0 ? '' : `installed ${formatCount(missing.length, GRAMMAR_TOOL_NOUN)}`;
}
