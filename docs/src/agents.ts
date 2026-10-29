import { createHash } from 'node:crypto';
import { DESCRIPTION } from '#docs/config/site.ts';
import { AGENT_STEPS } from '#docs/config/setup.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import type { AgentSkillsIndex } from '#docs/types/agents.ts';
import { SKILL_FILE, SETUP_SKILL, SKILLS_FOLDER, SKILLS_SCHEMA, SKILLS_INDEX_FILE } from '#docs/config/agents.ts';

/**
Write the Agent Skills index and the gspot skill into the built site.

@param siteFolder - the build output folder
*/
export async function writeAgentFiles(siteFolder: URL): Promise<void> {
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
                digest: `sha256:${createHash('sha256').update(skill).digest('hex')}`,
            },
        ],
    };
    await writeFile(new URL(`${SKILLS_FOLDER}${SKILLS_INDEX_FILE}`, siteFolder), `${JSON.stringify(index)}\n`);
}
