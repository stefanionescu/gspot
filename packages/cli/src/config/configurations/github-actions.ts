import { BASH_FORM_MESSAGES } from '#cli/config/configurations/bash.ts';

export const ACTION_FILES = ['action.yml', 'action.yaml'];
export const ENCODED_DOLLAR_SUFFIX = /24$/u;
export const FLOATING_RUNNER = /-latest$/u;
export const GITHUB_FOLDER = '.github/';
export const PULL_REQUEST_TRIGGERS: ReadonlySet<string> = new Set(['pull_request', 'pull_request_target']);
export const SECRET_EXPRESSION = /\$\{\{[^}]*\bsecrets\./u;
export const SELF_REFERENCE_PREFIX = '$/';
export const SELF_REPOSITORY_MARKER = /^(\s*["']?)(\$|\\x24|\\u0024|\\U00000024)/u;
export const UPLOAD_ARTIFACT_ACTION = 'actions/upload-artifact@';
export const WORKFLOW_EXPRESSION = '${{';
export const WORKFLOW_SHAPE_MESSAGES = {
    timeout: 'This job has no `timeout-minutes`.',
    latestRunner: 'Pin a runner image, such as `ubuntu-24.04`.',
    continueOnError: 'Put a reason comment above this `continue-on-error`.',
    runExpression: 'Pass this expression through the `env` of the step, and read it as a quoted shell variable.',
    pullRequestConcurrency: 'This workflow runs for pull requests. Add a `concurrency` group keyed by the ref.',
    retention: 'Set `retention-days` on this `upload-artifact` step.',
    downloadRun: BASH_FORM_MESSAGES['curl-pipe-shell'],
    workflowSecret: 'Move this secret into the `env` of the step that needs it.',
} as const;
export const WORKFLOW_SHAPE_RULES = {
    timeout: 'job-timeout',
    latestRunner: 'latest-runner',
    continueOnError: 'continue-on-error',
    runExpression: 'run-expression',
    pullRequestConcurrency: 'pull-request-concurrency',
    retention: 'artifact-retention',
    downloadRun: 'curl-pipe-shell',
    workflowSecret: 'workflow-secret-env',
} as const;
