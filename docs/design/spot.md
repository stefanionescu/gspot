# Spot artwork

Generated September 21, 2026 with the built-in `image_gen.imagegen` tool. The tool did not
expose an underlying model name. These assets are not represented as GPT Image 2.5 output.
No API client, credentials, or generation dependency is part of the product build.

## Selection

[The concept board](concepts.html) compares the lens, notebook, and compact-sticker candidates.
The lens candidate was selected because the face stays readable and the small dot supplies a
clear investigation subject. The notebook adds detail unrelated to a control or procedure.
The third candidate gives the lens too much of the small silhouette. Rejected concepts stay
in this design directory and are not served as static site assets.

The selected lens concept became the reference sheet. Each production pose used that sheet
as an explicit image reference. Review found consistent body proportions, tuft, face, outline,
palette, lens, and restrained texture. The drawings contain no text, competitor imagery,
suggestive imagery, or fabricated product output. Only newly generated artwork was supplied
as reference. Project distribution uses the repository license; no third-party art was imported.

## Prompt set

The exact base requirements for concept exploration were: original Spot mascot for the gspot
developer CLI; small rounded lime creature, two charcoal eyes, tiny feet, oversized lilac
magnifying lens, curious friendly expression, and a peach detail. Flat rounded sticker art,
consistent charcoal outline, restrained print texture, readable at 160 pixels. Palette:
`#B7F36B`, `#C4AEFF`, `#FFB694`, `#111410`. Isolated full character with generous clear space,
no cropped limbs, genuinely transparent alpha background, and clean edges for light and dark
surfaces. Avoid words, letters, logos, commands, interface output, sexual imagery, suggestive
poses, competitor mascots, watermarks, glossy 3D, and scenery.

Separate generation calls requested these compositions:

1. `concept-lens.png`: Spot standing and investigating a tiny accent dot with the magnifier.
2. `concept-notebook.png`: Spot sitting beside a terminal-shaped notebook, investigating blank
   pages with the magnifier. No marks, commands, letters, or interface on the notebook.
3. `concept-sticker.png`: compact Spot hugging the large lens beside a solid peach accent dot.
4. `reference.png`: use the selected lens concept as reference; preserve its rounded lime body,
   curved single top tuft, two oval charcoal eyes, peach cheek, tiny feet, outlines, texture,
   and lens proportions. Show front, three-quarter inspecting the dot, and side views.
   Space the views apart on transparent alpha with no labels or text.
5. `hero.png`: use the reference sheet; one character in its center three-quarter pose,
   investigating the peach dot. Preserve exact identity and proportions. Full character and
   dot only, centered with modest margins. No new props or text. Readable at 160 and 320 pixels.
6. `compact.png`: use the reference sheet; front pose holding the lens to the side, with the
   entire face readable. Compact full-body silhouette for 160-pixel-high display. Preserve
   all identifying proportions, palette, texture, and outline. No new props or facial features.
7. `investigating.png`: use the reference sheet; lean slightly forward and look through the
   magnifier at empty ground, curious and helpful rather than sad or alarmed. Preserve the
   full-body identity. No text, numbers, 404, interface, scenery, or additional characters.

Each call requested genuine transparent alpha. Production masters have four channels with
alpha ranging from 0 to 255. The masters are retained under `spot/`; their original tool files
remain under the Codex generated-images directory. No destructive editing was performed.

## Delivery

Delivery exports trim transparent margins, resize, and encode with Sharp 0.35.4 already present
in the workspace dependency store. This was a one-time export, not a new build pipeline.

| Asset under `docs/public/brand/` | Dimensions | Consumer                                         |
| -------------------------------- | ---------- | ------------------------------------------------ |
| `spot-hero.webp`                 | 584 × 640  | Landing page, displayed at up to 280 pixels wide |
| `spot-compact.webp`              | 297 × 320  | Compact high-resolution variant                  |
| `spot-compact.png`               | 149 × 160  | README                                           |
| `spot-investigating.webp`        | 630 × 640  | Not-found page                                   |
| `social.png`                     | 1200 × 630 | Landing and manual social metadata               |

The hero WebP is about 44 KB; the compact PNG is about 13 KB. Both retain alpha. The social
image is deterministic SVG text and layout rendered to PNG around the selected hero cutout.
Its exact text is `gspot`, `One place for your`, `repository checks.`, and
`gspot.dev · prerelease`. The wordmark is native selectable page text with a solid accent dot.
The favicon is an authored SVG dot on charcoal, not a shrunk illustration.

Functional text and the finding transcript remain native HTML. Decorative page illustrations
have empty alt text and explicit intrinsic dimensions. README artwork has descriptive alt text.
