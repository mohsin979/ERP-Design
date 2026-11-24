1. Project Context
This is an all-in-one ERP/business management platform for a global migration services company.
The main product areas are:

* CRM / Post Sales
* Case Management
* Petition Studio
* Accounting
* HRMS
* Settings

These modules are part of the same product and share business data.
A person can exist across multiple modules. For example:
`Lead → Contact → Deal → Customer → Case → Petition`
Do not treat these as separate people or duplicate records.
2. Core Product Rules
2.1 Object, Record, Property & Pipeline Structure
2.1.1 Core Data Structure
The ERP is structured around Objects, Records, Properties, and Pipelines.
2.1.1.1 Object
An Object represents a type of business entity in the ERP.
Examples:

* Contact
* Company
* Deal
* Case
* Petition
* Employee
* Invoice
* Payment

An Object defines the structure and behavior shared by its records.
2.1.1.2 Record
A Record is an individual instance of an Object.
For example:

* Contact → Ali Khan
* Deal → Ali Khan's Canada Migration Deal
* Case → Ali Khan's Active Migration Case
* Employee → John Smith

A record belongs to one Object type.
Records can have relationships with records belonging to other Objects.
2.1.1.3 Property
A Property is a data field belonging to an Object and stores information about a Record.
Examples for a Contact:

* First Name
* Last Name
* Email
* Phone
* Country
* Lead Source

Examples for a Deal:

* Deal Name
* Amount
* Expected Close Date
* Sales Owner
* Migration Type

Properties represent the data-entry points and attributes of an Object.
Properties may be system-defined or custom-defined, depending on the requirements of the Object.
2.1.1.4 Properties Are Data, Not Lifecycle Stages
A Property primarily stores information about a Record.
A Property can also be used to determine or drive a Record's lifecycle when the business requirement requires it.
For example:
`Application Type = US Visa`
could determine which pipeline or lifecycle applies to a Record.
However, a Property should not automatically be treated as a lifecycle simply because it contains values.
2.1.1.5 Pipelines
A Pipeline represents the lifecycle or progression of Records through a defined sequence of stages.
For example, a Deal pipeline may contain:
`Created → Progressing → Won / Lost`
Each stage represents a meaningful state in the lifecycle of that Object.
A Pipeline belongs to a specific Object.
A Pipeline can use a Property as input.
The system must support two different ways of defining a Pipeline.
A. Property-driven Pipeline
A Pipeline can be driven by a Property when the values of that Property represent the lifecycle of the Record.
For example:
Property: Deal Status
Values:
`Created → Progressing → Won → Lost`
In this case, the Property values determine the current Pipeline stage.
B. Manually Defined Pipeline
A Pipeline can also be explicitly configured without relying on an existing Property.
For example, a Deal Pipeline may be manually configured as:
`Created → Qualification → Proposal → Negotiation → Won / Lost`
The stages are explicitly defined as part of the Pipeline configuration.
The Pipeline itself manages the lifecycle stages.
C. Pipeline Stages
A Pipeline consists of ordered stages.
Each stage represents a state in the lifecycle of a Record.
Stages may have:

* Name
* Order
* Status
* Associated properties or requirements
* Other configuration defined by the product

Do not invent additional stage behavior unless it is specified.
2.2 One Real-World Entity = One Record
If two modules refer to the same real-world entity, they should reference the same record.
Examples:

* One person should have one Contact record.
* A Deal should reference the existing Contact.
* A Case should reference the relevant Contact / Customer.
* A Petition should reference the relevant Case and / or Customer.
* Accounting records should reference the relevant Customer rather than creating another customer record.

Do not duplicate entities to satisfy a module-specific requirement.
2.3 Object Relationships
Objects can have relationships with other Objects.
For example:
`Contact → Deal`
`Contact → Case`
`Case → Petition`
`Customer → Payment`
These relationships allow records across different business domains to remain connected.
Do not duplicate a Record simply because another Object needs to reference it.
2.4 Core Rule
When implementing functionality involving an Object, always distinguish between:
Object
→ What type of business entity is this?
Record
→ Which individual entity is this?
Property
→ What information do we store about this Record?
Pipeline
→ What lifecycle does this Record move through?
Pipeline Stage
→ What state is the Record currently in?
Do not combine these concepts unless explicitly required by the product specification.
3. UI Standpoint
3.1 Existing Patterns First
Before creating or changing a UI pattern:

* Check the existing code.
* Check the provided design-system-based Figma designs.
* Check previously implemented product patterns.

If an existing pattern already represents the required behavior, reuse it.
Important
The design system is not the only source of some existing patterns and components.
4. New Patterns or Components
Create a new pattern only when:

* The required functionality does not have an appropriate existing pattern, or
* The requirement explicitly introduces a new pattern.

A new pattern must remain visually and behaviorally consistent with the existing product.
5. Figma Rules
When a Figma file is provided, use it as the primary visual reference.
Use Figma to understand:

* Layout
* Components
* Spacing
* Typography
* Information hierarchy
* Navigation
* Interaction patterns
* States
* Responsive behavior

If an element exists in Figma but not in the codebase, reproduce it rather than substituting a different pattern.
If Figma conflicts with an explicit written requirement, ask which should take precedence.
Do not silently choose.
6. Requirements
Requirements may come from:

* Discovery prompts
* Change / Update prompts
* Claude prompts
* PRDs
* Feature guides
* User stories
* Figma
* Direct instructions from the product designer

Follow explicit requirements.
Do not add functionality that was not requested.
Do not remove functionality that was requested.
Do not redesign a workflow simply because another workflow appears better.
7. Ask Instead of Assuming
If something is unclear and the answer affects product behavior, ask before implementing.
Technical Decisions
You may make reasonable technical decisions when they do not change product behavior.
Examples:

* Component implementation
* Internal naming
* File structure
* State management implementation
* API handling
* Technical abstractions

Product Decisions
Do not make assumptions when multiple reasonable product interpretations exist.
Ask.
8. Data Relationships
Relationships between entities are fundamental to this ERP.
When implementing a feature, identify:

* What entity is being created or modified?
* Who owns it?
* What entity does it belong to?
* What entities reference it?
* What entities does it reference?
* What happens when its state changes?
* What happens when the parent entity changes or is closed?

Do not implement a feature as an isolated screen if it represents a business relationship.
9. Ownership
Every operational record should have clear ownership.
Ownership may belong to:

* A user
* A team
* A department
* A customer
* A case manager
* A sales professional
* Another business entity

Do not assume ownership rules.
If ownership is relevant but unspecified, ask.
Do not use the currently logged-in user as the owner unless the requirement explicitly says so.
10. Status vs Assignment
Do not treat status and ownership as the same concept.
For example:

* Status: What state is the Case in?
* Assignee: Who is responsible for the Case?
* Team: Which team owns the Case?
* Stage: What step of the business process is currently active?

These are different pieces of information.
Do not combine them into a single field unless explicitly required.
11. Historical Data and Auditability
ERP systems frequently need to preserve history.
Do not overwrite information when the business requirement implies that historical information matters.
Examples include:

* Assignment changes
* Status changes
* Payment records
* Case activity
* Petition activity
* Document submissions
* Approval / rejection events

If a requirement involves changing an important business record, consider whether the previous state needs to remain traceable.
If this is unclear and materially affects the product, ask.
12. Documents
Documents are a shared concept across the product.
A document may relate to:

* Contact
* Customer
* Case
* Petition
* Deal
* Employee
* Other business entities

Do not assume that a document belongs exclusively to one module.
When implementing document functionality, identify the entity relationship first.
Do not duplicate the same document simply because it is needed in multiple workflows.
13. Payments and Financial Records
Financial records require stronger data integrity than ordinary UI records.
Do not casually modify or delete:

* Payments
* Ledger entries
* Invoices
* Financial transactions
* Accounting history

If a financial record needs to be corrected, follow the specified business workflow.
If the requirement does not define how a financial correction should work, ask before implementing it.
Never invent accounting behavior.
14. Permissions and Access
Different modules may have different access requirements.
Potential access dimensions include:

* User
* Seats
* Team
* Department
* Role
* Record ownership
* Module
* Action

If a feature involves sensitive or restricted information and permissions are not specified, ask.
Do not create permission behavior based purely on assumptions.
15. Cross-Module Changes
A change in one module may affect another module.
Before modifying shared entities or workflows, check where they are used.
For example:
Changing a Contact model may affect:

* CRM
* Sales
* Cases
* Accounting
* Documents
* Petitions

Do not make a local change to shared data without checking its downstream impact.
16. Do Not Duplicate Business Logic
If a business rule already exists, reuse it.
Do not implement the same rule independently in multiple modules.
For example, if customer eligibility, assignment, or status-transition logic already exists, do not create another implementation with slightly different behavior.
Prefer a single source of truth for shared business rules.
17. Preserve Existing Behavior
Unless explicitly requested, do not change:

* Existing workflows
* Navigation
* Permissions
* Data relationships
* Component behavior
* Existing business rules
* Existing user flows

When a requested change requires modifying existing behavior, change only what is necessary.
18. Scope Control (Very Important)
Implement only the requested scope.
Do not:

* Build speculative features
* Refactor unrelated code
* Redesign unrelated screens
* Replace existing patterns unnecessarily
* Introduce unnecessary abstractions
* Change unrelated business logic
* "Improve" things that were not part of the request

If you identify an improvement outside the requested scope, mention it separately rather than implementing it automatically.
19. Consistency Across the ERP
The product should feel like one system.
When implementing a feature, maintain consistency in:

* Terminology
* Navigation
* Tables
* Forms
* Filters
* Search
* Modals
* Drawers
* Status indicators
* Empty states
* Loading states
* Error states
* Notifications
* Permissions
* Record actions

Do not introduce different terminology or interaction behavior for the same concept in different modules.
For example, if the product calls something a "Case", do not call the same concept an "Application" in another module unless they are actually different entities.
20. Do Not Invent Product Behavior
This is an important rule.
Claude is responsible for implementing the product, not deciding the product.
When the product requirement is explicit, implement it.
When the technical implementation is unclear but product behavior is clear, make the appropriate technical decision.
When the product behavior itself is unclear, ask.
Never silently convert an assumption into a product decision.
21. Decision Priority
When determining how to implement something, use this priority:

1. Explicit product requirement
2. Explicit instruction from the product designer
3. Approved Figma design
4. Existing established product pattern
5. Existing design system
6. Existing architecture and code conventions
7. Reasonable technical implementation
8. Ask the product designer

If two higher-priority sources conflict, do not decide silently. Ask.
22. Stop Conditions
Stop implementation and ask a question when:

* Two requirements conflict.
* Figma and the written requirement conflict.
* An existing pattern and a new requirement conflict.
* An entity relationship is unclear.
* Ownership is unclear.
* Permissions are unclear for sensitive functionality.
* A workflow requires an undefined business rule.
* A destructive financial or business action is undefined.
* Multiple reasonable product behaviors are possible.

A short clarification question is better than implementing the wrong behavior.
23. Prompt Types
There are three types of prompts used when working on this project. Determine the type from explicit labeling first, and from context when not labeled.
23.1 Discovery Prompt
Used when the product designer is exploring, brainstorming, or defining a feature.
The prompt may contain incomplete thoughts, user stories, workflows, product requirements, Figma references, feature guides, or PRDs.
When handling a Discovery Prompt:

* Treat the information as product requirements currently being defined.
* Understand and structure what has been provided.
* Do not invent requirements that were not mentioned.
* Do not make product decisions on the designer's behalf.
* If something is unclear and requires a product decision, ask before implementing.
* Use the existing product architecture, patterns, and this file's rules as context.
* The purpose is to establish the feature clearly before implementation.

23.2 Change / Update Prompt
Used after a feature has already been implemented or designed and a specific change is requested.
When handling a Change / Update Prompt:

* Make only the requested change.
* Keep the scope precise.
* Do not redesign unrelated parts of the feature.
* Do not introduce additional improvements.
* Do not re-endorse or repeat existing design guidelines unless directly relevant to the requested change.
* Preserve the existing implementation and behavior everywhere else.
* If the requested change affects an existing shared component or pattern, update it in a way that preserves the established pattern.
* If the requested change creates ambiguity about product behavior, ask before implementing.

23.3 Claude Prompt
An explicit instruction to perform a specific task, change, implementation, investigation, or workflow. Only treat a prompt as this type when explicitly labeled "Claude Prompt."
When handling a Claude Prompt:

* Treat it as a direct instruction.
* Execute the requested task within the existing product architecture and project rules.
* Do not expand the scope beyond what was asked.
* Check the existing code, Figma references, and established patterns before introducing something new.
* If the instruction requires a product decision that has not been specified, ask instead of assuming.

23.4 Handling Ambiguity
If the prompt type is not explicitly identified, determine it from context:

* Exploring or defining something new → Discovery Prompt.
* Modifying something that already exists → Change / Update Prompt.
* Explicitly labeled "Claude Prompt" → direct implementation instruction.

Do not make product decisions that the product designer has not made. Technical implementation decisions may be made when the intended product behavior is clear. If the intended product behavior is unclear, ask a question before proceeding.

24. Codebase Map (Pulse — HOF ERP prototype)
24.1 How it runs
* Browser prototype: React 18 + Babel Standalone from unpkg, compiled in the browser. No build step, no package.json, no Git.
* `index.html` loads every `.jsx` as a classic `<script type="text/babel">`. Load order matters: files share globals (no imports/exports), so a file can only use what earlier files defined at load time.
* Run: `python3 serve.py 9420`, then open http://localhost:9420 (`.claude/launch.json` → `hof-erp`). `serve.py` disables caching so every reload runs current files, and keeps the saved data in SQLite (`data/hof-erp.sqlite`, git-ignored) through `/api/kv`.
* Sign-in is mocked: any HOF Migration / HOF Global email, no password (workspaces.jsx).
* `_removed/` holds retired code (assessments, profile runner). It is not loaded; do not revive it unless asked.
* Each file starts with a header comment describing its scope and decisions. Read it before editing the file and keep it current.

24.2 State and data
* store.jsx + app.jsx: one Organization (HOF Global) with module branches (instances) — CRM: Migration, Pack, Redberry Consultancy; People: Pakistan, Dubai (ORG_REGISTRY, key `hof-erp-org-v1`: org + its brand, branches — each CRM branch with its own brand, CRM Settings → Brand —, users with Organization role / People branch / CRM branches; managed in ERP Settings → Branches). One CRM store per branch (`hof-erp-crm:<id>`), one employees list per People branch (`hof-erp-people:<id>`), saved as JSON through `DB` (store.jsx): SQLite via serve.py on localhost, localStorage elsewhere (the hosted copy). The open CRM and People branches and the sign-in are per browser (localStorage, `BROWSER_KEY`). Each module's sidebar head reads "← <branch> | <module>" — a switcher — when the person has more than one branch of it, else just "← <module>". Data saved before the Organization (five workspaces + module linkage groups) migrates itself once on load (migrateWorkspacesToOrg). For now everyone is a Super Admin with every instance (`EVERYONE_SUPER_ADMIN`, workspaces.jsx) — and whoever signs in joins each CRM branch as a Super Admin on a Full Seat (usersTeams.jsx `withSessionMember`; a user an administrator has set up keeps their seat and preset) — the product is designed from that view; narrower access comes later. Owners keep slices via persistSlice / usePersistedState. Record IDs come from per-object counters that only increase. The `contacts` object is called Lead / Leads everywhere in the UI since 2026-11-19 (code ids stay `contacts`, `contactId(s)`, `contactType`, `typesOfContact`; saved settings and views take the new names once — dataModel.jsx `withLeadNames`, flag `leadNames`); where this file says Contact(s) about what people see, read Lead(s).
* Owners and other user references are stored as user IDs and resolved through the Users directory.
* businessData.jsx seeds ~1,000 sample contacts → deals → customers once per workspace, following the data model.
* recordHub.jsx (`hub`): the single read/write path for records and their activity across workspace-wide pages (Tools, emails, files, quotes). Deal/Customer activity goes through the workflow engine so workflows see it. On a record's own page (or side panel) that record's name is never a link (`OpenRecordCtx` / `useIsOpenRecord`, read by HubRecordLink and the payment plan's record tag); its linked records stay links.

24.3 Shared foundations (reuse these, do not re-implement)
* shared.jsx — design tokens (`T`), icons, primitives. "Layout Settings" (2026-11-20; it was View Settings) is the name of every view's settings entry — a list's drawer, a record's top bar, the dashboard's — while Card Settings, Side Panel Settings, Table Settings, Highlight Settings and Tab Settings keep their names. Every list's create button is `NewButton` — "+ New <thing>", filled (2026-11-18). Every text click action (record and people names, owners, counts, email and phone, Undo, Add …) uses `LINK_CLASS`: dark text with a dark underline, text and line all blue on hover. Visual source: Figma "HOF CRM Redesign" → Claude Feeder. `Dropdown` is the one select control (no native `<select>`; SearchableSelect and the board's PipelineSelector are it too): closed it looks as before; open, a search box once there are more than 10 options (`searchable` always — record pickers), best matches first, "No matches"; the blue check on the selected one; the first 100 rows, then "1,234 more: type to find them"; `loading`: a spinner for the chevron; opens above when there's no room; ↑ ↓ Enter Esc (2026-11-19, from the dev build). Loading (2026-11-19, shown only where something really loads): `Spinner` (the CircleNotch — StCta / StSecondary `busy`: before the label, disabled), `SkeletonLines` (in place of every "Loading…"/"Opening…": the file viewer), `LoadingBar` and dimmed rows (ContactsDataGrid `loading`; nothing in the prototype waits for it yet); still for reduced-motion users. `useEscapeClose` closes the topmost panel or modal on Escape. Also the time zone: moments show in the person's zone (profile menu, else Settings → Defaults; `zonedParts` / `zonedDate`), calendar days ("YYYY-MM-DD") stay their day (`LOCAL_TZ`).
* propertyTypes.jsx — the single definition of every property type: input, stored value, display, validation (Language holds one or more languages, matched like Multi-Selection). Avatar (2026-11-19) is the name of a Contact, Deal and Customer (Full Name, Deal Name, Customer Name — those only, not offered for new properties): the name and its square photo together — the photo kept on the record (`photo`), uploaded on the create and edit forms (AvatarInput); without one, the name's first letter, white on pinkish red (shared.jsx RecordAvatar) — in the name column (clickable, opens the record) and the record header. In those three tables the email and phone are blue links (underlined on hover): a new email to the record, a call to it (ContactsDataGrid with the schema's `recordObject`; REACH_LINK_CLASS). Also money: the default currency and exchange rates (Settings → Defaults), `toDefaultCurrency` for totals, `moneyText`.
* dataModel.jsx — Objects (Contacts, Deals, Customers), Associations, Properties (Settings → Data Management; the Properties table filters by Source — System or Custom — and Created By, a built-in property's being "System"). Record links: each association's type (One-to-many / Many-to-one / Many-to-many) is editable and the records follow it — stored as lists (a deal's and customer's `contactIds`, a customer's `dealIds`; the first contact is the record's person); `linkRule` / `canLink` / `linkedOf` are the one place the limits are read.
* Record pickers (SearchableSelect with recordHub.jsx `recordOption`) show and match each record's email and phone, not only its name. Person filters (Owner, Assigned To, Note By, Created By …) list the teams above the people — a team means its members (store.jsx `teamFilterOptions`, `expandTeamValues`); an "is any of" filter is a dropdown of ticks with a search (propertyTypes.jsx MultiSelectMenu), never a row of every value.
* contacts.jsx — the record views system (views, Save View, search, Filters, Table Settings, ContactsDataGrid / RecordSchema) used by every list in the app. On Contacts, Deals and Customers each view's name carries how many records it lists, as saved — "All Leads (1,090)" (`viewRowCount`; `viewCounts` on RecordViewsModule). Every table's columns resize by dragging a header's right border; the widths are kept with the view (`columnWidths`). On Contacts, Deals and Customers, Table Settings → Merge Columns (a secondary button, bottom left) puts 2 to 3 properties — dragged into order, any property Table Settings offers — into one named column (`mergedColumns` on the view, `merge:<id>` in the column order): the values one per line, an empty one a dash, every row as tall as the most lines; it moves, freezes and resizes like any column, its header ⋯ has Rename instead of the sorts, an edit icon in Table Settings opens it again and removing it unmerges it; a merged property has no column of its own; Export writes it as one column, the values on separate lines. A Contacts filter on its deals reads the deals as the Deals page shows them; filters saved with older operator ids still apply.
* board.jsx — Board view and pipeline model (`source:'property'` vs `source:'record'`). The leads' pipeline, Type of Lead (2026-11-19; property `contactType`, pipeline id `typesOfContact`): Not Assigned, Assigned, Contacted, Opportunity, Not Responded, Others; a lead without an owner is Not Assigned — giving one an owner moves it to Assigned, removing it moves it back (app.jsx, whoever changes the owner); leads saved in the old stages were spread over the new ones once (`withoutRemovedStage`, saved settings `leadStagesV1`).
* contactDetail.jsx — record shell (side panel ⇄ full screen), reused for Deals and Customers. A record opens straight on its full page from anywhere (no side panel first); the page can be collapsed into the side panel and expanded again; while it's the side panel, another record clicked in the list takes its place there. The email in its header opens a new email to the record in the composer. Since 2026-11-18: each side panel quick action shows its short name beneath the icon (Call, Email, Task, Note, Owner, Lead, Deal; "Create …" only for creating a deal or customer — `quickActionShort`); Smart Summary and the activity dropdowns are off in Side Panel Settings (`quietPanelSettings`, switched off once, can be switched back on); the side panel's header — name, email and phone, quick actions and the Primary (a white button) — is a small dark-mode card — deep blue-black with a faint blue glow and a fine dot grid, everything on it white; or Light — a pale blue-white ground with grey dots and the usual dark text, Side Panel Settings → Card Style, per record type; for now Light only — `HERO_LIGHT_ONLY` hides the choice — that stays at the top while the properties scroll (`PanelHeroCard`, `PanelHeroCtx`); a record's activity (Overview and the activity tabs) is a full-width list, and an activity picked opens in its own side panel with its actions (Edit / Reply and ⋯, or Cancel and Save) at the bottom right (`DetailFooterCtx`). A record's Overview, Calls, Notes, Emails and Meetings tabs show their activity as a time trail (activityCards.jsx `ActivityTrail`; Tasks keeps its Table / Board; an email thread's size beside its row): Upcoming, then each month, newest first; each activity's time and date left of a rail (a hollow dot while still to come), its row as before without the date, and on the right one action (activityCards.jsx `trailAction`, Mohsin's list 2026-11-18) — Email sent: Follow Up (the composer, in its thread); Email received: Reply; Email scheduled: Edit (the composer — `EmailComposer` `edit` — with everything as scheduled, its date and time too: Save Changes keeps it scheduled, Send Now Instead sends it; the same email, not a new one; an email keeps its `content` as written, one from before from its sequence email or template); Email log: none; Call or Call log: Connected → Schedule Meeting, No answer / Left voicemail / Disconnected → Call Again; Meeting: Add Note (opens it with a note started — `DetailIntentCtx`); Workflow: Revert (Workflows · Revert permission, while the run can still be undone); everything else none. The same action is the filled button, last in the activity side panel's footer, beside Edit and ⋯ (`DetailPrimaryCtx`; not while editing); an email there has no Reply of its own under Follow Up, Reply or Edit, and a scheduled one no Forward (Delete Email stays in its ⋯). The record's story on its trail (2026-11-18 — activities.jsx ACTIVITY_TYPES): Form submitted (the form, Meta Lead Ad / Website / Form link, every answer — forms.jsx), <Record> created (by whom, through which form; its detail lists what workflows changed as it was created), Owner assigned (the first owner) / Owner changed, Deal created (on the deal's contacts), Form refill / Duplicate found (with the matches — workflowEngine.jsx), Enrolled in sequence / Exited sequence (by hand, Exit Criteria or a workflow) / Unsubscribed, Meeting rescheduled (Reschedule on a scheduled meeting still to come), Customer Profile created / updated (on the contact and each of its deals and customers — app.jsx), Pipeline changed, Quote viewed (the client's link #q~<branch>~<quote> — quotes.jsx PublicQuotePage, Copy Link, in the sent email — first view) and Quote expired (from 2026-11-18 on), Document viewed (the signing page, first view per signer), Invoice issued, Payment received (every payment; was Marked Paid for One-Time only); logged from now on, no sample history. Above it the Overview has the search in the Activity title's place ("Search Activity"), then one toolbar row: Filters right after the Lead / Deal / Customer Activity pills (`RecordToolbar oneRow`), Add on the right; the other tabs keep their two rows. Highlights collapse and expand from a chevron beside the title, remembered per browser (overviewSettings.jsx). Every list's own search is named for what it searches — Search Leads, Search Calls, Search Activity, Search Permissions … (contacts.jsx `ToolbarSearch`, `recordSearchLabel` from the list's noun) — and while focused shows a dropdown, the field's width, with Ask Spring (Spring's placeholder panel for now); the header's Find or Ask, the global search, is unchanged. Emails (a record's Emails tab and Tools → Emails) are in four tabs: Threads (every sent and received email, one row per conversation), Sent, Received and Scheduled (activityViews.jsx `EMAIL_FOLDER_TABS`, tools.jsx `emailInFolder`; 2026-11-18). The full page's top bar has Layout Settings (overviewSettings.jsx, per record type): Highlight Settings and Tab Settings — the workspace tabs' order and which show (Overview always first); by default Overview, Calls, Notes, Emails, Tasks, Meetings, Customer Profile, Accounting, Quotes, Files, Documents, then the associated records' tabs (2026-11-18; saved Tab Settings took this order once — `withTabOrderV2`). The tab bar shows the tabs that fit and the rest under "<n> More", a dropdown. Its quick actions may have one Primary (Side Panel Settings → Quick Actions): a filled button with icon and name beneath the icons — to start with Create Deal on a contact, Create Customer on a deal, Call on a customer. `ownerDates` reads a record's owner history: Owner Assignment Date, Owner Change Date and Owner Assigned By (a system property on Contacts, Deals and Customers: the person, or the workflow by name, who gave the record its current owner).
* settingsKit.jsx — SettingsModalShell for card/panel/overview settings modals. Their property lists (Card Settings, Side Panel Settings) keep the ticked properties on top, dragged among themselves, and the unticked below a line; ticking one adds it to the end of the ticked (panelSettings.jsx DragCheckList `tickedFirst`, 2026-11-19); Side Panel Settings' properties also have a search and Select All / Deselect All.
* emptyState.jsx (the illustrated EmptyState for every empty list, table, tab and page), richText.jsx, bulkActions.jsx, extendedProps.jsx (Customer Profile, Accounting and Form properties wherever properties are picked — table columns, filters, cards, Highlights; Form Properties: Submission Source and each Marketing form's answers, from the submission that created the record, also in workflow conditions under every trigger).

24.4 Modules
* CRM navigation: nav.jsx (Dashboard — named My Day, with the home icon, for someone whose dashboard is Personal only, who also gets Analytics above Reports: `dashIsHome`, 2026-11-20, shown that way but not saved in the shared navigation; Marketing, Pre-Sales, Sales, Tools, Administrative: Reports, Workflows, Settings; Edit Nav). Brand is a CRM Settings page (Settings → CRM Settings → Brand), not a Marketing item. Its Digital Letterhead has Bank Details under the letterhead's fields (all optional: Account Name, Bank, Account Number, IBAN, SWIFT / BIC, Branch Address). A deal's person — the To of its quote, email and meeting invite — is its first contact with an email address, else the deal's own Email (recordHub.jsx `hubRecordPerson`, 2026-11-19).
* Lost Reason (2026-11-20): when a person moves a deal into a stage whose Stage Type is Lost — dragging it on the Deals board, changing Deal Stage on its side panel, full page, Highlights or Edit form, or Bulk Actions / a stage's ⋯ → Move to Stage (asked once for all) — a "Lost Reason" modal asks for the Lost Reason, a built-in Single Selection deal property (Not Eligible, Too Expensive, Chose Another Consultant, Not Responding, Changed Plans, Other; options editable in Settings → Properties), before the move is saved, and Cancel leaves the deal where it was (board.jsx `withLostReason`); a workflow's Move to Stage doesn't ask, moving out of a Lost stage keeps the reason, and the reason is logged as a Property change.
* Records: contacts.jsx, deals.jsx + dealDetail.jsx, customers.jsx; contactActions.jsx; contactOverview.jsx + overviewSettings.jsx.
* Activity: activities.jsx, activityCards.jsx, activityViews.jsx (on a record the feeds are its journey, Lead → Deal → Customer — RecordJourney, 2026-11-19: each step its label only — no names, dates or stages (the names as the step's tooltip); it starts folded to the record's own step and a text action, "Show Full Journey" (only when the record has related records), which opens every step it has, an × at the right folding it back; under it one row: Search and Filters, then on the right "Go to Deal" / "Go to Lead" (another record's step only) and Add, always there, adding to the open record; an arrow between; the step picked showing its activity in place; a step not reached greyed; a lead's Deal step is all its deals together — "Deals (2)" —, a deal's is the deal alone; on another record's step the activity names and links no record — `OpenRecordCtx` `{all:true}` — and a text action "Go to Deal" / "Go to Lead" (JourneyGoTo, a menu when there are several) sits before Add; the Tools pages keep the pills), noteTools.jsx (dictation, @mentions, the Support Note tag), files.jsx (also the built-in file viewer, FileViewer: PDF via pdf.js, images, .docx via mammoth, loaded from cdnjs when first needed — an attachment clicked in the email template editor or a sequence's Edit Email opens in the Preview pane in the email's place (Close brings the email back), its chip shown as selected; nowhere else yet), emails.jsx (the composer — its editor has Text Size and Text Color, the colours black, grey and the brand's, kept as inline styles in the sent email — and the email formats — Simple Text Body, Default HTML Template, Custom HTML Template — with the sender's signature, Fetch Property, the renderer `emailHtmlOf` and the live preview; templates, sequences and workflow emails all use it), callPanel.jsx (real mic + Web Speech transcription, simulated telephony), tools.jsx (Tools → Calls/Tasks/Emails/Meetings/Notes). Call outcomes include Call back request (2026-11-20; activities.jsx `CALL_BACK_OUTCOME`): the person answered and asked to be called back — a contact, like Connected (`callReached`: Last Contacted, Type of Lead → Contacted); picking it on Log Call, a call log's edit or a workflow's Log Call prompt asks Call Back Date and Call Back Time (both, still to come — activityCards.jsx `CallBackFields`) and makes a Call task "Call back <name>" for the call's point of contact, due then (`callBackTask`; in their tasks and My Day's Follow-ups on the day); the trail's action on that call is Call Again. Log Email (Add Email → Log Email, beside Email, on a record's Emails tab, its Add menu and Tools → Emails) records an email sent or received outside the CRM, as Log Call does a call: Email Type (Sent / Received), Point of Contact (the record owner to start with), Subject, Content; it reads "Email log sent by …", is editable (an email through the CRM stays read-only) and filters as Email or Email Log. Tasks have one fixed pipeline (Not Started, In Progress, On Hold, Overdue, Completed; task pipelines in Settings → Tasks and a task's Pipeline field are hidden for now) and show as a board or a table — the Table / Board switch on Tools → Tasks and a record's Tasks tab (TaskTable). A task card (boards, a record's Tasks tab, the dashboard's My Tasks — tools.jsx TaskCard) shows the name, the description (two lines, then cut off), Due Date and Assigned To, and the rest under Details, an accordion. A task is Not Started (new), In Progress (Start), On Hold (Put on Hold / Resume) or Completed (Complete) — buttons in its detail header and columns on the task board; any open task past its due date is Overdue, automatically. A note keeps its edit history ("Edited by … · View History") and has Replies under it — text and attachments (activityCards.jsx NoteEdited, NoteReplies); a reply can be answered once, its answers indented under it (`parentId`; one level, 2026-11-19). Support Note (2026-11-19): a switch on the note form, off to start with; a support note stays a note (Notes, Overview) with a red Support Note tag, and is listed on the record's Support Notes tab (in More; its Add Support Note starts with the switch on). @ in a note or reply tags a user (noteTools.jsx MentionsHost — any field inside `data-mentions`): on save each newly tagged person gets a bell notification that opens the record and an email (kept as `mentions` on the note or reply); tags show in blue. Dictation (noteTools.jsx DictationHost): every textarea and rich text editor shows a microphone at its bottom right while it's being written in — speech typed in where the cursor is (Web Speech API), until clicked again or the field is left; "voice note" is the same. Meetings are Upcoming, Ongoing (now within its time) or Past. Request Office Meeting (a record's Add Meeting): a colleague, date, time and length; a meeting awaiting their approval, at the office's address (Settings → Meetings → Office Meetings, with who's emailed on approval), with no online link; the colleague approves or declines on the meeting (their bell opens it) — approved: scheduled, the colleague a collaborator on the record, the client sent an invite with the address, the "client is coming" email to the Office Meetings list. A task has Notes under its details, as a call and a meeting do (ActivityNotes; a note linked by `taskId`, shown as "Linked to task" on the Notes tab; deleting the task keeps its notes, unlinked). An email signature is always personal: each person sets their own in Settings → Brand → Email Signature (name, designation, email, phone, website, company address — each contact line with an icon — additional info, and the logo; also their profile photo, a Secondary Language of their choice — none to start with — and then the name, designation, address and additional info in it beside the first (right to left where the language is), a WhatsApp button from a WhatsApp number, and one CTA button — text and link, always black; the two buttons come last, after the additional info; the email, phone and website are links, the address isn't), kept on their user (Redberry Consultancy has a sample signature of its own for now — workspaces.jsx CRM_SIGNATURES — everyone's there until they save theirs); every email they send ends with it, added when the email is shown or sent, so a shared template carries each sender's own. Include Email Signature (on by default) leaves it out on a template, a sequence's email or an email being written. Fetch Property puts a record's value into an email body as a chip (and into a Subject as "{{Lead · Full Name}}" — `SubjectField`, `fillSubjectTokens`) — a Contact, Deal or Customer property, an Accounting property or a Customer Profile property — filled in for the record as the email goes out, blank where it has no value. Activity types include Property change: each property a person or a workflow changes, with its old and new value (owner and stage changes keep their own types; system-set values and a merge's own changes aren't logged).
* Sales: services.jsx (catalog), quotes.jsx (6-step builder — Basics, Services, Payment Plan, Terms & Conditions, E-Signature, Preview; a saved quote template is chosen on Basics; Services step: Choose Service — the saved services as cards in a window — and New Service; the currency is set on the Payment Plan step; a quote template is made and edited in the same six steps, Basics without a recipient or validity; quotes keep their own copy of services; the quotation is on the Brand's Digital Letterhead; signing one makes its Payment Plan on the record; since 2026-11-19 a One-Time payment shows no Payment plan section — only Installments and Recurring —, the Terms & Conditions step has Show bank details (on to start with once the Digital Letterhead has Bank Details, which it shows after the terms; templates never carry it), ⋯ → Download PDF (the quotation exactly as the view, on A4 pages — html2pdf.js from cdnjs) and Send Quote attaches that PDF to its email), documents.jsx (Tools → Documents: a light document editor on the letterhead — rich text, text size, images, Add Record Info, Add Payment Plan (Accounting's plan panel), Add Signature blocks; signing links per signer (#s~…); the quotes' lifecycle; signed by everyone, its payment plans become Payment Plans), accounting.jsx (a record's Payment Plans — any number, none to start with, numbered PP-<year>-<nnnn>, in Active / Paid / Frozen tabs; a record shows its own plans and those of the records above and below it — Contact → Deal → Customer — never a sibling's (`planScopeOf` / `recordPlansOf`), the same plan editable and counted on each, tagged with the record it was added to; Freeze stops invoicing and payments; each edit a revision; marking the payment that settles a plan switches the tab to Paid (2026-11-23); the plan — One-Time, Installment (a deposit, then every 30 days; Edit sets each amount and date, names an installment — the Deposit stays the Deposit — and adds or deletes installments), Recurring (a monthly or yearly subscription, for a number of years or until cancelled) — its fields (PaymentTermsFields) and schedule (planSchedule), shared by quotes and documents; reconciling a payment needs proof), invoices.jsx (one invoice per payment of a plan, issued automatically on its invoice date by InvoiceIssuer, numbered INV-<year>-<nnnn>, never changed once issued — superseded ones archived; Tools → Invoices: Sent / Outstanding / Paid / Archived; the invoice on the letterhead with the PAID stamp).
* Duplicates: merge.jsx (Merge and Duplicate Detection: records of the same type sharing an email or phone form a merge case; one switch per record type, Enable Merge Cases Reporting (Settings → Records; on for Contacts to start with, off for the others), gives the Merge Status property — Unique / Duplicate / Form Refill / Merged — and the Merge Cases button and dropdown beside Workflow Violations (a case opens its review); the merge review side panel — each record's name with First / Second / Third, the oldest record kept with the chosen values and links as their types allow, everything of the others moves to it, they're deleted and a "Records merged" activity keeps the change; every merge kept whole (`mergeHistory`) so Split (a merged record's ⋯ menu) brings the records back and hands out what's new since; Keep Separate; the Merge permission; the workflow rules panel of Merge Record).
* Customer Profile: customerProfile.jsx, profileEngine.jsx (fact library), profileExtractor.jsx (in-browser stand-in for AI extraction).
* My Day: myDay.jsx (2026-11-20) — a Personal dashboard widget, 2 columns wide beside the Time Clock, for one sales professional (rows with avatars and round actions): three tabs with counts. To Contact: their leads not contacted yet (the Last Contacted rule, and no deal or customer) in Spring's order — Spring learns the ideal customer from the leads that became customers (`springProfile`: a country, lead source, job title or industry that converts clearly better than average) and each lead gets one quiet reason ("Strong fit · …", "Good fit · …", "Form incomplete"); leads called twice or more with no answer sit last under "Not answered". Follow-ups: their tasks due today, then overdue ones, then Spring's reminders (contacted, nothing for 3 to 30 days, no open task — Call, Add Task). Contacted: every contacted lead and open deal they own, latest first, a person once (their deal when they have one). Type of Lead follows reach (app.jsx, `leadStageByReach`): a first contact moves a lead from Assigned or Not Responded to Contacted; two unanswered calls with no contact move it from Assigned to Not Responded — for activity from now on. On the dashboard it stands in for My Tasks (`DASH_ALTERNATES`: showing one hides the other; a Personal-only dashboard starts with My Day; Team and Company dashboards keep My Tasks). The sample CRM gets sample leads for it once (`mockMyDayLeads`). Mustafa, the sample Employee, also gets a business of his own once (`mockMustafaBusy`, app.jsx — businessData.jsx `generateBusinessData` with `only`: leads, deals, customers, CCLs, payments and history from the last months, a Cash Received and a Deals Created goal for the month, and his dashboard laid out Time Clock first with My Day beside it), so the Personal dashboard can be reviewed busy. A Personal dashboard's default order: Time Clock, My Day, My Goals, My Velocity, Deal Won, Deal Lost.
* My Day and Analytics (2026-11-20, later the same day): an employee — someone whose dashboard is Personal only (`dashIsHome`) — has two nav items in place of Dashboard / Home. **My Day**, first (nav.jsx `navEntryLabel`; dashboard.jsx `DashboardPage` `part` 'day', myDay.jsx `MyDayPage`, a fixed layout): the greeting and Spring, then the day's numbers — Calls, Connected, Qualified, Quotes Sent, Deals Won (`myDayCounts`; how they read is below) — then the Time Clock, My Day's three tabs, Commission, Meetings Today and Payments Due (the unpaid payments of plans on their own records, due by the end of the week or overdue). **Analytics**, above Reports (`navWithAnalytics`, shown only to them, not in the saved navigation; `part` 'analytics'): every other KPI and widget with its date filter and Layout Settings, and the team's full ranking (Team Key Indicators — `DASH_RANK_SLOT`; rankings are otherwise never Personal). Team Leads and Managers keep Dashboard. Follow-ups also lists Spring's signals, between today's tasks and the overdue ones (`myDayLists`): the client opened the quote (first view, 7 days), a reply after 7 days of silence (3 days), a record passed to me from a colleague (7 days), a quote sent 7 to 30 days ago with nothing since — each until someone is in touch. Spring is mocked (not a model): a row's Brief (the sparkle action — `MyDayBrief`: profile, why today, last activity, form answers, the quote; Draft Email and Call) and Draft Email (`myDayDraft`: the composer opened with a draft from the record's values — `EmailComposer` `draft`). Sample signals, a meeting, daily targets and a commission plan are added once to the sample CRM for Mustafa (`mockMyDaySignals`, `mockActivityGoals`, `mockCommission`).
* My Day, second pass (2026-11-20): **Call Next Lead** on the greeting's right (myDay.jsx `MyDayCallNext`: a flat near-black button with a hairline edge one small light travels round, the call in a white tile, an arrow — the glass version before it read as dated) starts the call to the first lead of To Contact with a phone number. The row of numbers says "3 of 40" and is chosen in My Day's own **Layout Settings** (`MyDaySettingsModal`, kept per person in `overviewSettings.userMyDay`): the five day numbers and any of the person's own KPIs read for today, up to six; and which widgets show, in what order (dragged in the list) — Time Clock, My Day, My Calendar, Commission, No Response, Payments Due, Meetings Today (off to start with). **My Calendar** (`MyDayCalendar`; it was Today for a few hours) is the person's whole day down one rail, in time order with a line for now: what's planned — their meetings and their tasks due today at a time (one still open past its time is red) — and the day's record: clocking in and out and each paid or unpaid break (from the Time Clock), every call they made with its outcome, every email and quote they sent. Between them it shows the free slots (`myDayFree`): gaps of 15 minutes or more with no call (for its length), meeting, break or task (for its Time Allowed) — behind now they're certain and counted inside the working day (clock in to clock out, each time; without the Time Clock, from the day's first activity), with their total in the card's corner ("Free so far · 2 h 10 min"); ahead of now, dashed, only what's free so far, from now to the end of the last thing planned, while the person is at work. The day numbers are related, so each is read out of the one before it, in two groups in one row and always in this order (`MYDAY_GROUPS`, `MYDAY_OUT_OF`; no arrows) — Leads: Calls out of the day's target, Connected out of the calls made, Qualified out of the connected; Deals: Quotes Sent out of the qualified, Deals Won out of the quotes sent. A row of Payments Due opens its record on the Accounting tab (`hub.openRecord(object, id, undefined, 'accounting')`); a lost record's plan isn't listed. A sample day is added once for Mustafa (`mockMyDayTrail`: calls today, two quotes sent, a deal won). **No Response** (`myDayNoResponse`): their leads and open deals whose last exchange was an email the team sent or a call not answered, with nothing back for 2 to 30 days, most recent first — emails and calls only until WhatsApp is connected. My Day's widgets carry a coloured icon mark (dashboard.jsx `DashWidgetCard` `icon`). A record's letter avatar takes one of six colours by its name (shared.jsx `avatarColor`; it was always the pinkish red).
* Time Clock breaks (2026-11-20; app.jsx): Add Break asks Lunch Break (the paid one — it was called Paid Break) or Tea / Bio Break (the unpaid one). Paid: 1 hour a day, taken as 30 Minutes or 1 Hour — two halves or one hour; it stays in the worked time, up to its length. Unpaid: the person says how long (5, 10, 15 or 20 min); 20 minutes a day is the allowance and 30 the cap — past the cap none can start; it is taken off the worked time. A break past its time keeps running, its time in red ("Over by …"); nothing ends by itself (`tcBreakUsage`, `tcBreakOffers`). The work session is in memory only.
* Task time (2026-11-20): a task may have a Time Allowed (`allowedMin`: 15 Minutes to 4 Hours — New Task and its edit, activityCards.jsx `TaskTimeAllowedField`). Its first move to In Progress is kept (`startedAt` — activities.jsx `withTaskStart`, called by the detail's buttons and radios and the board's drag); while In Progress it reads "25 min left" or, in red, "Over time · 10 min" (`taskTimeState`) on its detail and its card. On Hold shows nothing; the clock isn't paused.
* Referrals (2026-11-23): a record can refer another. A Lead's and a Customer's ⋯ menu have Create Referral Lead, a Deal's has Create Referral Deal (contactActions.jsx `StandardRecordMenu` `onCreateReferral`; a menu item only) — the normal create form under that title (contacts.jsx `ReferralLeadForm`, the Deals page's Add Deal form; a referral deal's Associated Lead starts empty — it's for another person). The new record keeps `referredBy:{object, id}` (one referrer; dataModel.jsx `referrerOf` / `referralsOf`): a built-in read-only property Referred By (key `referrer`) on Leads and Deals links to the referrer — side panel and table — and the referrer (Lead, Deal, Customer) has a Referrals tab listing who they referred (contactDetail.jsx `ReferralsTab`). A link to a record that's gone is no link. Referral Discount (quotes.jsx): a quote whose record — or its person lead — is on either side of a referral (recordHub.jsx `hasReferralLink`) offers a second discount under Discount on the Payment Plan step, the same control (% or amount), kept as `referralDiscount`; both are worked out on the services subtotal and taken off before VAT, together never more than the subtotal; the quotation shows "Referral Discount" under Discount when above zero and the Payment Plan is made from the lowered total. A template never carries one. Merge, split and delete don't re-point `referredBy`.
* User off-boarding (2026-11-23; usersTeams.jsx): a user hands over what they hold before they're deactivated. Deactivate User (row and Bulk Actions) lists it — their Leads, Deals and Customers, open tasks, upcoming meetings, scheduled emails — and asks Hand Over To (one activated user, not one being deactivated); the button waits for a choice; someone holding nothing gets the plain confirmation. `handOverWork(hub, users, to)` moves it: each record a recorded owner change, each task a "Task reassigned" entry, a scheduled email's signature becomes the new sender's; past activity keeps their name. Delete User uses the same hand-over. Reactivating brings nothing back.
* Qualified (2026-11-20): two call outcomes beside Connected — "Connected, qualified" and "Connected, not qualified" (activities.jsx `CALL_QUALIFIED_OUTCOME`, `CALL_NOT_QUALIFIED_OUTCOME`; both a contact). Not qualified asks a Not Qualified Reason — on Log Call, a call log's edit and a workflow's Log Call prompt (activityCards.jsx `NotQualifiedReasonField`) — a built-in Single Selection lead property (Age, Budget, Education, Nationality, Not Interested, Already Applied Elsewhere; editable in Settings → Properties), kept on the call and set on the lead (a deal's or customer's first lead — `setLeadNotQualified`), logged as a Property change; its trail has no action. The in-app call panel asks no outcome (its calls are Connected).
* Commission (2026-11-20): commission.jsx — Settings → Commission (the Goals permission), one plan per CRM branch: slabs by monthly cash received, each a percentage; a person earns the reached slab's % on all the cash received that month on the records they own (`commissionFor`, `userCommission`, read from the same cash figure as the Cash Received goal — `userMonthCash`). Shown on My Day with the distance to the next slab.
* Reports: reports.jsx (2026-11-20). Reports opens on a landing page — "Ask Spring to generate reports" (the dashboard's Ask Spring box; a request opens the existing report closest to its words, `reportForRequest`, or says none was found) and, under it, See Existing Reports: a window with a search and every report by group (Leads, Deals, Activities, then Shared with Me). No side menu. A report (`REPORTS`, run by `runReport` from the records and activities the viewer may see): its headline figure, a chart and a grouped table, with search and filters suited to its records and Day / Week / Month on time reports; a row's name opens the records behind its number, a record's name opens it. Its title row has a back arrow to the landing page and Open Report (the same window); its actions are Download PDF, Export CSV, Send (to any addresses, CSV and / or PDF — `reportSends`) and Share (users and teams — AssignPeopleModal; shown under their Shared with Me, told in their bell — `reportShares`). The email composer's attachments offer Attach Report. Definitions: Lead Conversion Rate = leads that became a customer ÷ leads created; Win / Loss Rate = Won (or Lost) ÷ Won + Lost; Activity Completion Rate = tasks completed ÷ tasks due, per rep; "without recent activity" = none for 30 days or more; emails: sent only (opens and clicks aren't tracked); Deals Created vs Goal reads the Deals Created goal for the goal period now running.
* Automation: workflows.jsx (builder: context, triggers, actions; a workflow starts on All Records; no explanatory copy in its panels), workflowEngine.jsx (triggers, conditions, actions, execution; the Accounting properties workflows, filters and columns read — amounts, counts, dates and statuses by payment; Record Is Duplicated → Merge Record; Assign Record Owner under Track Violations proposes owners, all in one Owner Assignments card to approve; on a record's side panel and full page: its required actions as red pills that do them, and each automation as one line with Revert — the Workflows · Revert permission — kept until reverted or hidden), workflowsPage.jsx (since 2026-11-24 the Workflows page opens on Spring, as Reports does — `WorkflowsHome`: "Ask Spring to create a workflow", Create Workflow Manually (the builder) and All Workflows (the list); the list's New Workflow brings Spring back; a workflow made by hand lands on the list when the builder closes; a Spring request opens Spring full screen; the two buttons sit under the box from its left edge), pipelinePanel.jsx.
* Marketing: forms.jsx. Settings: settings.jsx, usersTeams.jsx (users, seats, teams, permission presets; New User sends an invite — the user is Pending (the Pending Invites view, Resend Invite / Cancel Invite) until their first sign-in activates them; a record's collaborators (an approved office meeting's colleague) view and edit it like its owner, not delete or reassign (`permissionCovers` with the action); Edit Permissions is also a text action beside each user's ⋯ menu, in a wider Actions column (a list's schema may set `actionsWidth`); permission categories include Dashboard — which KPIs and widgets a person may have at the Personal / Team / Company level; the Sales Professional preset sees every record and works their own, the Team Lead sees every record and works Their Team's and gives their team its permissions; no one edits their own permissions (a Super Admin may) or gives more than they hold (`permissionsWithin`); AssignPeopleModal — the one pattern for giving something to people: teams, whose members can be unticked, and single users), goals.jsx (three goals, switched by a tab strip on Settings → Goals; the third, Daily Activity (2026-11-20): a per-day target for Calls (it had five; the day's other numbers are read out of the step before them, so they have none) — `goals.activity`, `activityGoalTarget`; one person's day at every level, not divided: a user reads their own, else their team's, else the company's — two goals since 2026-11-20 — Cash Received and Deals Created, a count of deals stored in `goals.deals` and read by Reports through `dealsGoalTargets` / `dealsGoalTarget`; the same company → teams → users targets, periods and inheritance; the dashboard and profile goal stay Cash Received — Cash Received targets: company → teams → users, with the dashboard's Target KPI and Goals widget — the company's, a team's or the person's own, by the dashboard's level), templates.jsx, playbooks.jsx, cardSettings.jsx, panelSettings.jsx. Settings → Templates holds Email Templates and Quote Templates; Email Sequences, Playbooks and Services are Settings pages of their own (2026-11-18, the same TemplatesSettings with `only`). importExport.jsx — Settings → Import & Export: Import (CSV → Contacts / Deals / Customers, columns matched to properties, rows whose email or phone is already there skipped), Export (a record type, chosen properties), History (every import and export, a table's Export too — `useRecordExportLog`); an export over 50,000 contacts, 10,000 deals or 1,000 customers emails every Super Admin and notifies them in the bell. templates.jsx in detail: Email Templates list Template Name, Subject, Used By, Created By; on every Templates tab (Email Templates, Email Sequences, Quote Templates, Playbooks, Services) an item's name opens its editor — the full panel where it's edited and seen together — and View stays in its menu; a quote template opens in the quote builder's steps; an email template is assigned to teams and users (Assign Template, offered as it's created) — the assigned people and its creator may pick it when writing an email, one assigned to no one is everyone's; Email Sequences list Enrolled (the records with emails still scheduled, a bar of how many sent, View and Exit; View opens that record's enrollment — the emails sent, a line, the ones still scheduled, which can be edited or removed for that record only, and Exit Sequence); a sequence's name opens its editor, the wide email panel — each email has its template, Edit Email (an icon button; the sequence's own copy; the template is untouched) and When: After Days (days, weeks or months after the email before) or Specific Date (a record enrolled after that date isn't sent that email); Clone Sequence copies one; a sequence's Settings: Skip Weekends (an email due on a Saturday or Sunday goes on the Monday, the ones after counting from there; not available while an email goes on a Specific Date), Include Unsubscribe Button (an Unsubscribe link at the bottom of each email; clicking it takes the record out of every sequence — its scheduled sequence emails are cancelled), Exit Criteria (unticked: never stops; ticked: Call Happened, Email Received and/or Meeting Booked on the record end its enrollment — workflowEngine.jsx exitSequencesOn); each email's Time: Any Time or a 1- or 2-hour window from a start time; a quote template opens as the quotation it makes, on the letterhead, with sample details; five sample email templates and sequences, with sample enrollments, are added once to the sample CRM. The sequence panels share one pattern (templates.jsx SequenceColumns): left to right — an instance's enrolled records in their own column with a search; the emails, each with icon-only View Email, Edit Email and Remove Email; the preview, a column that opens only on View Email; the footer Cancel, Exit Sequence, Save Changes on the right; the title is the sequence's name. Sequence Control (Settings → CRM Settings; templates.jsx) lists the sequences that are running, not the templates: one row per running instance — the records enrolled in a sequence on the same day with the same emails on the same dates — with how many are enrolled and a progress bar; its view shows the instance's emails (sent, a line, scheduled: edited for everyone — written again for each record — or removed) and the enrolled records with a search (View one record's own enrollment, Exit one), and Exit Sequence for everyone.
* Shell: app.jsx (header — in the sample CRM, a Persona Switcher beside Spring, for testing only: it signs in as Waleed the Manager, Ali the Team Lead or Mustafa the Employee, each with their own seat and Permission Preset (usersTeams.jsx PERSONAS) — main screen, store, the People module shell), workspaces.jsx (sign-in, the Organization's users and access, CRM / People switchers, ERP Settings — Organization, Users, Branches — and Brand), nav.jsx (CRM and People sidebars; the People navigation is a placeholder — pages not defined), dashboard.jsx (every KPI and widget is a figure at a level — Personal: the person's own records, Team: their team's, Company: every record — given by the Dashboard permissions and named for its level in full words, no tag: the plain name for every record's, ending in Team for a team's (Team Goals, Team Key Indicators), starting with My for the person's own (My Goals, My Tasks, My Velocity); each person sets their own dashboard in Layout Settings from what their permissions give them; every list widget (Goals, Deal Won, Deal Lost, My Tasks, Key Indicator User) shows ten at a time — a longer list gets a search above it and the tables' pager beneath (`useDashList`); Key Indicator User is a team's or the company's ranking, never Personal; tasks are the person's own only; the Time Clock is also a Personal widget, sharing the header's work session), logos.jsx, moduleIcons.jsx.
* Notification Presets (2026-11-23): notifications.jsx — admins define presets that decide which notifications a user gets, on which channels, and what the user may change; a user is on one preset (`notifPresetId`; none: the default) and keeps only their own changes (`notifOverrides`) — a preset is never copied into the user (unlike a permission preset), and what applies is worked out as a notification is sent (`notifEffective`: a locked cell is the preset's, else the user's choice, else the preset's), so a preset edited or a cell locked later applies to everyone on it at once. The grid is the permission matrix's two panes: the record types (Leads, Deals, Customers) and Direct at the left; tabs Personal / Team / All Users (none for Direct); rows the events — **one list, the same on every record type** (`NOTIF_GROUPS`: Record, Activity, Sales, Accounting, Sequences; Direct: tagged in a note, task assigned to you, office meeting request / answer, report shared, large export); columns In-App, Push, Email; a cell a tick and a lock. Kept in `data.notificationPresets` (cells by `<scope>.<record type>.<event>`; one not kept is off and unlocked). Users & Teams → Notification Presets (New, Edit, Duplicate, Set as Default, Delete — asks Move Users To; never the default), a Notification Preset column and text action on the Users table, the person's own grid in Settings → Notifications (a locked cell greyed, with its lock). Seeded: Salesperson (the default), Team Lead, Accounting person, Super Admin; a CRM's users take theirs once from their Permission Preset (`withNotificationPresets`). Permissions (Settings & Administration → Notifications): Manage notification presets, Assign notification presets (Their Team Users / All Users), Edit own notification settings. Delivery (`NotificationHost`, mounted beside InvoiceIssuer): it watches the records' activity and the records — every notable thing is already an activity with who did it — and turns what's new into notifications (`notifFound` → `notifDeliver`): never about a record (or a note, invoice, plan …) the person may not view (usersTeams.jsx `accessAs` — the Permission Presets' own checks, asked for that user), never to whoever did it, the closest scope decides (owner → Personal, the owner's team → Team, else All Users), an owner change is one notification (Assigned beside the new owner, else Owner changed beside the previous one), a bulk action or several properties in one save is one notification. Direct ones go through the engine's `notifyUsers(…, event)`; a workflow's Notify and violations stay outside the presets. The bell (workflowEngine.jsx `WorkflowBell`) is the notification centre: unread until clicked, Mark All as Read, Notification Settings; a notification opens its panel (`NotificationPanel`) — the sentence, then the push (a title and one line) and the HTML email (the Default HTML Template on the brand) for the channels it went out on; push and email aren't really delivered. Actions: Open <Record>, Reassign (Assign Owner), Undo — owner, stage, property (`raw` on the Property change activity) and merge (Split), for 24 hours, only for someone who may make that change and only while the value is still what the notification says (else "Changed since"); not on Deleted or activity; what an Undo causes carries no Undo. The sample CRM gets a few sample notifications once, for Mustafa, Ali and Waleed (`mockNotifications`, `sampleNotifications` — about Mustafa's own records, worded as the real ones, no Undo).
* The sale moment (2026-11-23; notifications.jsx `SaleMoment`): a special notification outside the presets. When the first payment on a record is recorded — any amount, in full or in part; first: no payment before it on any plan the record shows (`saleIsFirstPayment`, the record's own plans and those above and below it) — everyone who isn't on a call (the call window open — `hub.onCall`) or in a meeting of theirs going on now sees one full white screen for 5 seconds (it was 3): a hand-drawn bell rings with its sound (Web Audio, no file), "<the record's owner> made a sale" (no owner: whoever recorded the payment), then a hand-drawn person dances, quick and funny (five poses flipped like a flip book, a handstand among them), and it's gone. A click or Escape ends it early; with reduced motion it's the still bell and the name. In the prototype only the session where the payment is recorded sees it.
* Owner handover (2026-11-23): a record that has an owner goes to someone else only once they accept. A person's owner change — Edit Owner (the button reads Hand Over, with an optional Handover Note), an edit form, a bulk change — is held by the engine's one change path (workflowEngine.jsx `setDealsTracked`: the record stays with its owner) and kept as a handover (engine state `handovers`: record, from, to, by, note, pending / accepted / declined / cancelled). Not held: a record with no owner yet, someone making themself the owner, a workflow's change, a merge, and a change let straight through for one record and owner (`allowDirectOwner` — accepting a handover, a leaving user's hand-over, an Undo). The new owner finds it in their bell (always in-app; not a preset's); it opens `HandoverPanel` (notifications.jsx): record, from, handed over by, the Handover Note (also kept on the record as a note), then the record's whole activity (ActivityTrail). Accept Handover comes on once they've scrolled to the end; Decline asks a reason; whoever handed it over and the owner it was with hear the answer in their bell (`api.answerHandover`). An accepted one is kept in the record's history as an owner change made by whoever handed it over. While pending the record's owner row reads "Handover to <name> pending", and Edit Owner offers Cancel Handover; another handover of the same record replaces it; one whose record changed owner meanwhile is no longer open.
* Tagged Notes (2026-11-23; myDay.jsx `myTaggedNotes`, `MyDayTaggedNotes`): a My Day widget, hidden to start with, listing the notes and replies that tag the person and that they haven't opened yet (`openedAt` on their mention); opening one (the record, on its Notes) takes it off. It shows itself while there's something in it; hidden in Layout Settings (`hiddenAt`) it stays away until someone tags them again.
* User off-boarding, hand-over options (2026-11-23, later): Deactivate / Delete User ask how the work is handed over — Assign to a Person, Within a Team (the team's activated members in turn) or Round-Robin (the users picked, in turn): the workflow's own assign methods (usersTeams.jsx `HandOverFields`, `handOverPool`). The records are dealt out in turn and go straight to their new owners (no handover to accept — the leaver can't wait); each open task, upcoming meeting and scheduled email goes with the record it's on, or, on a record the leaver didn't own, to that record's owner.
* Tools pages in the record's format (2026-11-23): Tools → Calls, Emails, Meetings and Notes (tools.jsx `ListToolPage`) are the time trail a record's tabs use (`ActivityTrail`, with `contactOf` — each row's own record), full width — the list-beside-detail split is gone; nothing is open until an activity is picked, and it opens in its own side panel with its actions at the bottom right; each row keeps its one action at the right, done on the record the activity is on (Schedule Meeting starts on that record). Tasks keep their board / table. A note's row has a Reply icon at its right (`trailAction` → `replyNote`, `TRAIL_ACTION_ICON`), on records and on Tools → Notes: it opens the note with the reply box open (`DetailIntentCtx` 'reply'), and Reply is the note panel's filled button. Task Type has a fourth value, Colleague — a task given to a colleague (`TASK_TYPES`).
* Smart Summary on the Overview (2026-11-23; overviewSettings.jsx `RecordSmartSummary`, `smartSummaryOf`): it left the side panel (no longer a Side Panel Settings section) and sits on a record's Overview under Highlights, switched off in Layout Settings → Smart Summary (per record type; on to start with). In the product it is written entirely by AI — here a stand-in reads the record and its activity. The title "Smart Summary" (no accordion on it), at its right "Refreshed 2 minutes ago" and a refresh icon button; the summary in a sentence or two, always shown; under it Insights — the Insight Type / Insight Detail / Source table — an accordion, closed to start with (per browser). Insights are what is known about the person but is no CRM property — said in a note, an email or on a call, unstructured — given a structure by AI (a type and a detail), so no row repeats a record property; every Insight Detail is a link that opens the activity it comes from in the Overview's side panel (`openActivityFromInsight` → ActivityTab's `hof-open-activity` listener). On a record's Emails and Meetings tabs the folder / time level (Threads / Sent / Received / Scheduled; Upcoming / Ongoing / Past) is the record's secondary tabs: filled pills in the toolbar row (as Accounting's Active / Paid / Frozen), not a second strip of underlined tabs; the Tools pages keep theirs as their first-level tabs.
* Later on 2026-11-23: a Smart Summary insight's detail scrolls the Overview's activity to its row and lights it for a moment (`data-act-id`; an activity the list isn't showing opens in its side panel instead). Tools → Calls, Emails, Meetings and Notes: the record types (All / Lead / Deal / Customer) are the page's main underlined tabs, first; Emails' folders and Meetings' times are filled pills under them. On a record's tabs: search, Filters and Add in one row, the tab's secondary tabs (filled pills — activityViews.jsx `SecondaryPills`) on a second row. A record's Calls tab has All Calls and Call Reviews; an employee's Analytics has All Analytics and Call Performance (dashboard.jsx `AnalyticsPage`) — Call Reviews and Call Performance are Spring AI's, a placeholder for the dev team (emptyState.jsx `SpringPlaceholder`: "This feature is defined by Spring AI. The dev team will define it."). The bell's rows (notifications.jsx `NotificationRow`, `NOTIF_MARKS`): a coloured icon mark by what the notification is about (owner, handover and its answer, stage, record changes, calls, emails, meetings, tasks, notes, quotes and documents, money, reports), one line saying what happened, then the time and its actions on one line — the record isn't named twice; a handover still open offers Review Handover. The sample CRM gets two sample handovers for Mustafa once (`mockHandovers`, `sampleHandovers`, engine `api.addHandovers`). My Day's numbers each carry a coloured icon mark beside their label (myDay.jsx `MYDAY_METRIC_MARKS`: Calls blue, Connected teal, Qualified violet, Quotes Sent orange, Deals Won green; a KPI of the person's own, the grey gauge), and the Calls bar takes its colour.
* Stakeholder update (2026-11-23, evening; it replaces what the paragraphs above say on these points). **Trail actions, on a record's pages only** (activityCards.jsx `trailAction(a, env)`, `trailLatest`): a call — the record's latest call only, when not answered (No answer, Left voicemail, Disconnected, Call back request) → Call Again; connected → none. Email — the record's latest sent one only → Follow Up, its latest received one only → Reply (a scheduled one keeps Edit, a log none). Note by someone else → Reply (the icon); one's own → none. Open task: Email → Send Email (the composer, to the record), Call → Call, To-do (also overdue) → Mark as Complete, Colleague follow-up → Remind a Colleague — a bell notification to its assignee (`remindColleague`, kind `taskReminder`, always in-app; the assignee themself gets Mark as Complete). Meeting that has happened → View Details. Workflow → Revert. The activity panel's filled button is `detailAction`: the row's action, else what the panel had before (Follow Up / Reply on any email, Schedule Meeting on a connected call, Add Note on a meeting, Reply on a note). **Tools → Calls, Emails, Meetings, Notes** (tools.jsx `ListToolPage`): the page's whole width — the trail on the left without row actions (`ActivityTrail actions={false}`), the picked activity's details on the right, the first one to start with; Tasks keep their board / table. **Tasks**: Task Type is To-do, Email, Call, Colleague follow-up (`TASK_TYPES`, radios on the forms — `TaskTypeRadios`; "Colleague" as saved earlier reads as Colleague follow-up — `taskTypeOf`), shown as a tag on every task (`TaskTypeTag`: the trail row, the card's first row, the table, first in the task's details); New Task has no Status (Not Started; Status is in Edit and by dragging on the board); Due Date is required, Due Time optional; an open task past its due date says "Due date passed" (`TaskDueTag`) and stays under Overdue until completed. **Required fields**: every create and edit form marks its required fields with a red asterisk (shared.jsx `Req`; `Field required`, `StField required`, workflows.jsx `cfgField(label, control, required)`, accounting.jsx `F(…, req)`) and its save button waits for them; a choice that always holds a value is marked too, toggles and checkboxes never; a detail edited in place shows the marks only while editing; record forms keep following each property's Mandatory setting (built in: Leads — Full Name, Lead Owner; Deals — Deal Name, Pipeline, Stage, Owner; Customers the same). **Smart Summary**: a soft light-blue card with a sparkle before its title. **Forms → Share**: the share icon copies the link and opens Share Form (forms.jsx `FormShareModal`): "Link copied", the link with Copy Link, and Send To (an email address; Send — nothing is really sent). **Sale**: the screen reads "Sale made by <name>" with orange as its accent (the name, the bell's ringing marks, faint orange doodles — `SaleDoodles`); every activated user gets "<name> made a sale" in the bell (kind `sale`), and the bell sits on the Time Clock's orange until its panel is opened (`saleSeen`). The trigger is unchanged: the first payment on a record. Since 2026-11-24 the faint orange doodles are gone (too much), and the bell's three strikes are replaced by five seconds of an original beat made in the browser (notifications.jsx `saleBeatSound`) — Mohsin asked for an Eminem rap; a copyrighted recording can't be used, he chose the original beat. He then tried his own clip and chose to keep the browser's beat (`saleMusic` plays `saleBeatSound` and stops it when the screen closes); of ten made for him he chose No. 3, "Trap Hype", then No. 2, "Victory Horns" (a brass fanfare in C over a 92 BPM hip-hop beat — kick, claps, hi-hats, bass; fades out at 5 s), which is the sound now.
* Note types and Spring on notes (2026-11-23, late; it replaces Support Notes as described above). A note has a **Note Type** — General (to start with), Client Request or Support — asked first on the note form as radios (`NoteTypeRadios`, also in a note's Edit); the Support Note switch and the record's Support Notes tab are gone. Saved as `noteType` (activities.jsx `NOTE_TYPES`, `noteTypeOf` — a note saved with the old switch reads Support; `support` is still written beside it). A Client Request (blue) and a Support note (red) carry their tag wherever the note shows (noteTools.jsx `NoteTypeTag`); General has none. A record's Notes tab and Tools → Notes have filled pills: All, Client Request, Support, General (`NOTE_TYPE_TABS`; on Tools → Notes the record types are the main tabs). **Spring on notes** (noteTools.jsx; Mohsin calls AI features "Spring features"): each note has a tick and the list a Select All (`NoteSelectBar`; `ActivityTrail pick`); once one is ticked, **Ask Spring** appears. It opens the Ask Spring panel (`SpringNotesPanel`) for the ticked notes: Spring reads for a moment (its mark beats, the lines shimmer in its orange), then a Summary, Suggested Actions (Add Task, Call, Schedule Meeting, Draft Email — each opens the usual form on the note's record, filled in) and, at the bottom, three ready questions and a field to ask one's own; every line names the note it comes from (it scrolls to it). General and Client Request notes only — a Support note has no tick. Spring is mocked (`springNotesReview`, `springNotesAnswer` read the notes' words); the stakeholder's reference (a Claude design, "Notes (all notes + AI assistant)") is the idea, not the layout. **Spring's look** (shared.jsx `SPRING`, `SpringMark`, `SpringButton`): a Spring feature sits on a slight orange ground with the Spring logo — the Smart Summary card (it was light blue with a sparkle for a few hours), Ask Spring on notes and its panel, My Day's Brief (its round action — `MyDayAction spring` — and the person's card at the top of the panel), the list searches' Ask Spring row (contacts.jsx `ToolbarSearch`) and the Spring placeholders (emptyState.jsx `SpringPlaceholder`: Call Reviews, Call Performance). The dashboard's and Reports' Ask Spring box keeps its white ground with the logo. A record tab's secondary filled tabs (`SecondaryPills`) sit 12px under the toolbar's line. The dashboard's icons carry no colour (Mohsin 2026-11-23, later): My Day's number marks and every widget's mark are black on a quiet grey ground (dashboard.jsx `DashWidgetCard`, myDay.jsx `MyDayCounts` — a mark's `color` isn't read), and the Calls bar is black. The Smart Summary card is white with a hairline border and keeps the Spring logo (no orange ground there). A fourth note type, **HubSpot** (hard-coded for now, `imported` in `NOTE_TYPES`): a note that came from HubSpot — never offered on the note form or in a note's Edit, it carries HubSpot's mark (shared.jsx `HubSpotMark`) on its tag and on its filled tab, which comes right after All (All, HubSpot, Client Request, Support, General); no note carries it yet. The My Day widget's own mark is the home icon, as My Day in the nav (it was a sparkle, which reads as AI), and its header has no Spring logo — each row's Brief carries it (Mohsin 2026-11-23).
* Tools pages' head (2026-11-23, late; tools.jsx): on Calls, Tasks, Emails, Meetings and Notes the record types (All / Lead / Deal / Customer) are the main underlined tabs with "+ New …" at their right (`PrimaryTabs right`). Whose activities is a switch, not a dropdown (`VisibilitySelector`: My Calls, My Team, Specific User, All Calls; Specific User adds its own dropdown beside it — `PeoplePicker`); what the person's Tools permissions cover decides the options — every record's: all four; their team's: My Calls and My Team; their own only: no switch. Calls and Tasks: one row under the tabs — search and Filters, the switch at the right (Tasks: Table / Board before it). Emails, Meetings and Notes: three rows — the tabs; their filled pills (folders, times, note types) with the switch at the right; then search and Filters. The Sales Professional preset views its activity tools — Call Logs, Meetings, Notes, Tasks — on Their Team's records only (Mohsin 2026-11-23, "Change the preset": usersTeams.jsx `salesProfessionalMatrix`, `TEAM_VIEW_TOOLS`; the saved preset and everyone on it took it once — `withTeamViewTools`, flag `salesProTools`), so an employee's switch is My and My Team, and another team's record shows them none of these activities; they still see every record. Emails have no tool permission: on the Emails page their switch goes no wider than the person's other activity tools (`visibilityScope`).
* Spring full screen (2026-11-24; spring.jsx): the Spring prompt boxes (dashboard.jsx `SpringAsk` — the dashboard's and Workflows'; Reports' too) have three controls, Attach, Voice and Send (`SpringControls`; Auto and / are gone everywhere, the ERP home box too). Sending from the dashboard or Workflows opens Spring full screen over the CRM's content (the navigation and header stay — `SpringHost`, `openSpring(text, files)`): on the left New Chat (a text button, no "Spring" title above it, a line under it) with a collapse button beside it — collapsed, the list is hidden and an expand button sits left of the chat's name in the header — and the person's chats as a chat app's sidebar — titles only, no times; Pinned on top, then the rest newest first, Archived folded at the bottom; each with a ⋯ menu on hover: Pin / Unpin, Rename (a modal), Archive / Unarchive, Delete (asked first) — titled by the first message until renamed, the conversation in the middle (the person's messages on the right, Spring's on the left with its mark, a short thinking moment, the composer at the bottom), Exit Spring at the top right; Escape or picking another page leaves it too. Chats are kept per person in the branch's settings data (`springChats`); attachments keep their names and sizes only; Voice types what's said (Web Speech API). While Spring is open the CRM navigation folds to its icons and comes back as it was on leaving (nav.jsx listens to `hof-spring`). Spring is mocked: its answers are a few words and the CRM's own pieces read live from the records (`SpringBlock`: a workflow as the builder's cards, tables in the CRM's style — leads by source, leads not contacted, deals, tasks —, the dashboard's KPI tiles for win / loss, a deal's side-panel rows, an email draft that opens in the composer); `springReply` picks one from the request's words. The sample CRM gives each person seven sample chats once (`sampleSpringChats`, `springSampled`), the workflow one pinned. Reports' box still opens the closest report.
* Ads (2026-11-24; ads.jsx — Settings → CRM Settings → Ads): lead ads are connected here, not on Marketing forms (forms.jsx keeps its link and the Website RFQ; Meta is no longer a form connection — a form connected before keeps its submissions). One row of navigation (2026-11-24, later): the tabs, and at its right "+ Connect Account", a menu of ad platforms — Meta (its blue mark), Google Ads greyed (not yet); under it one row, search and Filters (RecordViewsModule `searchOnly`: no view pills). Three tabs, as Meta has them: Accounts (Account Name, Platform, Ad Account ID, Pages, Forms, Connected By / On; Connect Account asks the name and Ad Account ID — no real Meta sign-in; Disconnect Account, asked first, removes its pages and forms, leads stay), Pages (each of one account), Forms (each of one page: Creates, Questions, Matched, Status Matched / Needs Matching, Leads). An account's or page's name opens the next tab narrowed to it (a chip, × clears it). A form's name opens Match Properties, a side panel: Creates — Lead, Deal or Customer (Mohsin: any object, not just leads) — then each form question beside a property of that record it fills (only the properties its answer can go into; one per question; the record's name must be matched to Save). Kept in settings data `metaAds`; the sample CRM gets three accounts, five pages and four forms once (`withSampleMetaAds`).
* Not built yet: Case Management, Petition Studio, HRMS.

24.5 Reference files (docs/)
* docs/hof-pulse-design-system.html — HOF Pulse design system (open in a browser).
* docs/figma/ — HOF CRM Redesign.fig (the Figma source referenced throughout the code: "Claude Feeder" section) and HOF CRM.fig. Open in Figma; Claude cannot read .fig files directly.
* docs/brand/ — Pulse and HOF logos. docs/module-icons-source/ — original Streamline Freehand module icon artwork (the in-app copies live in assets/module-icons/).
