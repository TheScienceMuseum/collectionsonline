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

- "Studied at X", "worked at X", and "received a doctorate from X"
  are distinct relationships. Writer should reach for the specific
  verb where the record supports it.
- A doctoral submission at institution X does not necessarily mean
  the subject was enrolled as a student there in the everyday
  sense — many pre-1960 doctorates were awarded on the strength of
  a submitted thesis without formal enrolment.

Reviewer behaviour:
- Do NOT flag a sentence just because it lists multiple institutions
  after "studied at". Read the WHOLE sentence — if the writer has
  disambiguated further along (e.g. "studying at ETH Zurich… and he
  later received his doctorate from the University of Zurich"), the
  claim is correctly specific and does not need flagging.
- Only flag when the sentence GENUINELY conflates — when a single
  undifferentiated verb ("studied at", "worked at", "was at") is
  applied to two institutions whose relationships to the subject
  were substantively different, AND the writer offers no
  disambiguation elsewhere in the sentence or paragraph.
- Prefer `info` severity (nudge toward clearer verbs) over `error`
  (hide the sentence). Even a genuine conflation rarely warrants a
  block-tier hide — the sentence still conveys "the subject had a
  relationship with these institutions", which is true.

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

## Sweeping narrative claims (any source tag)

- Avoid grand narrative summaries — phrases like "enduring presence",
  "lasting legacy", "cultural significance", "material culture",
  "across centuries", "across millennia", "throughout history",
  "illustrates the subject's continued relevance".
- These read as authoritative but almost never have specific evidence
  in the input data. State what the sources say happened in specific
  dated terms. If a claim can only be phrased in sweeping terms, it
  probably shouldn't be in the biography.
- Applies REGARDLESS of source tag. In particular this is NOT a
  loophole for `llm:contextualising` — see the section below.
- BAD example: "The museum's collection illustrates Hygeia's enduring
  presence in material culture across more than two millennia, from
  ancient originals to later reproductions and commemorative objects."
- GOOD example: "The museum holds N objects depicting Hygeia,
  ranging in date from A to B and including [specific examples]."
- The reviewer should flag any sentence making a sweeping narrative
  claim without dated, source-anchored specifics as `error:medium`.

## llm:contextualising boundaries — real era colour vs covert subject-claims

- The `llm:contextualising` tag is for GENUINE background / era colour
  where the sentence is NOT a specific claim about the subject.
  Legitimate example: "Artificial eye making in early eighteenth-
  century London was a specialist trade centred in Clerkenwell."
  That sentence would be true whether or not the subject existed —
  it's context about the world the subject inhabited.
- `llm:contextualising` is NOT a loophole for making unsupported
  claims about the SUBJECT. If the sentence talks about the subject's
  importance, endurance, cultural significance, legacy, iconography,
  or "presence" across time, it is a subject-claim regardless of how
  it's phrased.
- Trigger words that suggest a supposedly "contextualising" sentence
  has crossed into subject-claim territory: "enduring", "legacy",
  "material culture", "illustrates the subject's", "across centuries /
  millennia", "reflects the subject's", "continues to inspire",
  "remains central to". If any of these appear, the sentence is not
  contextualising — either OMIT it or tag it `llm:general_knowledge`
  (which will be hidden by default at publishing level 3).
- The reviewer should flag `llm:contextualising` sentences that make
  claims specifically about the subject as `error:medium`.

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
