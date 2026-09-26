import { z } from 'zod';

const taskName = z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/u)
    .describe('The accepted runner task name.');

export const PACKAGE_LIFECYCLE = new Set([
    'preinstall',
    'install',
    'postinstall',
    'prepublish',
    'preprepare',
    'prepare',
    'postprepare',
    'prepublishOnly',
    'prepack',
    'postpack',
    'publish',
    'postpublish',
    'preversion',
    'version',
    'postversion',
]);

export const runnerTasksSchema = z
    .strictObject({
        check: taskName.optional(),
        fix: taskName.optional(),
        apply: taskName.optional(),
        doctor: taskName.optional(),
    })
    .superRefine((tasks, context) => {
        const names = (['check', 'fix', 'apply', 'doctor'] as const).map((key) => tasks[key] ?? `gspot:${key}`);
        if (new Set(names).size !== names.length)
            context.addIssue({ code: 'custom', message: 'Each gspot task requires a distinct runner name.' });
    });

export type RunnerTaskNames = z.infer<typeof runnerTasksSchema>;

export const runnerSchema = z
    .strictObject({
        tool: z.enum(['mise', 'npm', 'bun', 'pnpm', 'yarn']).describe('The runner that receives generated tasks.'),
        tasks: runnerTasksSchema
            .optional()
            .describe('Accepted names for generated check, fix, apply, and doctor tasks.'),
    })
    .superRefine((runner, context) => {
        if (runner.tool !== 'mise')
            for (const [task, name] of Object.entries(runner.tasks ?? {}))
                if (name !== undefined && PACKAGE_LIFECYCLE.has(name))
                    context.addIssue({
                        code: 'custom',
                        path: ['tasks', task],
                        message: 'Package lifecycle scripts cannot be replaced.',
                    });
    });

export const RUNNER_TASKS: (RunnerTask & { key: keyof RunnerTaskNames })[] = [
    { key: 'check', name: 'gspot:check', description: 'Run selected checks', run: 'gspot check' },
    { key: 'fix', name: 'gspot:fix', description: 'Apply corrections and check again', run: 'gspot check --fix' },
    { key: 'apply', name: 'gspot:apply', description: 'Generate configuration from gspot.toml', run: 'gspot apply' },
    {
        key: 'doctor',
        name: 'gspot:doctor',
        description: 'Report tools, coverage, and configuration changes',
        run: 'gspot doctor',
    },
];

export type RunnerTask = { name: string; description: string; run: string };
