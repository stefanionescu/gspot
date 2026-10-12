# Task Runner

Rules for `mise` tasks, `package.json` scripts, `Makefile` targets, or the project's runner.

## Task behavior

- Reuse the task names the project has. Add a task only when asked.
- Do not add empty section markers or scripts that only echo a placeholder.
- When a step fails, the task stops and exits with an error.

## Task organization

<!-- level: all -->

- Use one declared task runner per project.
- Name tasks in kebab-case with a colon namespace, such as `check:fix` or `deploy:staging`.
- Use the runner's declarative commands and dependency ordering. Keep substantial parsing,
  branching, and process control in the code that implements that behavior.
- Give each task a concise description in the runner's task list.
