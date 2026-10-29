# Writing

Read this rule when you write text that people read in files: documentation, comments, messages, and commit messages.

TALKING.md covers what you say to the user.

Write in plain language under `ISO 24495-1`: short sentences and common words. State the action or result early. Explain
a technical term when the reader needs it.

## Evidence

Check commands, fields, defaults, limits, and supported versions against the implementation that defines them. A
measurement does not guarantee future results. When evidence lacks required facts, narrow the claim. Link external facts
to the primary source; never invent behavior to complete a page.

Preserve exact API identifiers, public messages, official product names, and legal license text. Keep private reasoning
and temporary notes out of shipped content. Examples use fictional people, safe values, and `example.com` addresses.

## Dates, links, and images

- Write a date with the month as a word, such as `March 4, 2026`, or as `2026-03-04`. Never write `03/04/2026`.
- Make link text name where the link goes. Never write `here`, `this page`, `read more`, or `docs`.
- Give each image alternative text that says what it shows, or an empty `alt` when the image only decorates.

## Voice

<!-- level: all -->

Use active voice when the actor matters. Address the reader as you in procedures. Use imperatives for requirements and
label optional steps. Put a condition before its action and keep one main idea per sentence. Name the subject instead of
relying on an ambiguous pronoun.

Avoid idioms, unexplained abbreviations, and decorative wording. Use literal terms that survive translation. Keep one
term for each concept. Dates shown to people include their time zone; machine values retain their required format.

## Words that the prose check reports

<!-- level: all -->

- State the rule or the fact. Write no `should`, `could`, `would`, or `might`, and no hedge such as `usually`, `very`,
  or `where possible`.
- Write no marketing word such as `simply`, `easily`, `robust`, or `powerful`.
- Describe what exists now. Write no promise such as `coming soon` or `in the future`, and no history such as
  `previously`, `no longer`, or `renamed from`.
- Write `do not`, `it is`, `for example`, and `you`, not `don't`, `it's`, `e.g.`, and `we`.
- Name the thing, not its place on the page: no `see above`, `the following section`, or `this guide explains`.
- Write `because` or `after` instead of `since`.
- Use a comma, a colon, or a period instead of an em dash or a double hyphen. Write `to` instead of a dash in a range.
- Use words instead of an emoji or an arrow.
- Put a file path in code formatting, and write a placeholder as `<kebab-case>`.
- Write the page title in title case and every lower heading in sentence case, with no end punctuation.
- Keep a sentence within `prose.max_sentence_words` words, 30 by default, a list item within
  `prose.max_list_item_words` words, 45 by default, and a paragraph within `prose.max_paragraph_sentences` sentences, 6
  by default.

## References

See the [Google developer documentation style guide](https://developers.google.com/style) for general writing guidance.
Project-specific requirements take precedence.
