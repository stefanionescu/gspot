# The Top Level of This Repository

Ownership follows [implementation boundaries](../16-file-tree.md), not a prescribed tree.

## K-73: `prose/` and `schema/` at the top level

**Implemented locally.** Presets own their grouped assets and prose styles. The root
`gspot.schema.json` is the sole generated configuration schema source. The website build
copies it into `dist/schema/`. Runtime report validation remains with the report owner.
Schema tests exercise accepted and rejected documents; the website build verifies the copy.

The old root inventory, required empty example directories, and folding generated build
entries into authored scripts are retired. They do not protect product behavior.
Useful examples and contribution documentation remain under
[the documentation owner](../21-documentation.md); artifact licensing remains under
[K-164](22-launch.md#k-164-a-release-can-ship-broken-and-say-nothing).
K-68 follows this same disposition. No second schema export or directory-shape test is required.
