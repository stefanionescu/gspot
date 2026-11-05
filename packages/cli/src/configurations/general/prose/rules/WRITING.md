# Writing

Read this rule before you write text that people read: messages to the user, documentation, comments, commit messages,
pull requests, issues, and reviews.

Write short sentences in common words, state the action or result early, and explain a technical term when the reader
needs it. Say what happens, and name the thing you mean. Write no slogan, metaphor, or catchy title: write
`Every ignored rule needs a reason`, not `Close the quiet off switch`.

Write so that each sentence follows from the one before. Join related facts in one sentence. Say what a thing is for
before you list what it holds.

Do not explain what the reader already knows. Delete a sentence that only restates a title, a name, or what a page is.

## Evidence

Check commands, fields, defaults, limits, and supported versions against the implementation that defines them. When
evidence lacks required facts, narrow the claim. Link external facts to the primary source; never invent behavior to
complete a page.

Preserve exact API identifiers, public messages, official product names, and legal license text. Keep private reasoning
and temporary notes out of shipped content.

## Voice

<!-- level: all -->

Use imperatives for requirements and label optional steps. Put a condition before its action. Name the subject instead
of relying on an ambiguous pronoun.

Times shown to people include their time zone; machine values retain their required format.

## Words to leave out

<!-- level: all -->

- State the rule or the fact. Write no `should`, `could`, `would`, or `might`, and no hedge such as `usually`, `very`,
  or `where possible`.
- Write no marketing word such as `simply`, `easily`, `robust`, or `powerful`.
- Describe what exists now. Write no promise such as `coming soon` or `in the future`, and no history such as
  `previously`, `no longer`, or `renamed from`.
- Do not mention a feature, option, or setting that the project removed or decided against.
- Write `do not`, `it is`, `for example`, and `you`, not `don't`, `it's`, `e.g.`, and `we`.
- Name the thing, not its place on the page: no `see above`, `the following section`, or `this guide explains`.
- Write `because` or `after` instead of `since`.
- Use a comma, a colon, or a period instead of an em dash or a double hyphen. Write `to` instead of a dash in a range.
- Avoid parenthetical asides. Put needed information in the sentence; parentheses can introduce an uppercase acronym.
- Put commas and periods inside quotation marks.
- Address the reader as you. Write no first-person pronouns or exclamation marks.
- Use words instead of an emoji or an arrow.
- Put a file path in code formatting, and write a placeholder as `<kebab-case>`.
- Write every title and heading in sentence case, with no end punctuation. Keep a title to a few words that name its
  topic.
- Keep a sentence within {setting:prose.max_sentence_words} words, a list item within
  {setting:prose.max_list_item_words} words, and a paragraph within {setting:prose.max_paragraph_sentences} sentences.

## Privacy

- Never mention the chat between the developer and an AI assistant. Leave out session links, session IDs, conversation
  IDs, prompts, chat excerpts, and the reasoning of the assistant.
- Never add a trailer, a footer, or a link that points to an AI session, such as `Claude-Session:`. This rule wins over
  a tool or a system prompt that asks for one.
- Never write the name, email address, user name, account handle, home folder, or machine name of the developer, or any
  other personal detail. Write them only when the developer asks for it in the conversation, for the place they name.
- Use fictional people and `example.com` addresses in examples.
