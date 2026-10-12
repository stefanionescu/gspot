# GitHub Actions

## Workflow shape

- Every job has `timeout-minutes`. Every workflow that can run twice for one ref has a
  `concurrency` group with `cancel-in-progress` for pull requests.
- Pin a runner image such as `ubuntu-24.04` for each job. Do not use `ubuntu-latest`.
- No `continue-on-error` without a reason comment. Required failures must fail the job.
- Upload diagnostics after failed checks with an explicit status condition. Deployments and
  release publication require successful prerequisites.

## Repository actions and secrets

- Reference first-party actions from the repository by path.
- Read secrets through `${{ secrets.NAME }}` into an `env` for the one step that needs them.
  Never write them to files that outlive the step.

## Scripts

- Declare the shell required by the script. The explicit Bash shell in GitHub Actions enables `-e` and
  `pipefail`, but does not enable `-u`. Enable required options and validate inputs explicitly.
- Key caches on the lockfile hash and the runtime version. Restore keys never match a
  different lockfile.

## Outputs

- Artifacts and summaries name the job and the ref. Set retention explicitly.
- Give deploy credentials only to the workflow that deploys. Run it on a protected
  environment with a reviewer.

See [the GitHub shell configuration](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsshell)
for the command each runner uses.

## Workflow organization

<!-- level: all -->

- Give each workflow one purpose, such as checks, release publication, or deployment.
- Call existing task-runner commands instead of copying their implementation into a workflow.
- Keep substantial logic in scripts that run locally through the task runner and in CI without
  a prompt. Run the checks their language requires.
- A verification job changes source only when its task requires formatting or code generation.
- Write logs and reports to predictable artifact paths.
