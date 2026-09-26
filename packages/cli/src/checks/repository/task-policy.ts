import type { Finding } from '#cli/checks/result.ts';
import { MISE_CONFIG_PATH } from '#cli/tools/mise.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { runnerTaskPlan } from '#cli/lifecycle/runner-tasks.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';

/**
 * Report missing or changed task bodies through the same field owner used by generation.
 * @param input the engine input
 * @returns the findings
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
