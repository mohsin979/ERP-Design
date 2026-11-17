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
* store.jsx + app.jsx: one Organization (HOF Global) with module branches (instances) — CRM: Migration, Pack, Redberry Consultancy; People: Pakistan, Dubai (ORG_REGISTRY, key `hof-erp-org-v1`: org + its brand, branches — each CRM branch with its own brand, CRM Settings → Brand —, users with Organization role / People branch / CRM branches; managed in ERP Settings → Branches). One CRM store per branch (`hof-erp-crm:<id>`), one employees list per People branch (`hof-erp-people:<id>`), saved as JSON through `DB` (store.jsx): SQLite via serve.py on localhost, localStorage elsewhere (the hosted copy). The open CRM and People branches and the sign-in are per browser (localStorage, `BROWSER_KEY`). Each module's sidebar head reads "← <branch> | <module>" — a switcher — when the person has more than one branch of it, else just "← <module>". Data saved before the Organization (five workspaces + module linkage groups) migrates itself once on load (migrateWorkspacesToOrg). For now everyone is a Super Admin with every instance (`EVERYONE_SUPER_ADMIN`, workspaces.jsx) — and whoever signs in joins each CRM branch as a Super Admin on a Full Seat (usersTeams.jsx `withSessionMember`; a user an administrator has set up keeps their seat and preset) — the product is designed from that view; narrower access comes later. Owners keep slices via persistSlice / usePersistedState. Record IDs come from per-object counters that only increase.
* Owners and other user references are stored as user IDs and resolved through the Users directory.
* businessData.jsx seeds ~1,000 sample contacts → deals → customers once per workspace, following the data model.
* recordHub.jsx (`hub`): the single read/write path for records and their activity across workspace-wide pages (Tools, emails, files, quotes). Deal/Customer activity goes through the workflow engine so workflows see it.

24.3 Shared foundations (reuse these, do not re-implement)
* shared.jsx — design tokens (`T`), icons, primitives. Every text click action (record and people names, owners, counts, email and phone, Undo, Add …) uses `LINK_CLASS`: dark text with a dark underline, text and line all blue on hover. Visual source: Figma "HOF CRM Redesign" → Claude Feeder. `Dropdown` is the one select control (no native `<select>`); `useEscapeClose` closes the topmost panel or modal on Escape. Also the time zone: moments show in the person's zone (profile menu, else Settings → Defaults; `zonedParts` / `zonedDate`), calendar days ("YYYY-MM-DD") stay their day (`LOCAL_TZ`).
* propertyTypes.jsx — the single definition of every property type: input, stored value, display, validation (Language holds one or more languages, matched like Multi-Selection). Also money: the default currency and exchange rates (Settings → Defaults), `toDefaultCurrency` for totals, `moneyText`.
* dataModel.jsx — Objects (Contacts, Deals, Customers), Associations, Properties (Settings → Data Management; the Properties table filters by Source — System or Custom — and Created By, a built-in property's being "System"). Record links: each association's type (One-to-many / Many-to-one / Many-to-many) is editable and the records follow it — stored as lists (a deal's and customer's `contactIds`, a customer's `dealIds`; the first contact is the record's person); `linkRule` / `canLink` / `linkedOf` are the one place the limits are read.
* contacts.jsx — the record views system (views, Save View, search, Filters, Table Settings, ContactsDataGrid / RecordSchema) used by every list in the app. On Contacts, Deals and Customers each view's name carries how many records it lists, as saved — "All Contacts (1,090)" (`viewRowCount`; `viewCounts` on RecordViewsModule). Every table's columns resize by dragging a header's right border; the widths are kept with the view (`columnWidths`). A Contacts filter on its deals reads the deals as the Deals page shows them; filters saved with older operator ids still apply.
* board.jsx — Board view and pipeline model (`source:'property'` vs `source:'record'`).
* contactDetail.jsx — record shell (side panel ⇄ full screen), reused for Deals and Customers. A record opens straight on its full page from anywhere (no side panel first); the page can be collapsed into the side panel and expanded again; while it's the side panel, another record clicked in the list takes its place there. The email in its header opens a new email to the record in the composer. The full page's top bar has View Settings (overviewSettings.jsx, per record type): Highlight Settings and Tab Settings — the workspace tabs' order and which show (Overview always first); by default Overview, Calls, Notes, Emails, Tasks, Meetings, Quotes, Accounting, Files, Customer Profile, Documents, then the associated records' tabs. The tab bar shows the tabs that fit and the rest under "<n> More", a dropdown. Its quick actions may have one Primary (Side Panel Settings → Quick Actions): a filled button with icon and name beneath the icons — to start with Create Deal on a contact, Create Customer on a deal, Call on a customer. `ownerDates` reads a record's owner history: Owner Assignment Date, Owner Change Date and Owner Assigned By (a system property on Contacts, Deals and Customers: the person, or the workflow by name, who gave the record its current owner).
* settingsKit.jsx — SettingsModalShell for card/panel/overview settings modals.
* emptyState.jsx (the illustrated EmptyState for every empty list, table, tab and page), richText.jsx, bulkActions.jsx, extendedProps.jsx (Customer Profile, Accounting and Form properties wherever properties are picked — table columns, filters, cards, Highlights; Form Properties: Submission Source and each Marketing form's answers, from the submission that created the record, also in workflow conditions under every trigger).

24.4 Modules
* CRM navigation: nav.jsx (Dashboard; Marketing, Pre-Sales, Sales, Tools, Administrative: Reports, Workflows, Settings; Edit Nav). Brand is a CRM Settings page (Settings → CRM Settings → Brand), not a Marketing item.
* Records: contacts.jsx, deals.jsx + dealDetail.jsx, customers.jsx; contactActions.jsx; contactOverview.jsx + overviewSettings.jsx.
* Activity: activities.jsx, activityCards.jsx, activityViews.jsx, files.jsx (also the built-in file viewer, FileViewer: PDF via pdf.js, images, .docx via mammoth, loaded from cdnjs when first needed — an attachment clicked in the email template editor or a sequence's Edit Email opens in the Preview pane in the email's place (Close brings the email back), its chip shown as selected; nowhere else yet), emails.jsx (the composer — its editor has Text Size and Text Color, the colours black, grey and the brand's, kept as inline styles in the sent email — and the email formats — Simple Text Body, Default HTML Template, Custom HTML Template — with the sender's signature, Fetch Property, the renderer `emailHtmlOf` and the live preview; templates, sequences and workflow emails all use it), callPanel.jsx (real mic + Web Speech transcription, simulated telephony), tools.jsx (Tools → Calls/Tasks/Emails/Meetings/Notes). Log Email (Add Email → Log Email, beside Email, on a record's Emails tab, its Add menu and Tools → Emails) records an email sent or received outside the CRM, as Log Call does a call: Email Type (Sent / Received), Point of Contact (the record owner to start with), Subject, Content; it reads "Email log sent by …", is editable (an email through the CRM stays read-only) and filters as Email or Email Log. A task is Not Started (new), In Progress (Start), On Hold (Put on Hold / Resume) or Completed (Complete) — buttons in its detail header and columns on the task board; any open task past its due date is Overdue, automatically. A task has Notes under its details, as a call and a meeting do (ActivityNotes; a note linked by `taskId`, shown as "Linked to task" on the Notes tab; deleting the task keeps its notes, unlinked). An email signature is always personal: each person sets their own in Settings → Brand → Email Signature (name, designation, email, phone, website, company address — each contact line with an icon — additional info, and the logo; also their profile photo, a Secondary Language of their choice — none to start with — and then the name, designation, address and additional info in it beside the first (right to left where the language is), a WhatsApp button from a WhatsApp number, and one CTA button — text and link, always black; the two buttons come last, after the additional info; the email, phone and website are links, the address isn't), kept on their user (Redberry Consultancy has a sample signature of its own for now — workspaces.jsx CRM_SIGNATURES — everyone's there until they save theirs); every email they send ends with it, added when the email is shown or sent, so a shared template carries each sender's own. Include Email Signature (on by default) leaves it out on a template, a sequence's email or an email being written. Fetch Property puts a record's value into an email body as a chip — a Contact, Deal or Customer property, an Accounting property or a Customer Profile property — filled in for the record as the email goes out, blank where it has no value. Activity types include Property change: each property a person or a workflow changes, with its old and new value (owner and stage changes keep their own types; system-set values and a merge's own changes aren't logged).
* Sales: services.jsx (catalog), quotes.jsx (6-step builder — Basics, Services, Payment Plan, Terms & Conditions, E-Signature, Preview; a saved quote template is chosen on Basics; Services step: Choose Service — the saved services as cards in a window — and New Service; the currency is set on the Payment Plan step; a quote template is made and edited in the same six steps, Basics without a recipient or validity; quotes keep their own copy of services; the quotation is on the Brand's Digital Letterhead; signing one makes its Payment Plan on the record), documents.jsx (Tools → Documents: a light document editor on the letterhead — rich text, text size, images, Add Record Info, Add Payment Plan (Accounting's plan panel), Add Signature blocks; signing links per signer (#s~…); the quotes' lifecycle; signed by everyone, its payment plans become Payment Plans), accounting.jsx (a record's Payment Plans — any number, none to start with, numbered PP-<year>-<nnnn>, in Active / Paid / Frozen tabs; a record shows its own plans and those of the records above and below it — Contact → Deal → Customer — never a sibling's (`planScopeOf` / `recordPlansOf`), the same plan editable and counted on each, tagged with the record it was added to; Freeze stops invoicing and payments; each edit a revision; the plan — One-Time, Installment (a deposit, then every 30 days; Edit sets each amount and date, names an installment — the Deposit stays the Deposit — and adds or deletes installments), Recurring (a monthly or yearly subscription, for a number of years or until cancelled) — its fields (PaymentTermsFields) and schedule (planSchedule), shared by quotes and documents; reconciling a payment needs proof), invoices.jsx (one invoice per payment of a plan, issued automatically on its invoice date by InvoiceIssuer, numbered INV-<year>-<nnnn>, never changed once issued — superseded ones archived; Tools → Invoices: Sent / Outstanding / Paid / Archived; the invoice on the letterhead with the PAID stamp).
* Duplicates: merge.jsx (Merge and Duplicate Detection: records of the same type sharing an email or phone form a merge case; one switch per record type, Enable Merge Cases Reporting (Settings → Records; on for Contacts to start with, off for the others), gives the Merge Status property — Unique / Duplicate / Form Refill / Merged — and the Merge Cases button and dropdown beside Workflow Violations (a case opens its review); the merge review side panel — each record's name with First / Second / Third, the oldest record kept with the chosen values and links as their types allow, everything of the others moves to it, they're deleted and a "Records merged" activity keeps the change; every merge kept whole (`mergeHistory`) so Split (a merged record's ⋯ menu) brings the records back and hands out what's new since; Keep Separate; the Merge permission; the workflow rules panel of Merge Record).
* Customer Profile: customerProfile.jsx, profileEngine.jsx (fact library), profileExtractor.jsx (in-browser stand-in for AI extraction).
* Automation: workflows.jsx (builder: context, triggers, actions; a workflow starts on All Records; no explanatory copy in its panels), workflowEngine.jsx (triggers, conditions, actions, execution; the Accounting properties workflows, filters and columns read — amounts, counts, dates and statuses by payment; Record Is Duplicated → Merge Record; Assign Record Owner under Track Violations proposes owners, all in one Owner Assignments card to approve; on a record's side panel and full page: its required actions as red pills that do them, and each automation as one line with Revert — the Workflows · Revert permission — kept until reverted or hidden), workflowsPage.jsx, pipelinePanel.jsx.
* Marketing: forms.jsx. Settings: settings.jsx, usersTeams.jsx (users, seats, teams, permission presets; Edit Permissions is also a text action beside each user's ⋯ menu, in a wider Actions column (a list's schema may set `actionsWidth`); permission categories include Dashboard — which KPIs and widgets a person may have at the Personal / Team / Company level; the Sales Professional preset sees every record and works their own, the Team Lead sees every record and works Their Team's and gives their team its permissions; no one edits their own permissions (a Super Admin may) or gives more than they hold (`permissionsWithin`); AssignPeopleModal — the one pattern for giving something to people: teams, whose members can be unticked, and single users), goals.jsx (Cash Received targets: company → teams → users, with the dashboard's Target KPI and Goals widget — the company's, a team's or the person's own, by the dashboard's level), templates.jsx, playbooks.jsx, cardSettings.jsx, panelSettings.jsx. templates.jsx in detail: Email Templates list Template Name, Subject, Used By, Created By; on every Templates tab (Email Templates, Email Sequences, Quote Templates, Playbooks, Services) an item's name opens its editor — the full panel where it's edited and seen together — and View stays in its menu; a quote template opens in the quote builder's steps; an email template is assigned to teams and users (Assign Template, offered as it's created) — the assigned people and its creator may pick it when writing an email, one assigned to no one is everyone's; Email Sequences list Enrolled (the records with emails still scheduled, a bar of how many sent, View and Exit; View opens that record's enrollment — the emails sent, a line, the ones still scheduled, which can be edited or removed for that record only, and Exit Sequence); a sequence's name opens its editor, the wide email panel — each email has its template, Edit Email (an icon button; the sequence's own copy; the template is untouched) and When: After Days (days, weeks or months after the email before) or Specific Date (a record enrolled after that date isn't sent that email); Clone Sequence copies one; a quote template opens as the quotation it makes, on the letterhead, with sample details; five sample email templates and sequences, with sample enrollments, are added once to the sample CRM. The sequence panels share one pattern (templates.jsx SequenceColumns): left to right — an instance's enrolled records in their own column with a search; the emails, each with icon-only View Email, Edit Email and Remove Email; the preview, a column that opens only on View Email; the footer Cancel, Exit Sequence, Save Changes on the right; the title is the sequence's name. Sequence Control (Settings → CRM Settings; templates.jsx) lists the sequences that are running, not the templates: one row per running instance — the records enrolled in a sequence on the same day with the same emails on the same dates — with how many are enrolled and a progress bar; its view shows the instance's emails (sent, a line, scheduled: edited for everyone — written again for each record — or removed) and the enrolled records with a search (View one record's own enrollment, Exit one), and Exit Sequence for everyone.
* Shell: app.jsx (header — in the sample CRM, a Persona Switcher beside Spring, for testing only: it signs in as Waleed the Manager, Ali the Team Lead or Mustafa the Employee, each with their own seat and Permission Preset (usersTeams.jsx PERSONAS) — main screen, store, the People module shell), workspaces.jsx (sign-in, the Organization's users and access, CRM / People switchers, ERP Settings — Organization, Users, Branches — and Brand), nav.jsx (CRM and People sidebars; the People navigation is a placeholder — pages not defined), dashboard.jsx (every KPI and widget is a figure at a level — Personal: the person's own records, Team: their team's, Company: every record — given by the Dashboard permissions and named for its level in full words, no tag: the plain name for every record's, ending in Team for a team's (Team Goals, Team Key Indicators), starting with My for the person's own (My Goals, My Tasks, My Velocity); each person sets their own dashboard in View Settings from what their permissions give them; Key Indicator User is a team's or the company's ranking, never Personal; tasks are the person's own only; the Time Clock is also a Personal widget, sharing the header's work session), logos.jsx, moduleIcons.jsx.
* Not built yet: Case Management, Petition Studio, HRMS.

24.5 Reference files (docs/)
* docs/hof-pulse-design-system.html — HOF Pulse design system (open in a browser).
* docs/figma/ — HOF CRM Redesign.fig (the Figma source referenced throughout the code: "Claude Feeder" section) and HOF CRM.fig. Open in Figma; Claude cannot read .fig files directly.
* docs/brand/ — Pulse and HOF logos. docs/module-icons-source/ — original Streamline Freehand module icon artwork (the in-app copies live in assets/module-icons/).
