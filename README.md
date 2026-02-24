# ChainShield AI – Fraud Intelligence Platform v2.1
**Institutional-Grade Real-Time SCF Risk Intelligence & Pre-Disbursement Decision Engine**

ChainShield AI is a production-grade, multi-tier Supply Chain Finance (SCF) fraud detection platform. Version 2.1 elevates the system to an enterprise-grade engine with automated three-way matching, temporal velocity analysis, and graph-based systemic risk modeling.

## 🚀 Enterprise v2.1 Capabilities

### 1. PO–GRN–Invoice Reconciliation
Automated three-way match engine that simulates ERP integration to validate invoices against Purchase Orders and Goods Received Notes. Detects over-billing and short-supply anomalies with a 5% tolerance threshold.

### 2. Temporal Velocity & Sequencing
Identifies sophisticated fraud patterns by detecting rolling 7-day frequency spikes and calculating Z-score deviations for invoice amounts and inter-arrival times.

### 3. Pre-Disbursement Composite Decision Engine
A high-performance weighted scoring matrix that aggregates 10+ risk modules into a final decision:
- **[AUTO HOLD]**: Risk > 75
- **[MANUAL REVIEW]**: Risk 50–75
- **[APPROVED]**: Risk < 50

### 4. Graph Centrality & Systemic Impact
Utilizes D3-based network analysis to identify "Too Big to Fail" nodes. High-centrality nodes are visually highlighted with a **Cyan Glow effect**, indicating systemic exposure risks within the supply chain.

### 5. Fraud DNA Behavioral Fingerprinting
Creates unique supplier behavioral "DNA" vectors. The system detects "Behavioral Drift" by comparing current invoice profiles against historical fingerprints (amount, frequency, counterparty diversity, payment delay ratio).

## 🧠 Core Detection Stack

1. **Behavioral Anomaly**: Isolation Forest simulation for frequency/amount deviations.
2. **Revenue Feasibility**: Monthly volume vs. Annual Revenue stress testing.
3. **Duplicate Detection**: Cross-lender SHA-256 invoice fingerprinting.
4. **Dilution Risk**: Payment shortfall analysis.
5. **Circular Trade**: DFS-based cycle detection for carousel fraud.
6. **Cascade Simulation**: Fraud Amplification Index (FAI) exposure modeling.

## 🛠 Features

- **Executive Dashboard**: Animated enterprise KPIs and real-time risk distribution.
- **Dynamic Network Graph**: Zoomable D3 graph with centrality visualization.
- **Scenario Simulator**: Interactive "What-If" parameter tuning for ledger modeling.
- **Invoice Inspector v2.1**: Granular multi-factor breakdown with Pre-Disbursement status.
- **Model Health Monitor**: Live ML performance metrics (F1 Score, Precision, Recall).
- **Command Palette**: `Ctrl + K` global navigation and deep-search.

## 📦 Installation & Setup

> [!IMPORTANT]
> A local web server is required due to browser CORS policies for CSV/JSON loading.

1. **Install Node.js** (if not present).
2. **Run Server**:
   ```bash
   npx serve . -p 5500
   ```
3. **Open**: [http://localhost:5500](http://localhost:5500)

## 📂 Modular Architecture

- `engine/fraudEngine.js`: Main engine orchestrating all modules.
- `engine/modules/`: Contains specialized logic for ERP integration, Reconciliation, Velocity, Graph Centrality, and DNA Fingerprinting.
- `main.js`: Real-time UI synchronization and App State management.
- `data/`: High-fidelity 1006-record synthetic dataset (Invoices, Suppliers, Payments, Graph).

---
*ChainShield AI v2.1 - Securing the Global Supply Chain.*
