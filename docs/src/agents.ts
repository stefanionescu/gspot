import { createHash } from 'node:crypto';
import { DESCRIPTION } from './config/site.ts';
import { AGENT_STEPS } from './config/setup.ts';
import type { AgentSkillsIndex } from './types/agents.ts';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { DIGEST_ALGORITHM } from '#cli/config/files/hashes.ts';

import {
    LLMS_FILE,
    SKILL_FILE,
    SETUP_SKILL,
    SKILLS_FOLDER,
    SKILLS_SCHEMA,
    NOT_FOUND_PAGE,
    SKILLS_INDEX_FILE,
    MARKDOWN_COPY_FILE,
} from './config/agents.ts';

/**
Build the address of the Markdown copy of a docs page. Starlight serves the entry `a/index` at `/a/`, and gives the
home page, which wraps itself in StarlightPage, an empty ID.

@param id - the collection ID
@returns the address, or undefined for the not-found page
*/
export function buildMarkdownCopyPath(id: string): string | undefined {
    if (id === NOT_FOUND_PAGE) return undefined;
    const path = id.endsWith('/index') ? id.slice(0, -'/index'.length) : id;
    return path === '' ? `/${MARKDOWN_COPY_FILE}` : `/${path}/${MARKDOWN_COPY_FILE}`;
}

/**
Write the files for agents into the built site: the Markdown copy of the home page, and the Agent Skills index with
the gspot skill.

@param siteFolder - the build output folder
*/
export async function writeAgentFiles(siteFolder: URL): Promise<void> {
    await copyFile(new URL(LLMS_FILE, siteFolder), new URL(MARKDOWN_COPY_FILE, siteFolder));
    const folder = new URL(`${SKILLS_FOLDER}${SETUP_SKILL.name}/`, siteFolder);
    await mkdir(folder, { recursive: true });
    const frontmatter = `---\nname: ${SETUP_SKILL.name}\ndescription: ${SETUP_SKILL.description}\n---`;
    const skill = `${frontmatter}\n\n# gspot\n\n${DESCRIPTION}\n\n${AGENT_STEPS}`;
    await writeFile(new URL(SKILL_FILE, folder), skill);
    const index: AgentSkillsIndex = {
        $schema: SKILLS_SCHEMA,
        skills: [
            {
                ...SETUP_SKILL,
                type: 'skill-md',
                url: `/${SKILLS_FOLDER}${SETUP_SKILL.name}/${SKILL_FILE}`,
                digest: `sha256:${createHash(DIGEST_ALGORITHM).update(skill).digest('hex')}`,
            },
        ],
    };
    await writeFile(new URL(`${SKILLS_FOLDER}${SKILLS_INDEX_FILE}`, siteFolder), `${JSON.stringify(index)}\n`);
}
