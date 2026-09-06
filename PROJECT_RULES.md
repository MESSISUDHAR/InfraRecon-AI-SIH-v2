# PROJECT RULES & ARCHITECTURAL CONSTRAINTS
## SIH 2026 – Problem Statement 26122: Planning-to-Execution Intelligence Layer

These rules are mandatory and non-negotiable across all development phases and milestones.

---

### 1. Zero Hardcoded Data
- **No Hardcoded Mappings**: Never hardcode mappings like `"24-inch spool" -> "PIP-045"`.
- **No Hardcoded Activity IDs or Project Names**: All schedules are dynamically parsed, normalized, and validated from user-uploaded `.csv` or `.xlsx` files.
- **Dynamic Schema Normalization**: The ingestion pipeline must dynamically map fuzzy column names (e.g., `Activity ID`, `Task Code`, `WBS`, `Discipline`, `Location`, `Asset Tag`).
- **Demo Data as Test Input Only**: Demo datasets must strictly serve as optional test inputs. Deleting demo data or uploading an arbitrary valid infrastructure schedule must work without code changes.

---

### 2. Separation of Intelligence Concerns
- **LLM (Gemini 2.5 Flash)**:
  - Strictly responsible for **language understanding and structured extraction** from raw field evidence (DPRs, site diaries, supervisor logs).
  - Outputs a validated Pydantic `ExecutionEvent`.
  - Must ONLY extract facts grounded in source text (null/unknown when absent, no hallucinating IDs or dates).
  - **CRITICAL**: The LLM must NEVER select the final L5/L6 schedule activity and must NEVER directly update the project database.
- **Embedding Model (Sentence Transformers)**:
  - Converts schedule activity descriptions and extracted execution event summaries into dense vector representations for Top-K candidate retrieval.
- **Context-Aware Reconciliation Engine**:
  - Deterministically evaluates multi-signal contextual dimensions (Semantic, Asset/Line ID, Discipline, Location, WBS Context, Temporal Consistency).
  - Weights are user-configurable.
  - Missing data rule: Missing optional attributes (like missing asset ID in DPR) do not automatically trigger negative mismatch penalties; certainty is adjusted proportionally.
- **Human-in-the-Loop Validation Gate**:
  - High confidence ($\ge 85\%$): Eligible for automatic processing based on project rules.
  - Medium/Low confidence ($< 85\%$): Routed to 3-pane Planner Review for human approval/override.

---

### 3. Verified Execution State & Progress Semantics
- **Raw Extraction vs. Verified State**: Raw LLM extraction must never directly overwrite trusted project state.
- **Multiple Observations to One Activity**: Multiple daily progress reports (e.g. Day 1: 20%, Day 2: 60%, Day 3: 100%) can sequentially contribute to the same L5/L6 schedule activity.
- **Event-Level vs. Activity-Level Progress**: Distinguish `event_progress` (progress reported in this specific observation) from `activity_actual_progress` (overall verified cumulative progress of the scheduled task).

---

### 4. End-to-End Explainability & Audit Trail
- Every verified execution state update must retain full lineage:
  - Source file / raw field text
  - Extracted `ExecutionEvent` (model version + prompt)
  - Candidate retrieval list & individual signal scores (semantic, ID, discipline, location, temporal)
  - Reviewer decision (auto-approved vs planner validated)
  - Timestamp, previous state, and new execution state.
- Planners must always be able to answer: *"Why did the system match this event to this activity?"*

---

### 5. Enterprise Engineering Standards
- **UI Aesthetics**: Professional enterprise project-management design (dark slate palette, Inter typography, structured data tables, clear status/confidence badges, responsive layout). No gimmicky AI visuals.
- **Security**: All API keys server-side only in environment variables; zero frontend leaks.
- **Deployment**: Dockerized with multi-stage builds and `docker-compose.yml` supporting PostgreSQL/pgvector.
