type AgentSkill = { name: string; type: 'skill-md'; description: string; url: string; digest: string };

export type AgentSkillsIndex = { $schema: string; skills: AgentSkill[] };
