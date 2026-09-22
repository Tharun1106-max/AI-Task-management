# TaskPilot - 5-Minute Video Demonstration Script 🎬

**Target Duration**: 5:00 Minutes  
**Audience**: Engineering Leaders, Technical Project Managers, Recruiters, and Developers  
**Tone**: Confident, technical, dynamic, and developer-focused  
**Visual Style**: Dark mode high-contrast screen recording with glassmorphic glow effects, webcam overlay in the top-right corner.

---

## ⏱ Timeline Breakdown

```
[0:00 - 0:45] Act I: The Problem & The Vision (Hook)
[0:45 - 1:45] Act II: AI Project Planner & Instant Decomposition
[1:45 - 2:45] Act III: Interactive Kanban & Prerequisite Status Guards
[2:45 - 3:45] Act IV: Topological Dependency Graph & Critical Path Engine
[3:45 - 4:30] Act V: Document RAG Ingestion & Semantic Q&A
[4:30 - 5:00] Act VI: Executive Health Analytics, AI Telemetry & Outro
```

---

## Act I: The Problem & The Vision
**Timestamp: 0:00 – 0:45 | Duration: 45s**

### Visual Cues:
- **Screen**: Full-screen camera or split screen showing chaotic browser tabs (Jira, Trello, Google Docs, ChatGPT), transitioning into the sleek, dark-mode TaskPilot Dashboard (`/dashboard`).
- **Camera**: Friendly, energetic delivery.

### Voiceover / Spoken Script:
> *"Hey everyone! If you've ever led a software engineering project, you know the modern project management paradox: we spend more time managing tickets, chasing status updates, and deciphering PRDs than actually shipping code.*
>
> *Traditional tools are static databases. And generic AI chat tools? They hallucinate disconnected tasks without understanding engineering dependencies or actual team bandwidth.*
>
> *That’s why I built **TaskPilot** — an AI-powered, context-aware project management platform engineered specifically for high-velocity software teams.*
>
> *TaskPilot doesn't just store tasks; it decomposes architectural requirements using sub-second Llama 3.3 70B inference, mathematically validates task dependencies to prevent deadlocks, and synthesizes technical documentation using dense vector RAG.*
>
> *Let's jump in and see it in action!"*

---

## Act II: AI Project Planner & Instant Decomposition
**Timestamp: 0:45 – 1:45 | Duration: 60s**

### Visual Cues:
- **Screen**: Navigate to `/ai-planner`.
- Click into the prompt input box. Type: *"Build an end-to-end FinTech payments microservice with Stripe webhook handling, idempotency keys, and reconciliation ledger."*
- Select Domain: **Software Engineering**, Duration: **4 Weeks**.
- Click **"Generate Project Plan"**.
- Show the loading pulse with Groq sub-second generation (under 1.5 seconds).
- Highlight the structured cards appearing: Milestones with target dates, 8 decomposed tasks with tags, priorities, and dependency links.
- Click **"Commit Plan to Project"** button.

### Voiceover / Spoken Script:
> *"Let's start in the **AI Project Planner**. Suppose our engineering team just got handed a high-level requirement: 'Build an end-to-end FinTech payments microservice with Stripe webhooks and reconciliation.'*
>
> *Normally, a tech lead would spend hours breaking this down into sprints, estimating duration, and sequencing prerequisites.*
>
> *With TaskPilot, I simply enter the prompt, choose the timeline, and click 'Generate'.*
>
> *In under two seconds — powered by Groq's high-speed Llama 3.3 70B inference — TaskPilot breaks this down into structured architectural milestones:*
> 1. *Stripe SDK & Webhook Verification Infrastructure*
> 2. *Distributed Idempotency Layer with Redis*
> 3. *Double-Entry Reconciliation Ledger*
>
> *Notice that every generated task is strictly typed with Pydantic schemas: realistic day estimates, priority levels, and suggested prerequisite task IDs.*
>
> *With one click on 'Commit Plan', this immediately spawns our new project with fully linked records in MongoDB."*

---

## Act III: Interactive Kanban & Prerequisite Status Guards
**Timestamp: 1:45 – 2:45 | Duration: 60s**

### Visual Cues:
- **Screen**: Navigate to `/tasks` (Kanban Board view).
- Show the columns: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `BLOCKED`.
- Drag a task *"Implement Idempotency Store"* towards `COMPLETED`.
- A red/amber glass notification toast appears: *"Prerequisite Task Required: 'Design Ledger Schema' must be COMPLETED before resolving this task."*
- Click on *"Design Ledger Schema"*, move it to `COMPLETED`.
- Now drag *"Implement Idempotency Store"* to `COMPLETED` — it transitions smoothly with a particle/glow effect.
- Open the task details modal: show live comments, assignee badges, and priority chips.

### Voiceover / Spoken Script:
> *"Now let's head over to the **Interactive Kanban Board**.*
>
> *Task management isn't just visual drag-and-drop; it requires architectural integrity. In traditional boards, engineers frequently mark downstream tasks complete while upstream blockers are still unresolved.*
>
> *Watch what happens when I try to drag 'Implement Idempotency Store' directly into COMPLETED:*
>
> *TaskPilot triggers a **Prerequisite Status Guard**. The backend checks our directed graph and blocks the transition because 'Design Ledger Schema' is still pending.*
>
> *Once I mark the prerequisite complete, the status guard unlocks, and the dependent task completes seamlessly.*
>
> *This ensures that project progress percentages reflect true, unblocked completion rather than premature status changes."*

---

## Act IV: Topological Dependency Graph & Critical Path Engine
**Timestamp: 2:45 – 3:45 | Duration: 60s**

### Visual Cues:
- **Screen**: Navigate to `/analytics` and scroll to the **Interactive SVG Dependency Graph**.
- Demonstrate the zoom, pan, and interactive dragging of nodes.
- Point cursor to the glowing amber/red animated edges: the **Critical Path**.
- Show the node details on hover: title, assignee avatar, status badge, estimated duration.
- Click **"Add Dependency"** button and intentionally try to create a circular link (e.g. Task A $\rightarrow$ Task B $\rightarrow$ Task A).
- Show the modal warning dialog: *"Circular Dependency Detected! 400 Bad Request: Cycle detected via Tarjan's topological sort."*

### Voiceover / Spoken Script:
> *"Here is where TaskPilot truly sets itself apart from standard Kanban tools: our **Topological Dependency Graph Visualizer**.*
>
> *Rendered entirely in interactive SVG with smooth pan and zoom, this graph models your project as a mathematical Directed Acyclic Graph (DAG).*
>
> *Notice these glowing amber edges? That’s our **Critical Path Engine**, calculated dynamically on the backend using the Critical Path Method (CPM).*
>
> *This shows engineering managers the exact sequence of dependent tasks that dictate the project's earliest completion date. Any delay on this path directly delays the ship date.*
>
> *Furthermore, TaskPilot actively enforces graph integrity. If a team member accidentally creates a circular dependency — say, Task A depends on Task B, which in turn depends on Task A — our backend runs a 3-color DFS cycle detection algorithm and rejects the change with a clear explanation, preventing project deadlocks before they happen."*

---

## Act V: Document RAG Ingestion & Semantic Q&A
**Timestamp: 3:45 – 4:30 | Duration: 45s**

### Visual Cues:
- **Screen**: Navigate to `/documents` (Document Knowledge Center).
- Drag-and-drop a technical PDF: `FinTech_Security_Architecture_v2.pdf`.
- Show upload progress and instant text chunking + dense vector embedding generation.
- In the right-hand panel, ask a question in the query input:
  *"What are the rate limiting rules and token expiration policies?"*
- Click **"Ask Document"**.
- Show response appearing in under 1 second: Answer synthesis with confidence score (`94%`) and clickable citation chips pointing to Chunk #4 and Chunk #7.

### Voiceover / Spoken Script:
> *"Engineers often drown in documentation scattered across wikis and PDFs.*
>
> *In the **Document Knowledge Center**, TaskPilot integrates a full Retrieval-Augmented Generation (RAG) engine.*
>
> *I simply upload our 50-page technical specification PDF. TaskPilot recursively chunks the document into semantic segments, computes dense vector embeddings using Sentence-Transformers, and stores them in MongoDB.*
>
> *Now, anyone on the team can query the project knowledge base in plain English:*
> *'What are the rate limiting rules and token expiration policies?'*
>
> *TaskPilot performs a cosine similarity vector search, retrieves the most relevant chunks, and prompts Groq's Llama 3 model to synthesize an exact, cited answer with zero hallucinations.*
>
> *Notice the citation badges below the answer? Click any badge, and you can inspect the exact source text chunk."*

---

## Act VI: Executive Health Analytics, AI Telemetry & Outro
**Timestamp: 4:30 – 5:00 | Duration: 30s**

### Visual Cues:
- **Screen**: Navigate to `/analytics` (Top view) and `/ai-usage`.
- Highlight the **Composite Project Health Gauge** (e.g. `87% Good`).
- Show the Cumulative Flow Diagram (CFD) and Team Workload balance chart.
- Switch to `/ai-usage`: show the circular token quota meter (e.g. `14,250 / 50,000 Tokens used today`) and daily audit log.
- Cut back to full webcam or side-by-side branding slide.

### Voiceover / Spoken Script:
> *"Finally, the **Executive Dashboard** aggregates project telemetry using high-performance MongoDB aggregation pipelines.*
>
> *Our composite **Project Health Score** weights completion rates, on-time milestones, unblocked task ratios, and git velocity into a single actionable gauge.*
>
> *And for enterprise governance, the **AI Usage Dashboard** tracks daily token quotas, sliding-window rate limits, and full audit logs to keep LLM costs predictable.*
>
> *TaskPilot is completely open source and production-ready with multi-stage Dockerfiles and one-command Docker Compose orchestration.*
>
> *Check out the GitHub repo in the description below, give it a star, and let me know what features you'd like to see next! Thanks for watching!"*

---

## 🎬 Production Checklist for Recording
- [ ] Screen resolution set to `1920x1080` (1080p 60fps).
- [ ] Browser zoom level set to `100%` or `110%` for crisp text rendering.
- [ ] Clean seeded demo project with 12+ tasks and 1 PDF document loaded.
- [ ] Groq API key verified and active with low latency.
- [ ] Audio normalized with noise gate and compression filter.
