# InfraRecon AI: Planning-to-Execution Intelligence Layer
> **Smart India Hackathon (SIH 2026) — Problem Statement 26122**  
> *AI-Powered Reconciliation of Large-Scale Infrastructure Planning & Field Execution*

---

## Executive Overview
**InfraRecon AI** is an enterprise-grade Planning-to-Execution Intelligence Layer designed for mega infrastructure projects (Refineries, Metro Rail networks, Highway Corridors, Solar Mega Parks, High-Speed Rail). 

It bridges the critical disconnect between high-level Primavera P6/MS Project CPM schedules (L4/L5/L6) and unstructured, noisy daily field execution reports (Daily Progress Reports, site diaries, supervisor logs).

```
  [ CPM Schedule (CSV/XLSX) ]                [ Field Evidence (DPR / Logs) ]
               │                                            │
               ▼                                            ▼
  [ Fuzzy Column Normalization ]              [ Gemini 2.5 Flash Extraction ]
               │                                            │
               ▼                                            ▼
  [ Dense Vector Embeddings (384-dim) ]       [ Structured ExecutionEvent ]
               │                                            │
               └────────────────────┬───────────────────────┘
                                    ▼
                     [ Contextual Multi-Signal Matrix ]
                      ├── Semantic Alignment (40%)
                      ├── Asset / Line ID Match (20%)
                      ├── Discipline Alignment (15%)
                      ├── Location / Area Match (10%)
                      ├── WBS Hierarchy Match (10%)
                      └── Temporal Window Match (5%)
                                    │
                                    ▼
                     [ Confidence Classification ]
                      ├── HIGH (≥ 85%) ──► Fast-track Approval
                      ├── MEDIUM (60-84%) ──► Planner Disambiguation
                      └── LOW (< 60%) ──► Manual Override / Rejection
                                    │
                                    ▼
                     [ Verified Execution State ]
                      ├── Cumulative vs Sub-Work Semantics
                      ├── Chronological Observation History
                      └── Real-time Delay & Variance
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
 [ CPM Dependency Cascades ]               [ 7-Stage Explainability Audit ]
  ├── Float Buffer Deduction                ├── Complete Provenance Trace
  └── Multi-Tier Delay Propagation          └── Zero API Credential Leaks
               │                                         │
               └────────────────────┬────────────────────┘
                                    ▼
                    [ Executive Intelligence Dashboard ]
                     ├── S-Curve (Planned vs Verified Actual)
                     ├── Discipline Breakdown & Status Matrix
                     └── Rule-Based Downstream Risk Graph
```

---

## Core System Architecture & Features

1. **Schedule Ingestion & Normalization (Milestone 2)**:
   - Dynamic fuzzy column header matching (`Activity ID`, `Task Description`, `WBS`, `Discipline`, `Area/Location`, `Asset Tag`, `Planned Dates`).
   - Supports Primavera P6 / MS Project CSV and XLSX formats.
   - Extracts predecessor/successor dependency relationships for CPM network analysis.

2. **Grounded Fact Extraction Layer (Milestone 3 & 4)**:
   - Powered by **Gemini 2.5 Flash** with strict non-hallucination system instructions.
   - Outputs validated Pydantic `ExecutionEvent` entities grounded verbatim by raw evidence quotes.
   - Isolated architecture: AI extracts facts; it does **not** update database state or alter baseline dates.

3. **Dense Vector Embeddings & Candidate Retrieval (Milestone 5 & 6)**:
   - 384-dimensional dense semantic embeddings generated via `SentenceTransformers` (`all-MiniLM-L6-v2`).
   - Fast in-memory cosine similarity and search-space pruning across WBS branches and disciplines.

4. **Context-Aware Reconciliation Matrix (Milestone 7)**:
   - 6-signal weighted contextual scoring: Semantic (40%), Identifier (20%), Discipline (15%), Location (10%), WBS (10%), Temporal (5%).
   - Missing data evaluated neutrally without unfair mismatch penalties.
   - Human-readable explainability reasoning generated for each match.

5. **Human-in-the-Loop Planner Review Gate (Milestone 8)**:
   - Multi-tier confidence routing: `HIGH` ($\ge 85\%$), `MEDIUM` ($60-84\%$), `LOW` ($< 60\%$).
   - 3-pane review interface enabling candidate selection, manual reassignment, progress override, and evidence rejection.

6. **Verified Execution State Engine (Milestone 9)**:
   - Atomic database transactions separating raw observations from verified cumulative project progress.
   - Preserves monotonic progress and prevents single sub-work events from prematurely marking scheduled activities 100% complete.

7. **Explainable Governance & Audit Trail (Milestone 10)**:
   - Immutable 7-stage end-to-end lineage tracking:
     $$\text{Field Evidence} \to \text{AI Extraction} \to \text{Candidate Retrieval} \to \text{Reconciliation} \to \text{Confidence \& Signals} \to \text{Human Decision} \to \text{Verified State}$$
   - Zero credential leaks: API keys and bearer tokens are strictly omitted from database and serialization schemas.

8. **Project Intelligence Dashboard (Milestone 11)**:
   - Live S-Curve planned vs verified actual progress curves.
   - Discipline-wise breakdown, status distribution, and key project health metrics calculated from live verified state.

9. **Dependency Intelligence (Milestone 12)**:
   - Deterministic Critical Path Method (CPM) graph traversal.
   - Float buffer calculation: $\text{Buffer} = \max(0, \text{Successor Planned Start} - \text{Predecessor Planned Finish})$.
   - Net cascading slippage propagation: $\text{Slippage} = \max(0, \text{Predecessor Delay} - \text{Buffer})$.
   - Explicit non-predictive rule-based boundary.

---

## Technology Stack

- **Backend**:
  - Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2
  - SentenceTransformers (`all-MiniLM-L6-v2`), PyTorch, NumPy, Scikit-Learn
  - SQLite (Active Zero-Dependency Datastore) / PostgreSQL + pgvector (Containerized Option)
  - Google Gemini 2.5 Flash API
  - Pytest (77 unit & integration tests)
- **Frontend**:
  - React 18, Vite 6, TailwindCSS
  - Lucide React Icons, Recharts Analytics Suite
  - Responsive Enterprise Dark/Slate Theme

---

## Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup & Startup
```powershell
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*API Documentation available at: [http://localhost:8000/docs](http://localhost:8000/docs)*

### 2. Frontend Setup & Startup
```powershell
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*Frontend application available at: [http://localhost:5173](http://localhost:5173)*

### 3. Running Automated Tests
```powershell
cd backend
pytest tests/ -v
```

---

## Project Structure

```
SIH_PROJECT/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints (schedule, execution, review, etc.)
│   │   ├── models/          # SQLAlchemy relational models
│   │   ├── schemas/         # Pydantic request/response validation schemas
│   │   ├── services/        # Intelligence engines (embedding, reconciliation, CPM traversal)
│   │   ├── config.py        # Environment settings & confidence thresholds
│   │   ├── database.py      # Database engine & session management
│   │   └── main.py          # FastAPI application entrypoint
│   ├── data/                # Sample project schedules & test datasets
│   ├── tests/               # 77 automated unit & end-to-end regression tests
│   ├── Dockerfile           # Backend container definition
│   └── requirements.txt     # Python package dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components & layouts
│   │   ├── pages/           # 7 primary application views
│   │   ├── services/        # Axios API clients
│   │   ├── App.jsx          # Main application & routing
│   │   └── main.jsx         # React DOM entrypoint
│   ├── package.json         # Node.js dependencies
│   └── vite.config.js       # Vite configuration
├── docker-compose.yml       # Multi-container orchestration (DB, API, Web UI)
├── PROJECT_RULES.md         # Core architectural constraints & non-negotiables
└── README.md                # Project documentation
```

---

## License
Developed for Smart India Hackathon (SIH 2026). All rights reserved.
