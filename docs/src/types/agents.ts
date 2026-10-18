/** One skill in the Agent Skills discovery index. */
type AgentSkill = { name: string; type: 'skill-md'; description: string; url: string; digest: string };

/** The Agent Skills discovery index of the site. */
export type AgentSkillsIndex = { $schema: string; skills: AgentSkill[] };
