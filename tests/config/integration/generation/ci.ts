export const GITLAB_PIPELINE = `stages: [test]
application:
  script: echo authored-job
`;

export const GITHUB_PIPELINE = `on: push
jobs:
  application:
    runs-on: ubuntu-24.04
    steps:
      - run: echo authored-job
`;

export const CI_SETTINGS = `configurations = []
[rules]
enabled = false
[ci]
enabled = true
provider = "%PROVIDER%"
[[command_check]]
id = "project/syntax"
stage = "commit"
paths = ["*.sh"]
command = %SYNTAX_COMMAND%
output = { format = "lines" }
[[command_check]]
id = "project/audit"
stage = "manual"
paths = ["*.sh"]
command = %AUDIT_COMMAND%
[[ignore]]
check = "data-files/v8r"
reason = "The jobs test the generated workflow; without an npm check, each install runs mise only."
`;
