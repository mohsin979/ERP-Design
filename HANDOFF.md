# HOF Pulse ERP — session handoff (2026-11-02)

Start a new Claude Code session **in `/Users/hf/Downloads/hof-erp`** (the single home: code, rules in `CLAUDE.md`, references in `docs/`) and say:
"Read /Users/hf/Downloads/hof-erp/HANDOFF.md and continue from it."

---

## 1. What this is

A static React prototype of the HOF Pulse ERP (CRM module first): Contacts, Deals, Customers, Tools (Calls, Tasks, Emails, Meetings, Notes, Quotes, Services), Marketing → Forms, Accounting (payment terms), Dashboard, Workflows (builder + engine), Settings.

- **Code:** `/Users/hf/Downloads/hof-erp/` — plain `.jsx` files loaded by `<script type="text/babel" data-presets="react" data-plugins="">` tags in `index.html` (50 scripts, order matters only for top-level use). No build step. Top-level `const`/`function` are shared globals; each file ends with `Object.assign(window, {...})`.
- **Rules:** `hof-erp/CLAUDE.md` — the single rules file (the older copy in `design_handoff_supplier_module/source` was retired on 2026-11-02; this one contains all of it plus a codebase map in §24). Key points: implement only the requested scope; ask when product behaviour is ambiguous; never invent accounting behaviour; preserve existing behaviour; undefined actions open the `StubPanel` ("Not defined yet."); never use the word "Warning" in UI copy.
- **Figma reference:** "HOF CRM Redesign", fileKey `cycMNqAHEktOBR3XJGLw6t`.

## 2. How the designer (Mohsin) works

- Prompt types: **Discovery** (explore, ask questions first), **Change/Update** (only the requested change), **Claude Prompt** (explicit instruction). "Make these changes only" = hard scope fence.
- Expected loop: inspect the existing code → summarise what exists → ask the open product questions (AskUserQuestion, recommended option first) → implement → verify in the browser → report honestly (what was tested, what wasn't, decisions you made, limits).
- **Never republish unless the user says "host it".**

## 3. Running and testing locally

- Server: `cd /Users/hf/Downloads/hof-erp && python3 serve.py 9420` (serve.py has `request_queue_size = 256` — needed, or Babel's many script loads get connection resets). Open http://localhost:9420. Test login: **Qa Tester** (Super Admin).
- Compile-check a file (fast, no npx):
  `E=/Users/hf/.npm/_npx/50d6b1f34829f5bc/node_modules/.bin/esbuild; $E --loader:.jsx=jsx file.jsx --log-level=error >/dev/null && echo ok`
- Duplicate-global check: `grep -ohE "^(const|let|var|function|class) [A-Za-z_0-9]+\b" *.jsx | sort | uniq -d` (must print nothing).
- Edits were made with small python scripts doing exact `str.replace` with `assert s.count(a)==1`.
- Data: one localStorage store `hof-erp-store-v2` (store.jsx: `usePersistedState(name, init, adapt, pack)`). In the browser console `resetAppStore(); location.reload()` restores sample data — do this after every test.
- Useful handles in the page (via JS):
  - App settings setter: walk React fibers from `#root` (`root[__reactContainer…].stateNode.current`) for a hook whose state has `.workflows` → its `queue.dispatch`; then `saveWorkflowIn(dispatch, workflow)` creates/updates workflows.
  - Engine ctx: fiber `memoizedProps.value` with `setDeals && api` (`setDeals` = tracked record setter, `api.*`).
  - Record hub: value with `createRecord && openRecord` (`openRecord(object, id, 'full', tab)`).
  - Globals: `WF_LIVE` (records, accounting, profiles), `recordObjectOf(id)` (numeric = contact, `cust-` = customer, else deal).
- The Browser pane is often hidden → screenshots lag; prefer reading DOM text via JS. Scheduler checks run every 15 s (wait ~16 s for time-based workflow tests).

## 4. Hosting

- Hosted artifact: https://claude.ai/artifact/Hfb7wMGwpvtAsNp8uAAyQP — **Version 19** is current. **Keep updating this same link** (Mohsin's decision). It's owned by the old account and shared with the new one for editing, so:
  1. Before the first publish in a session, read it: Artifact `action:"read"` with that `url` (a publish to an artifact the session hasn't read is refused). The read must say you're a "writer" — if it doesn't, the share hasn't been done yet: ask Mohsin to give the new account edit access from the artifact's Share menu; don't publish a separate artifact.
  2. Publish updates with `url` set to that link (never without `url` — that would create a new artifact). Send only the changed files in `files`; the rest are kept.
- Build folder: copy all `*.jsx` + `assets/` into a scratch folder; regenerate `index.html` from the source `index.html`: strip doctype/`<head>` wrappers and `<meta>` tags, title `HOF Pulse ERP`, add `background:#FAFBFC; color:#15141B` to `body` and `:root { color-scheme: light; }`. Publish with a `files` map listing every script (contentType `text/javascript`) and assets; on updates only changed files need sending.

## 5. Architecture you'll touch most

| Area | Files |
|---|---|
| Records, tables, filters, schema | `contacts.jsx` (ContactsDataGrid, TableSettingsModal, FilterByField, `useRecordSchema`, `withScopeFilters`), `deals.jsx`, `customers.jsx`, `board.jsx` |
| Cards / panels / Highlights | `cardSettings.jsx`, `panelSettings.jsx`, `overviewSettings.jsx` |
| Customer Profile & Accounting properties (shared) | `extendedProps.jsx` (keys `pf:<form>:<field>`, `acc:<key>`) |
| Workflows builder | `workflows.jsx` (triggers registry, `triggerSettingFields`, `triggerReady`, `triggerIssue`, summaries, TriggerSettings, saveWorkflowIn) |
| Workflow engine + violations UI | `workflowEngine.jsx` (events, `dispatch`, `fire`, actions, scheduler `tick`, `entryBlockers`, `backfillAllRecords`, ViolationPanel, block card `AutomaticActionModal`, `api`) |
| Accounting | `accounting.jsx` (schedules = payment terms; `defaultPaymentTerms`, pack/unpack) |
| App wiring | `app.jsx` |

## 6. Decisions made in this session (keep them)

**Accounting**
- Every Contact / Deal / Customer gets default payment terms (one installment "First installment", 100 %, Unpaid, no due date; deal total = Deal Amount, else 0). Untouched defaults are stored compactly (`packPaymentTerms`). An installment with nothing received is Unpaid even at amount 0.

**Workflows — trigger scope**
- **All Records**: on save / turn-on (once per version) existing records are checked: state triggers (property values, counts), records already where an entry trigger leads (Stage Entry → in the stage, Pipeline Entry → in the pipeline, New Record → exists). Moments (exits, changes, form submitted, specific email, Repeat) apply from the next occurrence. **New Records**: nothing existing.
- **Enforce Rules + All Records + Block Stage Entry**: records already in the blocked stage that meet the block are **moved back automatically** to the stage they came from (last recorded entry, else nearest earlier non-outcome stage). If that move is blocked too → "Change values" violation.

**Workflows — triggers**
- **Associated Record** (Record Events; needs a Record in context): Associated Object (the other two objects) + Parameter **Is created / Is not created / Is changed / Is not changed**. Created = newly created linked in the same action (linking an existing one doesn't count); workflow-created records count (loop guard). Not created = has none. Changed = any property/stage change on any of them. Old "Associated Record Created" migrates to Is created.
- **When** dropdown (replaced For/Within + "In this stage" checkbox) on property Is changed/Is not changed and Associated Is not created/Is not changed: **In this stage** (existing + entering records), **Within a time period** (number + unit, from context entry), **Throughout the record's lifecycle** (violation open across stages until met). Block Stage Entry + time period is flagged in the builder.

**Workflows — resolving violations**
- Blocked person move → block card guides: remedies per condition (Edit <property>, Create <object>, Associate an existing <object> — only records free to link), live ✓ "Done", then **Move to "<stage>"** completes the original move. The move stays pending on the card ("↗ Stage ×") until done, dismissed ("Don't move") or the record moves elsewhere.
- "Is not changed · In this stage" blocks: satisfied once the property was updated (or confirmed) **since the record entered its current stage** (Mohsin gave a principle; this timing is my interpretation — flagged to him).
- "The new value received from the client is the same." checkbox appears for **change-based** conditions only (Is changed / Is not changed); it counts as an update everywhere (changedAt + Property Update event) and is logged on the record as a workflow activity. Value conditions must actually change (no override).
- Track Violations: move proceeds; violation recorded; same remedies offered next to the workflow's action; meeting the condition resolves it automatically.
- Violations panel: one-line explanation per card (contextual, e.g. "Expected Close Date was not updated at this stage.", "A customer must be created at the Payment Made stage."); clicking a card highlights the record (Board card or table row, page jump); the record's badge "⚠ n | View ▾" opens the workflow diagram (trace pane) with the conflicting action outlined red; several violations → dropdown by workflow + one-liner.

**UI**
- Emails (Tools page and record tab) use the Meetings layout: Inbox / Sent / Scheduled as tabs, record types as pills.
- Dashboard KPI cards all equal height (240 px min), shared padding.
- Customer Profile Properties (grouped by profile form) and Accounting Properties (the single list of 8 from `ACCOUNTING_TRIGGER_FIELDS`) available in: Filters (submenus), Table columns, Card properties, Highlights (accordions). Read-only in tables/cards. Highlights pin `acc:nextInstallment` migrated to `acc:nextInstallmentDueDate`.

## 7. Open / possible follow-ups (mentioned to Mohsin, not done)

- Card **Related Properties** (left/right dropdowns) don't offer Customer Profile / Accounting properties (would need a custom dropdown with submenus).
- Contacts and Customers were wired for the new property groups but only Deals was clicked through.
- Contact cards have no violation badge / pending-move chip area.
- Run history keeps only the latest 400 runs (All Records on 1,000+ contacts drops older runs from the list).
- Deal amount changes don't update default payment terms' total; deleting default terms recreates them.
- Lifecycle blocks work with the record's own properties only (not Customer Profile / Accounting / User properties).
- "Is not changed · In this stage" with Block Stage Entry moves existing deals back on save if not updated since entering the blocked stage — confirm with Mohsin if that's too aggressive.

## 8. Memory

Persistent notes for sessions opened in `hof-erp` live in `/Users/hf/.claude/projects/-Users-hf-Downloads-hof-erp/memory/` (MEMORY.md index) — copied over from the old project folder on 2026-11-02 (paths updated).

## 9. Reference material (`docs/`)

| Folder | Contents |
|---|---|
| `docs/specs/` | Workflow specs — `Workflow_Trigger_Catalogue.docx` and `Workflow_Triggers.docx` (early drafts), `Workflow_Triggers_Actions.docx` (latest PRD, Oct 23 — has Email sent ago, Schedule Email & Sequence, Exit Email Sequence, Classify Record (AI), number-wise team assignment), `Workflow_Triggers_Actions_Implementation.docx` (Oct 22, adds Implementation Principles; says random team assignment). They overlap but aren't duplicates — the two latest disagree in places. `HubSpot Properties.xlsx` (Oct 30 version). |
| `docs/reference/users-teams/` | The Users & Teams settings module prototype (folder + standalone HTML). |
| `docs/figma/` | `HOF CRM.fig`, `HOF CRM Redesign.fig` (offline copies; the live file is fileKey `cycMNqAHEktOBR3XJGLw6t`). |
| `docs/brand/` | HOF / Pulse logos. |
| `docs/hof-pulse-design-system.html` | The shared ERP design system page. |
| `docs/module-icons-source/` | `Edit-Pen-Write-Paper` (the only source icon not already in `assets/`). |

Git: everything is committed and pushed to `github.com/mohsin979/ERP-Design`, branch `erp-prototype` (commit / push only when Mohsin asks).
