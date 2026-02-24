/**
 * ChainShield AI – Fraud Detection Engine v2.1
 * Institutional-Grade Real-Time SCF Risk Intelligence
 */

class FraudEngine {
    constructor(invoices, suppliers, payments, graph) {
        this.invoices = invoices;
        this.suppliers = suppliers;
        this.payments = payments;
        this.graph = graph;

        // Build lookup maps
        this.supplierMap = {};
        this.paymentMap = {};
        this.supplierInvoiceMap = {}; // supplier_id -> [invoices]
        this.fingerprintMap = {};     // fingerprint -> [invoice_ids]

        // v2.1 Enterprise Modules
        this.erp = new ERPConnector(invoices);
        this.reconciliation = new ReconciliationEngine();
        this.velocity = new VelocityEngine();
        this.graphEngine = new GraphEngine(graph.nodes, graph.edges);
        this.dna = new DNAEngine();

        this._buildMaps();
        this._precomputeFingerprints();
        this._buildGraphAdjacency();
        this._detectCycles();
    }

    // ─────────────────────────────────────────────
    // MAP BUILDERS
    // ─────────────────────────────────────────────

    _buildMaps() {
        this.suppliers.forEach(s => { this.supplierMap[s.supplier_id] = s; });
        this.payments.forEach(p => { this.paymentMap[p.invoice_id] = p; });

        this.invoices.forEach(inv => {
            if (!this.supplierInvoiceMap[inv.supplier_id]) {
                this.supplierInvoiceMap[inv.supplier_id] = [];
            }
            this.supplierInvoiceMap[inv.supplier_id].push(inv);
        });
    }

    // ─────────────────────────────────────────────
    // v2.1 ENTERPRISE MODULES
    // ─────────────────────────────────────────────

    async computeReconciliationRisk(invoice) {
        const po = await this.erp.getPO(invoice.po_id);
        const grn = await this.erp.getGRN(invoice.po_id);
        return this.reconciliation.calculateReconciliationScore(invoice, po, grn);
    }

    computeVelocityRisk(invoice) {
        const supplierInvoices = this.supplierInvoiceMap[invoice.supplier_id] || [];
        return this.velocity.calculateVelocityRisk(supplierInvoices);
    }

    computeGraphRisk(invoice) {
        return this.graphEngine.calculateGraphCentralityRisk(invoice.supplier_id);
    }

    computeDNARisk(invoice) {
        const supplierInvoices = this.supplierInvoiceMap[invoice.supplier_id] || [];
        const profile = this.dna.computeDNAProfile(supplierInvoices);
        return this.dna.calculateDNADeviation(invoice, profile);
    }

    // ─────────────────────────────────────────────
    // CORE ALGORITHMS (RETAINED & UPDATED)
    // ─────────────────────────────────────────────

    computeBehavioralAnomalyScore(invoice) {
        const supplier = this.supplierMap[invoice.supplier_id];
        if (!supplier) return { score: 0.5 };

        const supplierInvoices = this.supplierInvoiceMap[invoice.supplier_id] || [];
        const historicalAvgFreq = parseFloat(supplier.historical_invoice_frequency) || 5;

        const invMonth = invoice.invoice_date ? invoice.invoice_date.slice(0, 7) : '';
        const monthCount = supplierInvoices.filter(inv =>
            inv.invoice_date && inv.invoice_date.slice(0, 7) === invMonth
        ).length;

        const freqDeviation = historicalAvgFreq > 0 ? (monthCount - historicalAvgFreq) / historicalAvgFreq : 0;
        const histAvgAmt = parseFloat(supplier.historical_avg_invoice_amount) || 1;
        const invAmt = parseFloat(invoice.invoice_amount) || 0;
        const amtDeviation = histAvgAmt > 0 ? (invAmt - histAvgAmt) / histAvgAmt : 0;

        const combinedScore = Math.abs(freqDeviation) * 0.5 + Math.abs(amtDeviation) * 0.5;
        const anomalyScore = 1 / (1 + Math.exp(-combinedScore + 1.5));

        return { score: Math.min(1, Math.max(0, anomalyScore)), is_anomaly: freqDeviation > 2 || amtDeviation > 2 };
    }

    computeRevenueFeasibilityScore(invoice) {
        const supplier = this.supplierMap[invoice.supplier_id];
        if (!supplier) return { score: 1, revenue_inflated: false };

        const annualRevenue = parseFloat(supplier.annual_revenue) || 1;
        const invAmt = parseFloat(invoice.invoice_amount) || 0;

        const invMonth = invoice.invoice_date ? invoice.invoice_date.slice(0, 7) : '';
        const supplierInvoices = this.supplierInvoiceMap[invoice.supplier_id] || [];
        const monthlyInvoiceVolume = supplierInvoices
            .filter(inv => inv.invoice_date && inv.invoice_date.slice(0, 7) === invMonth)
            .reduce((sum, inv) => sum + parseFloat(inv.invoice_amount || 0), 0);

        const monthlyRevenueCap = annualRevenue / 12;
        const revenueRatio = monthlyRevenueCap > 0 ? monthlyInvoiceVolume / monthlyRevenueCap : 0;

        return { score: revenueRatio > 1.5 ? 0.5 : 1, revenue_inflated: revenueRatio > 1.5 };
    }

    async _precomputeFingerprints() {
        for (const inv of this.invoices) {
            const fp = await this._sha256(`${inv.invoice_id}|${inv.supplier_id}|${Math.round(parseFloat(inv.invoice_amount || 0))}|${inv.po_id}`);
            if (!this.fingerprintMap[fp]) this.fingerprintMap[fp] = [];
            this.fingerprintMap[fp].push({ invoice_id: inv.invoice_id, lender_id: inv.lender_id });
        }
    }

    async _sha256(message) {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            hash = ((hash << 5) - hash) + message.charCodeAt(i);
            hash &= hash;
        }
        return Math.abs(hash).toString(16);
    }

    computeDuplicateRiskSync(invoice) {
        const poMatches = this.invoices.filter(inv =>
            inv.po_id === invoice.po_id && inv.invoice_id !== invoice.invoice_id && inv.lender_id && inv.lender_id !== invoice.lender_id
        ).length;
        return { risk: poMatches > 0 ? 1 : 0 };
    }

    computeDilutionRisk(invoice) {
        const payment = this.paymentMap[invoice.invoice_id];
        if (!payment) return { risk: 0 };
        const ratio = (parseFloat(payment.actual_payment) || 0) / (parseFloat(payment.expected_payment) || 1);
        return { risk: ratio < 0.7 ? 1 : (ratio < 0.85 ? 0.5 : 0) };
    }

    _buildGraphAdjacency() {
        this.adjacency = {};
        this.cycleNodes = new Set();
        if (!this.graph || !this.graph.edges) return;
        this.graph.edges.forEach(edge => {
            if (edge.type === 'supplies') {
                if (!this.adjacency[edge.source]) this.adjacency[edge.source] = new Set();
                this.adjacency[edge.source].add(edge.target);
            }
        });
    }

    _detectCycles() {
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        this.cycles = [];
        this.cycleNodes = new Set();
        this.carouselFraudNodes = new Set();

        const dfs = (node) => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);
            const neighbors = this.adjacency[node] || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) return true;
                } else if (recursionStack.has(neighbor)) {
                    const cycleStart = path.indexOf(neighbor);
                    const cycle = path.slice(cycleStart);
                    if (cycle.length >= 3) {
                        this.cycles.push([...cycle]);
                        cycle.forEach(n => this.cycleNodes.add(n));
                    }
                }
            }
            path.pop();
            recursionStack.delete(node);
            return false;
        };

        const allNodes = new Set([...Object.keys(this.adjacency), ...Object.values(this.adjacency).flatMap(s => [...s])]);
        for (const node of allNodes) { if (!visited.has(node)) dfs(node); }

        this.cycles.forEach(cycle => {
            const cycleInvoices = this.invoices.filter(inv => cycle.includes(inv.supplier_id) && cycle.includes(inv.buyer_id));
            const totalCycleVolume = cycleInvoices.reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0);
            const avgInv = totalCycleVolume / Math.max(cycleInvoices.length, 1);
            const globalAvg = this.invoices.reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0) / this.invoices.length;
            if (avgInv > 2 * globalAvg) cycle.forEach(n => this.carouselFraudNodes.add(n));
        });
    }

    isInCircularTrade(invoice) {
        const isCarousel = this.carouselFraudNodes.has(invoice.supplier_id) || this.carouselFraudNodes.has(invoice.buyer_id);
        const inCycle = this.cycleNodes.has(invoice.supplier_id) || this.cycleNodes.has(invoice.buyer_id);
        return { carousel_fraud: isCarousel, in_cycle: inCycle };
    }

    computeCascadeRisk(invoice) {
        const baseAmount = parseFloat(invoice.invoice_amount) || 1;
        const totalCascadeExposure = this.invoices
            .filter(inv => (inv.supplier_id === invoice.supplier_id || inv.buyer_id === invoice.buyer_id) && inv.financed_flag == 1 && inv.invoice_id !== invoice.invoice_id)
            .reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0);
        const fai = totalCascadeExposure / baseAmount;
        return { normalized_fai: Math.min(1, fai / 10) };
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 8: PRE-DISBURSEMENT COMPOSITE RISK DECISION ENGINE
    // ─────────────────────────────────────────────

    async calculatePreDisbursementRisk(invoice) {
        const behavioral = this.computeBehavioralAnomalyScore(invoice);
        const feasibility = this.computeRevenueFeasibilityScore(invoice);
        const duplicate = this.computeDuplicateRiskSync(invoice);
        const dilution = this.computeDilutionRisk(invoice);
        const velocity = this.computeVelocityRisk(invoice);
        const graph = this.computeGraphRisk(invoice);
        const dna = this.computeDNARisk(invoice);
        const reconciliation = await this.computeReconciliationRisk(invoice);

        const scores = {
            behavioral: behavioral.score * 100, // 25%
            feasibility: (feasibility.revenue_inflated ? 100 : 0), // 20%
            duplicate: duplicate.risk * 100, // 15%
            dilution: dilution.risk * 100, // 15%
            velocity: velocity.velocityRiskScore, // 15%
            graph: graph.graphRiskScore // 10%
        };

        const compositeRisk =
            0.25 * scores.behavioral +
            0.20 * scores.feasibility +
            0.15 * scores.duplicate +
            0.15 * scores.dilution +
            0.15 * scores.velocity +
            0.10 * scores.graph;

        let status = compositeRisk > 75 ? "AUTO HOLD" : (compositeRisk > 50 ? "MANUAL REVIEW" : "APPROVED");

        return {
            compositeRisk: Math.round(compositeRisk),
            status,
            dnaDeviationScore: dna.dnaDeviationScore,
            reconciliationScore: reconciliation.reconciliationScore,
            components: { ...scores, dna: dna.dnaDeviationScore, reconciliation: reconciliation.reconciliationScore }
        };
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 7: FINAL RISK SCORE (Updated for v2.1)
    // ─────────────────────────────────────────────

    async computeFullRiskScore(invoice) {
        const preDisbursement = await this.calculatePreDisbursementRisk(invoice);
        const circular = this.isInCircularTrade(invoice);
        const cascade = this.computeCascadeRisk(invoice);

        const finalScore = Math.round(
            preDisbursement.compositeRisk * 0.8 +
            (circular.carousel_fraud ? 100 : 0) * 0.1 +
            cascade.normalized_fai * 100 * 0.1
        );

        let decision = finalScore >= 70 ? 'BLOCK DISBURSEMENT' : (finalScore >= 40 ? 'MANUAL REVIEW' : 'APPROVE');
        let decision_class = finalScore >= 70 ? 'blocked' : (finalScore >= 40 ? 'review' : 'approved');

        return {
            invoice_id: invoice.invoice_id,
            risk_score: Math.min(100, finalScore),
            confidence_score: this.computeOverallConfidenceScore(invoice),
            decision,
            decision_class,
            preDisbursementStatus: preDisbursement.status,
            components: { preDisbursement, cascade, circular }
        };
    }

    calculateModelMetrics(predictions, actualFraudLabels) {
        let tp = 0, fp = 0, tn = 0, fn = 0;
        predictions.forEach((pred, i) => {
            const isFraud = pred.risk_score >= 70;
            const actual = actualFraudLabels[i];
            if (isFraud && actual) tp++; else if (isFraud && !actual) fp++; else if (!isFraud && !actual) tn++; else if (!isFraud && actual) fn++;
        });
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;
        return {
            precision: (precision * 100).toFixed(1) + '%',
            recall: (recall * 100).toFixed(1) + '%',
            f1: (2 * (precision * recall) / (precision + recall) || 0).toFixed(2),
            fpr: ((fp / (fp + tn) || 0) * 100).toFixed(1) + '%'
        };
    }

    computeSummaryStats(riskResults) {
        const total = riskResults.length;
        const blocked = riskResults.filter(r => r.decision_class === 'blocked').length;
        const review = riskResults.filter(r => r.decision_class === 'review').length;
        const approved = riskResults.filter(r => r.decision_class === 'approved').length;
        const avgRisk = total > 0 ? riskResults.reduce((s, r) => s + r.risk_score, 0) / total : 0;
        const avgRecon = riskResults.reduce((s, r) => s + (r.components.preDisbursement?.reconciliationScore || 0), 0) / total;

        return {
            total_invoices: total,
            fraud_alerts: blocked,
            manual_review: review,
            approved,
            avg_risk_score: Math.round(avgRisk * 10) / 10,
            avg_recon_confidence: Math.round(avgRecon),
            velocity_risks: riskResults.filter(r => r.components.preDisbursement?.components.velocity > 50).length,
            systemic_risks: riskResults.filter(r => r.components.preDisbursement?.components.graph > 70).length,
            fraud_rate: total > 0 ? Math.round((blocked / total) * 100 * 10) / 10 : 0
        };
    }

    computeOverallConfidenceScore(invoice) {
        let points = 100;
        if (!invoice.po_id) points -= 15;
        if (!invoice.units_supplied) points -= 5;
        return Math.min(100, Math.max(0, points));
    }

    async processAllInvoices(onProgress) {
        const results = [];
        const total = this.invoices.length;
        for (let i = 0; i < total; i++) {
            results.push(await this.computeFullRiskScore(this.invoices[i]));
            if (onProgress && i % 50 === 0) onProgress(Math.round((i / total) * 100));
        }
        if (onProgress) onProgress(100);
        return results;
    }
}

window.FraudEngine = FraudEngine;
