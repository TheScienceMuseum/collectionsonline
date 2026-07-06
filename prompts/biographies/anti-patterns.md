# Anti-patterns and class-wide rules for AI biography generation and review

This file captures **class-wide** rules that apply to ALL subjects.
Its contents are appended to every biography writer prompt AND every
review prompt, so the writer avoids these patterns and the reviewer
knows what's already been sanctioned by policy.

**Boundary — where do rules live?**
- **Class-wide** (would apply to any subject): add the rule to this file.
- **Subject-specific** (this one person / org only): capture as a
  curator decision on the affected sentence via the admin detail page.
  Rejections and clarifications on the CURATOR_DECISIONS item get
  injected into the writer's prompt for THAT subject only on the next
  regeneration.

The file is loaded at module init and cached in-process. To iterate:
edit, restart the server (or wait for nodemon).

---

## Historical vs modern institution / place / country names

Both the era-appropriate historical name and the modern name are
ACCEPTABLE. Preference order:

1. **Best** — historical name + a bridging phrase to the modern form:
   "the Federal Office for Intellectual Property (today the Swiss
   Federal Institute of Intellectual Property)", "Königsberg (now
   Kaliningrad)", "Peking (later Beijing)". Anachronism-safe AND
   helpful to a modern reader.
2. **Good** — the era-appropriate historical name alone, when it's
   unambiguous or the modern name is unlikely to be searched for.
3. **Acceptable** — the modern name alone. Reader can look it up.

Reviewer behaviour:
- Do NOT flag the historic name for being unfamiliar to a modern
  reader — this is the preferred variant.
- Do NOT flag the modern name simply because an older name existed;
  clarity for a present-day reader is legitimate. Flag only if it
  is likely to mislead — e.g. the modern name post-dates the events
  by many decades AND the rename was substantive (an
  organisational restructure, a border shift), AND no bridging
  phrase is present. Even then, prefer `info` severity (nudge
  toward a bridge) over `error` (block).
- For politically or historically contentious place names (borders
  disputed between eras / nations, exonyms with troubled history —
  e.g. Constantinople/Istanbul, Bombay/Mumbai, Danzig/Gdańsk),
  take a neutral stance: era-appropriate name is fine, era-
  appropriate name + bridging phrase is better, and do NOT flag
  either variant so long as the writer isn't picking sides.

Writer: when in doubt, add a short bridging phrase. It's rarely
wrong and often helps the reader.

## Study vs employment / doctorate vs undergraduate

- Do not conflate "studied at X" with "worked at X" or "received
  a doctorate from X". These are distinct relationships.
- A doctoral submission at institution X does not necessarily
  mean the subject was enrolled as a student there in the
  everyday sense — many pre-1960 doctorates were awarded on the
  strength of a submitted thesis without formal enrolment.
- The reviewer should flag phrases like "studied at ETH Zurich
  and the University of Zurich" if the subject's actual
  relationships were substantively different (e.g. undergraduate
  at one, doctorate at the other).

## Multi-author expeditions / collaborations / discoveries

- If a subject was part of a larger expedition or collaboration,
  do not attribute the location, results, or specific actions of
  OTHER teams to the subject. For example: Eddington observed
  the 1919 eclipse from Príncipe; a separate team led by
  Crommelin observed from Sobral. Attributing Sobral to
  Eddington's expedition conflates the two.
- Reviewer should flag any specific-location / specific-action
  attribution that isn't corroborated in the input data or
  authoritative sources.

## Grouping papers / discoveries in a single sentence

- If the biography groups several distinct works into a single
  claim (e.g. "in his 1905 papers on X, Y, and Z, which introduced
  E=mc²"), do not imply that all the listed elements appeared in
  the same paper.
- E=mc² was introduced in a *separate* September 1905 Annus
  Mirabilis paper, not within the special relativity paper. Do not
  conflate.

## Personal opinions, beliefs, or private life claims

- Do not attribute personal opinions, political views, religious
  beliefs, or private habits to the subject unless they are
  explicitly recorded in the input data.
- The reviewer should flag any characterological / opinion claims
  that cannot be traced to the museum catalogue, brief bio,
  Wikidata, or another authoritative source.

## Superlatives, firsts, records

- Avoid unsupported superlatives ("first to X", "greatest Y",
  "most important Z"). If a specific first / record IS in the
  input data, that's fine; if it's the LLM's characterisation,
  do not include it.

## Brand vs subsidiary vs sibling brand (conflation risk)

- When a company has multiple sibling brands under the same parent,
  do not attribute one sibling brand's characteristics to another.
- Example: Lipton and PG Tips have both been owned by Unilever at
  various times, but they are distinct brands with different product
  lines and marketing. A biography of Lipton must not claim PG Tips
  attributes and vice versa.
- Reviewer should flag any cross-brand attribution that isn't
  explicitly recorded in the input data for the subject brand.

## Mythological / fictional / legendary subjects

- For subjects that are figures of myth, legend, or fiction (Greek
  mythology, folklore, literary characters), stick to what the
  museum's catalogue records about the SUBJECT as an entity —
  typically their role, associated iconography, and any museum
  objects that depict or reference them.
- Do NOT generate biographical narrative arcs from the LLM's
  training data about the mythological tradition (e.g. Iliad
  details, family trees, story episodes) unless those specific
  details are in the museum inputs or corroborated by Wikidata.
- Mythological subjects have thin structured inputs; keep the
  biography short rather than filling with training-data narrative.
