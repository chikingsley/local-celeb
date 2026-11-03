# Transcript Style Profiles

Date: 2026-07-11

## Product Decision

A transcript analysis profile should not collapse language, dictionary, and editorial style into one vague setting. Keep these as separate inputs:

- **Language and regional variant**: for example, American English or British English.
- **Lexical authority**: the dictionary or terminology list used for spelling and word choice.
- **Editorial style**: punctuation and presentation rules such as serial-comma preference.
- **Transcript overrides**: names, domain terminology, quoted wording, and intentional exceptions.

The analysis result is a queue of proposed changes. A rule or model may identify many affected locations, but it must not mutate transcript text directly. The user selects a proposal, moves through every location, reads the reason and before/after text, then accepts or rejects the group.

## Why The Axes Stay Separate

- [Merriam-Webster](https://www.merriam-webster.com/about-us) describes itself as an American language reference and is a reasonable lexical authority for an American English profile.
- The [University of Oxford Style Guide](https://www.ox.ac.uk/about/the-university/brand/style-guide) uses the Oxford English Dictionary as its fallback reference, but its [punctuation guidance](https://www.ox.ac.uk/about/the-university/brand/style-guide/punctuation) normally omits the serial comma unless it prevents ambiguity.
- The [Chicago Manual of Style](https://www.chicagomanualofstyle.org/qanda/data/faq/topics/Commas/faq0103.html) explicitly prefers the serial comma.

This is why “Oxford,” “British English,” and “use the Oxford comma” cannot be treated as synonyms. A profile can use British spelling while preserving, preferring, or avoiding the serial comma independently.

## Implemented Prototype

The current deterministic analyzer demonstrates the product mechanism without pretending an LLM ran. It supports:

- American or British spelling normalization for a conservative word list.
- Preserve, prefer, or avoid serial commas in simple detected lists.
- Repeated-space cleanup.
- Spaces-before-punctuation cleanup.
- One proposal per rule, containing all affected transcript locations.
- Previous/next navigation, before/after display, reason display, accept-all, and reject.
- A single undo checkpoint when an accepted proposal changes multiple segments.

## Future Model Adapter

A future AI analyzer should receive the transcript, selected style profile, and transcript overrides, then return the same proposal structure used by deterministic rules. Contextual lanes can include grammar, punctuation, terminology consistency, likely speaker names, and diarization corrections.

The model response should remain advisory. Application code validates segment IDs and original text before applying accepted changes. Reference URLs or rule identifiers can be attached to proposals when the selected profile has an external authority.
