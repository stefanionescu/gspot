import { SCHEMA_CHECK } from '#tests/config/cli/docs/schema.ts';
import type { RuntimeSchemaCase } from '#tests/types/cli/docs/schema.ts';

/** Current public field names and refused obsolete names share the runtime and editor contract. */
export const POLICY_FIELD_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'the runner setting with its current name',
        input: { runner: 'mise' },
        valid: true,
    },
    {
        name: 'the obsolete runner setting',
        input: { run_with: 'mise' },
        valid: false,
        diagnostic: '`run_with` is not a setting gspot knows under the top level',
    },
    {
        name: 'current hook and CI file selection names',
        input: { hooks: { push_files: 'all' }, ci: { provider: 'github', files: 'all' } },
        valid: true,
    },
    {
        name: 'the obsolete hook push selection name',
        input: { hooks: { push: 'all' } },
        valid: false,
        diagnostic: '`push` is not a setting gspot knows under [hooks]',
    },
    {
        name: 'the obsolete CI run selection name',
        input: { ci: { provider: 'github', run: 'all' } },
        valid: false,
        diagnostic: '`run` is not a setting gspot knows under [ci]',
    },
    {
        name: 'the tool timeout setting in seconds',
        input: { tool_timeout_seconds: 300 },
        valid: true,
    },
    {
        name: 'the obsolete timeout setting',
        input: { timeout: 300 },
        valid: false,
        diagnostic: '`timeout` is not a setting gspot knows under the top level',
    },
    {
        name: 'the current finding count pattern name',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, finding_count_pattern: 'FAILED' } } },
        valid: true,
    },
    {
        name: 'the obsolete finding count pattern name',
        input: { check: { 'project/lint': { ...SCHEMA_CHECK, count_pattern: 'FAILED' } } },
        valid: false,
        diagnostic: '`count_pattern` is not a setting gspot knows under [check.project/lint]',
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
    {
        name: 'the obsolete agent rule table',
        input: { rules: { install: false } },
        valid: false,
        diagnostic: '`rules` is not a setting gspot knows under the top level',
    },
];
