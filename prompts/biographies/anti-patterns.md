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

- Prefer the era-appropriate name of the institution during the
  subject's active period.

- **Swiss patent office (Einstein 1902-1909)** — during his tenure,
  the office was called the "Eidgenössisches Amt für geistiges
  Eigentum". In English this is rendered as either:
    * "Federal Office for Intellectual Property" (accurate literal
      translation — ACCEPTABLE, do not flag)
    * "Swiss Patent Office" (informal / colloquial English — also
      ACCEPTABLE, do not flag)
  The 1998+ reorganised name "Swiss Federal Institute of
  Intellectual Property" IS anachronistic for the 1902-1909 period.
  Only flag when the modern institute name is used without a
  bridging phrase ("known today as…").
- Same principle for countries whose borders / names have changed
  (Prussia vs Germany vs West Germany; Bombay vs Mumbai; Peking
  vs Beijing). Use the name that would have been current at the
  time of the event.
- If the modern name is used and the biography does NOT
  acknowledge the historic name, the reviewer should flag it.
- If the biography includes a bridging phrase ("known today as
  X", "then called Y"), the reviewer should NOT flag it as an
  anachronism.

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
