---
layer: language
preset: javascript
title: JavaScript Naming
---

# JavaScript Naming

JavaScript naming follows the same role, responsibility, and boundary principles
as TypeScript. Use the JavaScript rules when editing `.js`, `.mjs`, `.cjs`, and
plain JavaScript tooling files.

Project decisions:

- Prefer TypeScript for app code. Use JavaScript naming rules for tooling,
  config, migration support, quality scripts, and ecosystem-owned JavaScript. `unenforced`
- Use `kebab-case` source filenames, even though some external guides also allow
  underscores. `enforced-by: naming/identifiers`
- Prefer named exports in hand-written modules. `unenforced`
- Use default exports only for ecosystem files that require them or external
  packages that expose them. `unenforced`
- Do not create static container classes or nested namespaces for organization. `unenforced`

## JavaScript Case Rules

Rules:

- Classes, constructor values, and React components use `PascalCase`. `enforced-by: naming/identifiers`
- JSDoc record, interface, enum item, and typedef names use `PascalCase`. `enforced-by: naming/identifiers`
- Functions, methods, variables, parameters, properties, and module aliases use
  `camelCase`. `enforced-by: naming/identifiers`
- A module-level `const` bound to a literal or a frozen object is `UPPER_SNAKE_CASE`. Every
  other binding is `camelCase`. `enforced-by: naming/identifiers`
- JSDoc enum members use `UPPER_SNAKE_CASE`. `unenforced`
- Source filenames use `kebab-case` unless an ecosystem tool owns the filename. `enforced-by: naming/identifiers`
- Do not use default exports unless an ecosystem file requires them. `unenforced`
- Do not use namespaces or static classes as containers. `unenforced`
- Use ASCII identifier names. Keep non-ASCII characters in strings or comments
  unless an external API requires otherwise. `unenforced`
- Do not abbreviate by deleting letters from a word. `unenforced`
- Do not use a trailing underscore to signal privacy; use module scope or the
  language/framework visibility mechanism available in that file. `enforced-by: naming/identifiers`
- Short one-letter local names are acceptable only in tiny scopes where the role
  is conventional and obvious, such as `i` in a small loop. `enforced-by: naming/identifiers`
- `handle` starts a name only for a DOM or framework event callback (`handleClick`). Never
  `Handler` as a type suffix. `enforced-by: naming/identifiers`
- Directories are kebab-case. Test files are `<name>.test.js`, never `.spec`. `enforced-by: naming/identifiers`

Bad:

```js
class user_service {}
const MAXCOUNT = 10;
function Build_User() {}
const nErr = 3;
const cstmrId = user.id;
export default {
    parseThing() {},
};
```

Good:

```js
class UserRepository {}
const MAX_RETRY_COUNT = 10;

function buildUser() {}
const errorCount = 3;
const customerId = user.id;

export { UserRepository, buildUser };
```

## JavaScript Imports and Exports

Rules:

- Namespace import aliases use `camelCase` derived from the imported filename or
  clear package name. `enforced-by: naming/identifiers`
- Named imports keep their exported name unless a collision forces an alias. `unenforced`
- If aliasing a named import is required, use a domain or path component that
  explains the collision. `unenforced`
- Default import names follow the identifier type being imported, but default
  imports are limited to ecosystem modules that require them. `unenforced`
- Named exports keep naming consistent across import sites. `unenforced`
- Do not export mutable variables as the public contract. Export functions or an
  item with clearly named mutable fields when mutation is intentional. `unenforced`

Bad:

```js
import * as FileOne from '../file-one.js';
import { Cat as OtherThing } from './domesticated-animals.js';

export default class ProfileClient {}
export let activeUser = undefined;
```

Good:

```js
import * as fileOne from '../file-one.js';
import { Cat as DomesticatedCat } from './domesticated-animals.js';

export class ProfileClient {}

let activeUser = undefined;

export function getActiveUser() {
    return activeUser;
}
```

## JavaScript Files

Bad:

```text
Helpers.js
UserService.js
sharedUtils.mjs
data.cjs
```

Good:

```text
session-token-verifier.js
user-repository.js
email-template-formatter.mjs
database-connection.cjs
```

## JavaScript Functions and Values

Bad:

```js
function process(value) {
    return JSON.parse(value);
}

const d = new Date();
const arr = users.map((u) => u.id);
```

Good:

```js
function parseUserPayload(payloadText) {
    return JSON.parse(payloadText);
}

const currentDate = new Date();
const userIds = users.map((user) => user.id);
```

## JavaScript Boundaries

JavaScript often appears in tooling, config, and quality scripts. Name the
script owner and exported functions by the contract they serve.

Bad:

```js
export function run(value) {
    ...
}
```

Good:

```js
export function collectNamingViolations(scope, policy) {
    ...
}
```

