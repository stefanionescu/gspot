import { readFileSync } from 'node:fs';

import { TABLE_HEADING_LEVEL } from '#docs/config/reference.ts';
import { buildReferencePage } from '#docs/reference/markdown.ts';
import type { ReferencePage } from '#docs/types/pages.ts';

const CHANGELOG_TITLE = '# Changelog\n';

/**
Build the Changelog page from CHANGELOG.md when the site builds, so each new section shows on the next build. Its table
of contents lists the releases.
*/
export function buildChangelogPage(): ReferencePage {
    const changelog = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
    const start = changelog.indexOf(CHANGELOG_TITLE);
    if (start === -1) throw new Error(`CHANGELOG.md has no title line ${CHANGELOG_TITLE.trim()}.`);
    const body = changelog.slice(start + CHANGELOG_TITLE.length).trim();
    const page = buildReferencePage('Changelog', undefined, body);
    page.data.tableOfContents = { maxHeadingLevel: TABLE_HEADING_LEVEL };
    return page;
}
