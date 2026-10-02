# gspot Documentation

The documentation site uses Astro Starlight.

## Setup

After the setup in [CONTRIBUTING.md](../CONTRIBUTING.md#setup), preview the site from the
repository root with `mise run docs:dev`, and build it with `mise run docs:build`.

## Asset licenses

Keep these notices with every distributed copy of the assets.

- The homepage layout adapts the
  [Turborepo homepage source](https://github.com/vercel/turborepo/tree/1dead3cc9d421e61327a13cb44a590e8e218793f/apps/docs/app/%5Blang%5D/%28home%29)
  to Astro components. Its [MIT notice](public/licenses/turborepo.txt) ships with the site.
- The site self-hosts Geist Sans and Geist Mono from the pinned Fontsource packages. The site
  build keeps each package license under `licenses/` in the output.
- Most tool and framework logos come from [Simple Icons](https://github.com/simple-icons/simple-icons)
  under [CC0](public/licenses/simple-icons.txt). The names identify integrations and claim no
  sponsorship.
- ShellCheck artwork comes from the
  [VS Code integration](https://github.com/vscode-shellcheck/vscode-shellcheck/blob/master/shellcheck.png)
  under its [MIT license](public/licenses/shellcheck.txt).
- The Semgrep symbol comes from the
  [upstream logo](https://github.com/semgrep/semgrep/blob/develop/semgrep.svg) under the GNU
  Lesser General Public License, whose [version 2.1 text](public/licenses/semgrep.txt)
  accompanies the asset.
