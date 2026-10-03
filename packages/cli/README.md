# gspot

gspot is a command-line tool that lints AI-generated code and installs rules for AI coding
agents. Git hooks run the checks on every commit and push, and a finding stops the commit. Your
choices live in one policy file, `gspot.toml`.

## Install

gspot runs on Node.js 22 or newer, or on Bun. In a JavaScript or TypeScript repository:

```shell
npm install --save-dev --save-exact @gspothq/cli
npx gspot init
```

In any other repository, install it once with `npm install --global @gspothq/cli`, then run
`gspot init`.

`init` reads the repository and shows a plan before it writes anything: the checks for your
languages, the linter configuration under `.gspot/`, the rules for coding agents, and the Git
hooks.

## Documentation

The [manual](https://gspot.dev) covers the policy file, the hooks, CI, and every check. The
source is on [GitHub](https://github.com/stefanionescu/gspot).

## License

Apache-2.0
