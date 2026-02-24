# ChainShield AI – Fraud Intelligence Platform v2.1

ChainShield AI is a production-grade, ultra-modern fintech platform designed for real-time supply chain fraud detection. It combines advanced network graph analysis, behavioral anomaly detection, and cascade risk simulation to provide enterprise-level intelligence for multi-tier supply chains.

## 🚀 Tech Stack

- **Structure**: Semantic HTML5 with a focus on accessibility.
- **Styling**: Vanilla CSS3 with advanced Glassmorphism effects, Aurora background animations, and custom CSS variables.
- **Frontend Logic**: Vanilla JavaScript (ES6+) for state management and UI reactivity.
- **Visualizations**: 
  - **D3.js**: Used for the Force-Directed Network Graph and interactive charts (Heatmaps, Distribution Bars).
- **Data Handling**: 
  - **PapaParse**: High-performance CSV parsing.
  - **D3.js Fetch**: JSON dataset loading.
- **Algorithms**: Custom-built modular fraud detection engine.

## 🧠 Fraud Detection Algorithms

The platform implements 7 core fraud detection algorithms within the `FraudEngine`:

1. **Behavioral Anomaly Score**: Simulates an Isolation Forest algorithm by analyzing frequency and amount deviations from historical supplier patterns.
2. **Revenue Feasibility Score**: Validates if invoice volumes exceed a supplier's annual revenue or production capacity.
3. **Duplicate Invoice Detection**: Uses SHA-256 fingerprinting to identify invoices reused across different lenders or PO IDs.
4. **Dilution Risk**: Analyzes the ratio of actual payments vs. expected payments to detect shortfall risks.
5. **Circular Trade Detection**: Uses Depth-First Search (DFS) to find cycles in the supply chain graph (e.g., Supplier A -> Buyer B -> Supplier C -> Supplier A).
6. **Carousel Fraud Analysis**: Identifies inflated trade volumes within detected cycles, common in VAT fraud.
7. **Cascade Risk Simulation (FAI)**: Calculates the **Fraud Amplification Index** by modeling how a failure at one node affects upstream, downstream, and lender exposures.

## 🛠 Features

- **Executive Dashboard**: Real-time KPIs with animated "count-up" values and risk distributions.
- **Network Graph**: Zoomable, interactive supply chain relationship graph with physics-based layout.
- **Risk Simulator**: Interactive parameter tuning to model hypothetical fraud scenarios and see real-time score updates.
- **Invoice Inspector**: Granular breakdown of individual risk components and data confidence scores.
- **Global Command Palette**: Press `Ctrl + K` to search for invoices, suppliers, or navigate the application instantly.
- **System Health Monitor**: Real-time visualization of ingestion rates and API performance.

## 📦 Installation & Setup

> [!IMPORTANT]
> Because the browser cannot load local files (CSV/JSON) directly via the `file://` protocol due to security (CORS), you **must** use a local web server.

### Option 1: Using Node.js (Recommended)
1. Ensure you have Node.js installed.
2. Run the following command in the project root:
   ```bash
   npx serve . -p 5500
   ```
3. Open [http://localhost:5500](http://localhost:5500) in your browser.

### Option 2: VS Code Live Server
1. Search for "Live Server" in the VS Code Extensions Marketplace.
2. Right-click `index.html` and select "**Open with Live Server**".

## 📂 Project Structure

- `index.html`: Main application entry point and UI structure.
- `main.js`: Application bootstrap, UI rendering, and interactivity.
- `styles.css`: Enterprise dark fintech theme and visual effects.
- `engine/fraudEngine.js`: Core algorithmic engine for risk calculation.
- `data/`: Contains CSV and JSON datasets for simulation.

## 📜 Usage Guide

1. **Monitor Health**: Check the top right corner for ingestion status.
2. **Explore Graph**: Click on the 'Network Graph' tab to visualize supplier relationships.
3. **Simulate Scenarios**: Use the 'Simulation' tab to test how changing invoice amounts or frequencies impacts the risk score.
4. **Quick Navigation**: Use `Ctrl + K` to jump between views or search for specific Invoice IDs.
