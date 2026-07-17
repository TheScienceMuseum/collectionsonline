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

"Studied at X", "worked at X", and "received a doctorate from X" are
distinct relationships. Use the specific verb the source supports.
Note that pre-1960 doctorates were often awarded on submitted thesis
without formal enrolment — a doctoral submission at institution X
doesn't necessarily mean the subject studied there.

Reviewer behaviour:
- Do NOT flag a sentence just because it lists multiple institutions
  after "studied at". Read the WHOLE sentence — if the writer has
  disambiguated further along (e.g. "studying at ETH Zurich… and he
  later received his doctorate from the University of Zurich"), the
  claim is correctly specific and does not need flagging.
- Only flag when the sentence GENUINELY conflates — a single
  undifferentiated verb applied to institutions whose relationships to
  the subject were substantively different, with no disambiguation.
- Prefer `info` severity (nudge toward clearer verbs) over `error`.

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

## Prose overreach — claiming more than the citations support

Verbatim citation excerpts prevent quote confabulation but do NOT
prevent claim inflation. A sentence can cite the source verbatim and
still assert more than the source actually says. The reviewer must
compare each sentence's prose against its cited excerpts and flag any
sentence whose prose is materially stronger than the excerpts support.

Common inflation patterns:

- **Etymological → causal.** Source says "gave her name to X"; prose
  says "gave rise to X" or "gave rise to the concept of X". Deriving
  a WORD from a name is not causing a CONCEPT to exist.
- **Occupation → founding.** Source says "worked as a physicist";
  prose says "pioneered modern physics".
- **Membership → prominence.** Source says "was a member of Y";
  prose says "was a leading figure at Y".
- **Fact + unsupported context.** Source says "was born in Ulm";
  prose says "was shaped by the intellectual centre of Ulm".
- **Added intensifiers.** Source says "the philosophy of hygiene";
  prose says "the concept AND philosophy of hygiene". Adding "the
  concept and", "the great", "the enduring", "the profound" adds
  weight the source does not carry.

BAD example (real Hygeia case, cp97864):
- Source: `personData.biography` contains "She gave her name to the
  philosophy of hygiene"
- Prose: "Hygeia gave rise to the concept and philosophy of hygiene"
- Both citations are verbatim substrings, so the citation validator
  lets them through — but the prose has silently upgraded "gave her
  NAME to the philosophy" (etymology) into "gave RISE to the CONCEPT
  AND philosophy" (causation of a whole concept). That's a stronger
  claim not present in the source.
- Fix: "Hygeia gave her name to the philosophy of hygiene." (soften
  back to what the source supports; drop "the concept and" and "gave
  rise to")

Reviewer should flag prose-overreach as `error:medium` when the
sentence prose asserts materially more than the cited excerpts
support. If the writer's inflation is minor / subjective, flag as
`info` instead.

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

## Mythological / fictional / legendary subjects

For subjects that are figures of myth, legend, or fiction (Greek
mythology, folklore, literary characters), stick to what the museum's
catalogue records about the SUBJECT as an entity — role, associated
iconography, and museum objects that depict or reference them.

Do NOT invent biographical narrative arcs from the LLM's training data
about the mythological tradition (Iliad details, family trees, story
episodes) unless those specific details are in the museum inputs or
Wikidata. Mythological subjects typically have thin structured inputs;
keep the biography short rather than filling with training-data narrative.

## Attribution to the wrong entity in a related family (broader)

The sibling-brand rule above is one shape of a broader class: a
sentence names a product / action / output but attributes it to the
wrong entity in a related family. The families that recur:

- Parent company vs subsidiary (Unilever vs Gibbs)
- Sibling brands under one parent (Lipton vs PG Tips)
- Collaborators on a shared project (Eddington's Príncipe team vs
  Crommelin's Sobral team on the 1919 solar eclipse)
- Adjacent scientific expeditions or scholarly teams

Rule: for every claim naming an entity's action, product, or output,
the cited excerpt must contain BOTH the entity name AND the
attribution together. If only one side is in the excerpt, do NOT
infer the other. Tag the sentence `llm:inferred` or omit — do NOT
tag `museum` with the missing side inferred.

BAD example (real Einstein case, cp37054):
- Museum has instruments used at Sobral, Brazil, in 1919
- Museum lists Eddington as a related person
- Biography wrote: "The 1919 total solar eclipse expedition at
  Sobral, Brazil, organised by Sir Arthur Eddington…"
- Problem: Eddington's team observed from Príncipe (west Africa);
  the Sobral expedition was a separate team led by Andrew Crommelin
  of the Royal Greenwich Observatory. Two entities in the input
  (Sobral + Eddington) welded into a wrong attribution.
- Fix: "The museum holds instruments from the 1919 total solar
  eclipse expedition at Sobral, Brazil, which was one of two teams
  observing the eclipse to test Einstein's Theory of Relativity."
  (Sobral cited to museum; drops the wrong attribution to Eddington.)

Reviewer should flag any attribution where the entity + action
aren't co-located in a single citation as `error:high`.

## Named-place substitution

Do NOT substitute a well-known named location for the specific
location the museum inputs record, even when the two are near each
other. Named places carry historical baggage and famous names crowd
out precise ones in the model's completions.

BAD example (real Unilever case, cp42536):
- Museum: "on marshes at Bromborough Pool on the Wirral Peninsula"
- Biography wrote: "on marshland at Bromborough Pool on the Wirral,
  known as Port Sunlight"
- Problem: Port Sunlight is on the Wirral Peninsula but is a
  distinct location (Bebington). Bromborough Pool is where the works
  actually stood.
- Fix: "on marshes at Bromborough Pool on the Wirral Peninsula, at
  the site that later became known as Port Sunlight." (Preserves
  the museum's precise place, adds the modern name as fact-supported
  context ONLY if the source names both.)

Rule: for any place mentioned, the cited excerpt must contain that
exact place name OR a strictly more specific version of it.
Substituting a broader / more famous nearby place is a Named-place
substitution error. Flag as `error:medium` or `error:high` depending
on how far apart the places are.

## Temporal impossibility — cross-check death / dissolution dates

For every claim naming a person's involvement in a dated event
(founding, negotiation, publication, meeting, expedition), cross-
check the event date against the person's known death or activity
end. If the person died before the event, do NOT list them as a
participant — they may have been an architect, precursor, or
influence, but were not present.

BAD example (real Unilever case, cp42536):
- Wikidata: Antonius Johannes Jurgens died 1928
- Museum: Unilever formed 1 January 1930
- Biography wrote: "Unilever PLC was formed on 1 January 1930
  through the amalgamation of Lever Brothers [and] Jurgens…"
- Problem: Jurgens was central to the negotiations but died two
  years before the formal amalgamation. Naming him as a participant
  in the 1930 event is a temporal impossibility.
- Fix: "The company was created on 1 January 1930 by the
  amalgamation of Lever Brothers and Margarine Unie, negotiated by
  Antonius Johannes Jurgens (d. 1928), Samuel van den Bergh, and
  William Hulme Lever, 2nd Viscount Leverhulme." (Jurgens is named
  in his correct role — negotiator predating the founding.)

Rule: if a citation names a person, the sentence's assertion must
be consistent with that person's death / dissolution date. Where
the source is silent on death date, prefer past-tense construction
("was central to the negotiations") over event-participation
("was a founder of the 1930 amalgamation"). Reviewer flags as
`error:high` when the biography places a person at an event after
their known death.

## Unsupported institutional affiliation

Do NOT assert a subject's affiliation with any institution
(university, hospital, learned society, employer, patron, order,
academy) unless the exact affiliation is in a citation from the
museum inputs or from a wikidata property present in the fetched
context. Historically famous institutions are particularly high-
risk because the LLM has strong training-data priors about which
historical figures were "supposed to be" affiliated with them —
Newton at Trinity, Einstein at ETH, Watson at Bolton, etc. Some
priors are correct; the writer cannot rely on any of them.

BAD example (real Alexander Monro case, cp90211):
- Museum: silent on Monro's education
- Biography wrote: "He studied at Leiden University, one of Europe's
  foremost centres for medical education in the 18th century."
- Problem: Leiden is nowhere in the museum inputs or in the fetched
  Wikidata for this subject. LLM training-data prior only.
- Fix: either omit the education claim entirely, OR tag as
  `llm:general_knowledge` (which hides at publishing level 3).

Rule: for every institution named in a biography, the citation
must name that institution verbatim. If the LLM knows the subject
was affiliated but the source is silent, either omit or tag
`llm:general_knowledge`. Never launder a training-data affiliation
under a `museum` or `wikidata` tag. Reviewer flags as `error:medium`
when the affiliation is plausible; `error:high` when the specific
institution isn't attested in inputs at all.

## Mimsy catalogue "current (YYYY)" convention

Mimsy briefBiography strings of the form `"FROM-current (YYYY)"`
mean "still trading; last curator review in YYYY". The parenthesised
year is a CATALOGUING METADATA annotation — it does NOT mean the
entity ceased activity in that year. The Science Museum Group's
catalogue is continuously updated; there is no publication cutoff
that would justify treating the parenthesised year as an
authoritative "as of" date.

BAD examples (both wrong):
- Museum: `"1890-current (2009)"`
- Biography wrote: "Lipton Tea remained active up to at least 2009."
  Wrong — implies uncertainty about post-2009 status the catalogue
  doesn't have.
- Biography wrote: "Lipton Tea was active from 1890 until 2009 as
  of the museum's most recent record." Wrong — implies a knowledge
  cutoff.

GOOD examples:
- If we have Wikidata dissolution date (P576) present → use it:
  "Lipton Tea, active from 1890, was acquired by CVC Capital Partners
  in 2022." (P576 citation)
- If no P576 → simply say "active from 1890 to the present" or
  drop the "to the present" phrase entirely: "Lipton Tea is a
  British food and beverage brand founded in 1890."

Rule: NEVER write the parenthesised year from a "current (YYYY)"
string into the biography as if it were an "as of" year. When the
brief-biography contains this pattern, treat the "current" flag as
"still trading" and DISCARD the year annotation. If Wikidata has
a dissolution date, use it. Otherwise, prefer present-continuous
prose ("is active", "operates as") over dated-past-tense
constructions.

Reviewer should flag any biography quoting the catalogue's
parenthesised year as an "as of" date as `error:high`.
