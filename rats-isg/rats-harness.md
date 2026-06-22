# RATS Development Harness

---

## The (Four?) Layers

### Layer 1 (Foundation)

#### CLAUDE.md
Every time an engineer opens Claude Code in the RATS repo, this file is read automatically.

Contains:
- What RATS is and what it does (system overview)
- The Cold Fusion version and key conventions
- SQL Server conventions (things like "always use `cfqueryparam`")
- Architectural rules ("never modify `super-cool-file.cfc` without checking dependents")
- Pointers to the memory system: "for schema details, read `/rats-memory/schema/tables.md`"
- Examples of what Claude should never do without checking first

CLAUDE.md should be somewhat short. It sets the rules and points to a filing cabinet (memory `.md` files), but is not the filing cabinet itself

---

#### Memory System: `/rats-memory/`

`/rats-memory/` is a folder of markdown files that lives inside the RATS repo, version-controlled in Git alongside the code. Claude Code reads these natively.

The point is that Claude Code should never have to hold the entire repo in its context window (prevent overloading Claude). Instead, agents and skills will consult the INDEX.md to find what's relevant for the current task and pull only those files.

I've made this example of a 4-way split into subfolders. Here's what questions each subfolder answers for Claude:
`/rats-memory/schema/`: "what does the data look like?"
`/rats-memory/modules/`: "where is the relevant code?"
`/rats-memory/patterns/`: "how does this codebase usually do things?"
`/rats-memory/business/`: "what is the purpose of things in this repo?"

It sort of gives Claude the full picture as much as possible.

```
/rats-memory/
  INDEX.md                    ← agents always start here
  /schema/
    tables.md                 ← all tables, columns, types, foreign keys
    stored-procs.md           ← name, purpose, parameters
    relationships.md          ← foreign key map, common join patterns
  /modules/
    claims.md                 ← key coldfusion components, templates, entry points
    billing.md
    doc-retrieval.md
    [should be one file per domain]
  /patterns/
    cf-style.md               ← coldfusion conventions with real examples from RATS
    sql-conventions.md        ← query style, parameterization patterns
    error-handling.md         ← how RATS handles errors
    gotchas.md                ← known traps, things to never do, things that will break
  /business/
    claim-lifecycle.md        ← end-to-end explanation of workflow from ISG's perspective
    user-roles.md             ← who can do what in the system
    glossary.md               ← ISG/insurance terms mapped to code concepts
    jira-patterns.md          ← common ticket types and what they typically involve
```

`INDEX.md` is pretty much a routing table in plain English: 

```markdown
## When working on a billing ticket
- /schema/tables.md - tbl_Invoice, tbl_Payment
- /modules/billing.md - entry CFCs and templates
- /patterns/cf-style.md - always include
- /business/claim-lifecycle.md - billing sits at stage 4

## When working on a document retrieval ticket
- /schema/tables.md - tbl_Document, tbl_Request
- /modules/doc-retrieval.md
...
```

**Where each folder's content comes from:**

| Folder | Source |
|--------|--------|
| `/schema/` | Generated from SQL Server (`INFORMATION_SCHEMA` queries) |
| `/modules/` | Extracted from CF codebase (requires codebase access) |
| `/patterns/` | Extracted from codebase + engineer interviews |
| `/business/` | Extracted from user manuals, wikis, and engineer interviews |

The schema folder can easily be automated. The others require someone to read the code and write the files. This is one-time work that is required for anything else to really be built.

---

### Layer 2 - Skills

Reusable commands for Claude Code that engineers can type instead of having to prompt the whole thing every time. Each skill should be able to pull the correct context every time (repeatable).

| Example Skill | What it does |
|-------|-------------|
| `/fix-ticket` | Takes a Jira ticket number, reads the ticket, finds relevant memory files via INDEX.md, pulls the relevant CF code, proposes a fix |
| `/write-cf-function` | Generates a new CF function using real RATS patterns from `cf-style.md` |
| `/write-query` | Generates a SQL query using the schema and `sql-conventions.md` |
| `/explain-code` | Reads a CF file and explains what it does in plain English |
| `/review-diff` | Checks a code change against style guide and flags potential issues |
| `/trace-dependency` | Given a file or component, identifies what else in the codebase calls it |
| `/summarize-manual` | Reads a user manual section and explains the intended behavior |

Some simple ones to build to demonstrate how this could work to the engineers are `/explain-code` and `/fix-ticket`. These can prove how this is immediately useful and give them a reason to actually use the tool.

---

### Layer 3 - Agents

Agents are more autonomous than skills. They can do multiple steps, consult memory, and make decisions about what context to pull. This might be something to introduce later on. Some brainstormed examples:

**Ticket agent**
An engineer says "work on `ticket-name-or-number`" The agent would read the Jira ticket, consult INDEX.md, identify the relevant module and schema files, pull them, reviews the relevant code, and proposes a fix without the engineer having to interfere anywhere along the way.

**Impact agent**
This agent can help built trust with the engineers, since this is probably one of the most tedious tasks for them. Before any change is committed, an engineer can run this agent to trace what else in the codebase might be affected by their commit.

**Onboarding agent**
Walks any engineer through an unfamiliar or potentially outdated module that maybe hasn't been touched in a while. Could even be useful for new hires, if that's even applicable for ISG.

Engineers will basically become those who review code instead of also write the code.

---

### Layer 4 - Hooks/Testing

## Git Hooks (Future Adoption?)

**Pre-commit hook example**
When an engineer commits code, the hook automatically:
- Checks the changed files against `cf-style.md` for convention violations
- Runs the dependency tracer to flag any touched shared components
- Optionally generates test cases for the changed functions

---

## Testing Infrastructure

**What I'd do**
1. Understand what testing exists before assuming there's nothing (TestBox, MXUnit, CFSelenium?)
2. Add the `/write-tests` skill that generates test cases for a given CF function or bug fix
3. Start out by generating tests for new code and changed code only (no full suite generation)
4. Integrate test execution into the Git pre-commit workflow over time

---

## Build Sequence

| Section | What to create | Why this order |
|-------|----------------|----------------|
| **Foundation** | CLAUDE.md + `/rats-memory/` folder | Everything else depends on this being high quality |
| **Skills** | `/explain-code`, `/fix-ticket`, etc. | Low risk and immediate value for engineers (proves the concept to them) |
| **Agents** | Ticket agent, impact agent | Built on top of the memory + skills. More power here but requires trust from the engineers. |
| **Hooks + Testing** | Git pre-commit hook, `/write-tests` skill | Might be secondary since it requires a stable foundation first |

---

## Questions

- Current RATS testing infrastructure?
- What Cold Fusion version is RATS running? (Affects available syntax and frameworks)
- Do the engineers use any IDE currently, or just text editors?
- What does the Jira ticket structure look like (components, labels, custom fields)?
- Who will have access to the codebase to do the initial memory extraction?
- Is there a specific strategy for how to get the engineers to willingly adopt this?

---

## Important tradeoffs

**Why markdown files in the repo vs. Obsidian or a vector database**
Obsidian is a great for writing markdown environment but its advantages are for the human writing the notes, not for Claude reading them. Claude Code reads flat markdown files natively. Keeping files in the repo means they're version-controlled alongside the code they describe. A vector database would enable smarter retrieval at scale but adds infrastructure overhead that isn't justified until there's proof that some sort of extension is actually required.

**Why skills before agents**
Agents are more impressive but require the memory system to be solid first. A skill that doesn't work well is easily fixed, but an agent that confidently proposes the wrong fix is going to break any trust the engineers have in this system as a whole. I think agents are something that can be added as trust builds (if I'm right about how difficult adoption might be).

**Why the INDEX.md routing approach makes sense**
We don't want to overload Claude's finite context window, so we put always-loaded instructions for how to use the not-always-loaded memory system so that it has a good idea of what to do for as few tokens as possible.

**Other thoughts**
I think if the existing engineers are protective of their work and skeptical about AI, the tool is better off starting as something that will "do the tedious stuff" for them (like an assistant) and maybe add the autonomy and heavy lifting agents for later.