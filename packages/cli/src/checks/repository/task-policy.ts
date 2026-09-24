import type { Finding } from '#cli/types/reports.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { MISE_CONFIG_PATH, runnerTaskPlan } from '#cli/emit/runner-tasks.ts';

/**
 * Report missing or changed task bodies through the same field owner used by generation.
 * @param input
 */
export function taskPolicy(input: EngineInput): Finding[] {
    const runner = input.policyFiles.policy.runner;
    if (runner === undefined) return [];
    const plan = runnerTaskPlan(input.root, runner.tool, runner.tasks);
    const outputs = [
        ...(plan.configuration === undefined ? [] : [plan.configuration]),
        ...(runner.tool === 'mise'
            ? [
                  {
                      path: MISE_CONFIG_PATH,
                      format: 'toml' as const,
                      changes: plan.tasks.map((task) => ({ path: ['tasks', task.name, 'run'], value: task.run })),
                  },
              ]
            : []),
    ];
    return outputs.flatMap((output) =>
        output.changes.flatMap((change) =>
            hasConfiguration(input.root, { ...output, changes: [change] })
                ? []
                : [
                      {
                          check: input.spec.name,
                          file: output.path,
                          line: 1,
                          rule: 'missing-task',
                          message: `The ${runner.tool} task ${String(change.path[1])} is missing or differs from its accepted body; run gspot apply.`,
                          fixable: false,
                      },
                  ],
        ),
    );
}
