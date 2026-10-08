/** One sandbox check whose fixer exits 3 until a test replaces its script. */
export const FIXER_POLICY = `configurations = []
[check."sandbox/fixer"]
command = [EXECUTABLE, "-e", "process.exitCode = 0"]
fix = [EXECUTABLE, "-e", "process.exitCode = 3"]
paths = PATHS
stage = "commit"
`;
