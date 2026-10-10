import { SCHEMA_CHECK } from '#tests/config/cli/policy/schema/cases.ts';
import type { RuntimeSchemaCase } from '#tests/types/cli/policy/schema.ts';

/** Public fields share the runtime and editor contract. */
export const POLICY_FIELD_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'nonempty dependency registry hosts',
        input: { dependencies: { registry_hosts: ['registry.npmjs.org'] } },
        valid: true,
    },
    {
        name: 'an empty dependency registry host',
        input: { dependencies: { registry_hosts: [''] } },
        valid: false,
        diagnostic: 'dependencies.registry_hosts.0: Too small: expected string to have >=1 characters',
    },
    {
        name: 'a scoped empty dependency registry host',
        input: { scope: { app: { dependencies: { registry_hosts: [''] } } } },
        valid: false,
        diagnostic: 'scope.app.dependencies.registry_hosts.0: Too small: expected string to have >=1 characters',
    },
    {
        name: 'the runner setting with its current name',
        input: { runner: 'mise' },
        valid: true,
    },
    {
        name: 'current hook and CI file selection names',
        input: { hooks: { push_files: 'all' }, ci: { provider: 'github', files: 'all' } },
        valid: true,
    },
    {
        name: 'the tool timeout setting in seconds',
        input: { tool_timeout_seconds: 300 },
        valid: true,
    },
    {
        name: 'the current finding count pattern name',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, finding_count_pattern: 'FAILED' } } },
        valid: true,
    },
    {
        name: 'current agent rule installation fields',
        input: {
            agent_rules: {
                enabled: false,
                folder: 'rules',
                own_rules_folder: 'project-rules',
                instruction_files: ['INSTRUCTIONS.md'],
            },
        },
        valid: true,
    },
];
