---
title: Check Client Environment Access
description: Find a private environment read in client code and correct the boundary.
---

A JavaScript module marked `"use client"` must not read private environment variables.
Keep private configuration and the work that needs it on the server. Never rename a secret
with a public prefix to silence a finding.

This example runs the standalone gspot rule through ESLint. It needs the
[source checkout](/guides/install/), its pinned Bun runtime on `PATH`, network access for npm
dependencies, and a POSIX shell.
It writes a disposable example directory and installs its local dependencies. It does not
configure hooks or change another repository.

## 1. Prepare the example

From the gspot checkout, build the plugin and save its path:

```shell
mise run build:plugin
plugin_source="$PWD/packages/eslint-plugin"
example_root="$(mktemp -d)"
cd "$example_root"
bun init -y
bun add --dev "$plugin_source" eslint@9.39.5
```

Save this complete configuration as `eslint.config.mjs`:

```javascript
import gspot from '@gspot/eslint-plugin';

export default [{
    files: ['search.js'],
    plugins: { gspot },
    rules: { 'gspot/no-client-environment': 'error' },
}];
```

Only this rule runs in the example. A repository using the JavaScript configuration has other checks.
See the [plugin reference](/reference/plugin/no-client-environment/) for options.

## 2. Check the defect

Save this module as `search.js`:

```javascript
"use client";
export const endpoint = process.env.PRIVATE_API_URL;
```

From the example directory, run:

```shell
bunx --no-install eslint search.js
```

The command exits `1`. With gspot plugin 0.1.0 and ESLint 9.39.5, the rule reports this
message at line 2, column 25:

```text
A client module may read only public environment variables (NEXT_PUBLIC_*, NODE_ENV). Keep private configuration in a server-only module.
```

The rule checks the module boundary. It does not claim that a framework exposed the value
in a browser bundle.

## 3. Correct the boundary

Replace `search.js` with:

```javascript
"use client";
export const endpoint = "/api/search";
```

Run the same check:

```shell
bunx --no-install eslint search.js
```

The command exits `0` with no diagnostic output. The module no longer reads private
configuration. In an application, implement `/api/search` on the server and keep the private
configuration there. This example does not implement or test that route.

## Clean up and continue

The example directory path is stored in `example_root`. After inspection, leave that directory
and remove it when you no longer need its files. Your source checkout remains available.

For checks in an existing application, follow [adopt an existing repository](/guides/existing-repository/).
