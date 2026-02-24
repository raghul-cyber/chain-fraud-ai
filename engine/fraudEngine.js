/**
 * ChainShield AI – Fraud Detection Engine
 * Implements 7 fraud detection algorithms:
 * 1. Behavioral Anomaly Score (Isolation Forest simulation)
 * 2. Revenue Feasibility Score
 * 3. Duplicate Invoice Detection (SHA-256)
 * 4. Dilution Risk
 * 5. Circular Trade Detection (DFS cycle detection)
 * 6. Cascade Risk Simulation (FAI)
 * 7. Final Risk Score Formula
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
    // ALGORITHM 1: BEHAVIORAL ANOMALY SCORE
    // Isolation Forest simulation via frequency deviation
    // Returns score in [0, 1]
    // ─────────────────────────────────────────────

    computeBehavioralAnomalyScore(invoice) {
        const supplier = this.supplierMap[invoice.supplier_id];
        if (!supplier) return 0.5;

        const supplierInvoices = this.supplierInvoiceMap[invoice.supplier_id] || [];
        const historicalAvgFreq = parseFloat(supplier.historical_invoice_frequency) || 5;

        // Count invoices in the same month as this invoice
        const invMonth = invoice.invoice_date ? invoice.invoice_date.slice(0, 7) : '';
        const monthCount = supplierInvoices.filter(inv =>
            inv.invoice_date && inv.invoice_date.slice(0, 7) === invMonth
        ).length;

        // Frequency deviation
        const freqDeviation = historicalAvgFreq > 0
            ? (monthCount - historicalAvgFreq) / historicalAvgFreq
            : 0;

        // Amount deviation from historical average
        const histAvgAmt = parseFloat(supplier.historical_avg_invoice_amount) || 1;
        const invAmt = parseFloat(invoice.invoice_amount) || 0;
        const amtDeviation = histAvgAmt > 0
            ? (invAmt - histAvgAmt) / histAvgAmt
            : 0;

        // Isolation Forest score simulation:
        // Use a logistic-like sigmoid that maps large deviations to high scores
        const combinedScore = Math.abs(freqDeviation) * 0.5 + Math.abs(amtDeviation) * 0.5;
        const anomalyScore = 1 / (1 + Math.exp(-combinedScore + 1.5));

        // Hard threshold: freq deviation > 2 → anomaly flag
        const isAnomaly = freqDeviation > 2 || amtDeviation > 2;

        return {
            score: Math.min(1, Math.max(0, anomalyScore)),
            frequency_deviation: freqDeviation,
            amount_deviation: amtDeviation,
            month_count: monthCount,
            is_anomaly: isAnomaly
        };
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 2: REVENUE FEASIBILITY SCORE
    // ─────────────────────────────────────────────

    computeRevenueFeasibilityScore(invoice) {
        const supplier = this.supplierMap[invoice.supplier_id];
        if (!supplier) return { score: 1, inflated: false, capacity_exceeded: false };

        const annualRevenue = parseFloat(supplier.annual_revenue) || 1;
        const monthlyCapacity = parseFloat(supplier.monthly_production_capacity) || 1;
        const invAmt = parseFloat(invoice.invoice_amount) || 0;
        const unitsSupplied = parseFloat(invoice.units_supplied) || 0;

        // Calculate total monthly invoice volume for this supplier in this invoice's month
        const invMonth = invoice.invoice_date ? invoice.invoice_date.slice(0, 7) : '';
        const supplierInvoices = this.supplierInvoiceMap[invoice.supplier_id] || [];
        const monthlyInvoiceVolume = supplierInvoices
            .filter(inv => inv.invoice_date && inv.invoice_date.slice(0, 7) === invMonth)
            .reduce((sum, inv) => sum + parseFloat(inv.invoice_amount || 0), 0);

        const monthlyRevenueCap = annualRevenue / 12;
        const revenueRatio = monthlyRevenueCap > 0 ? monthlyInvoiceVolume / monthlyRevenueCap : 0;

        // Revenue inflation flag
        const revenueInflated = revenueRatio > 1.5;

        // Production capacity check
        const capacityRatio = monthlyCapacity > 0 ? unitsSupplied / monthlyCapacity : 0;
        const capacityExceeded = capacityRatio > 1;

        // Feasibility score: higher = more feasible (lower risk)
        let feasibilityScore;
        if (capacityExceeded) {
            feasibilityScore = monthlyCapacity / Math.max(unitsSupplied, 1);
        } else {
            feasibilityScore = 1.0;
        }

        return {
            score: Math.min(1, Math.max(0, feasibilityScore)),
            revenue_ratio: revenueRatio,
            capacity_ratio: capacityRatio,
            monthly_invoice_volume: monthlyInvoiceVolume,
            monthly_revenue_cap: monthlyRevenueCap,
            revenue_inflated: revenueInflated,
            capacity_exceeded: capacityExceeded
        };
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 3: DUPLICATE INVOICE DETECTION
    // SHA-256 fingerprint cross-lender check
    // ─────────────────────────────────────────────

    async _precomputeFingerprints() {
        for (const inv of this.invoices) {
            const fp = await this._sha256(
                `${inv.invoice_id}|${inv.supplier_id}|${Math.round(parseFloat(inv.invoice_amount || 0))}|${inv.po_id}`
            );
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
        // Fallback: simple hash
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash;
        }
        return Math.abs(hash).toString(16);
    }

    async computeDuplicateRisk(invoice) {
        const fp = await this._sha256(
            `${invoice.invoice_id}|${invoice.supplier_id}|${Math.round(parseFloat(invoice.invoice_amount || 0))}|${invoice.po_id}`
        );

        const matches = this.fingerprintMap[fp] || [];
        const uniqueLenders = new Set(matches.map(m => m.lender_id).filter(Boolean));
        const isDuplicate = uniqueLenders.size > 1;

        // Also check PO ID reuse across lenders
        const poMatches = this.invoices.filter(inv =>
            inv.po_id === invoice.po_id &&
            inv.invoice_id !== invoice.invoice_id &&
            inv.lender_id &&
            inv.lender_id !== invoice.lender_id
        );

        return {
            risk: (isDuplicate || poMatches.length > 0) ? 1 : 0,
            fingerprint: fp.slice(0, 16) + '...',
            full_fingerprint: fp,
            matched_lenders: Array.from(uniqueLenders),
            po_duplicates: poMatches.length
        };
    }

    // Synchronous version using PO check only (for table rendering)
    computeDuplicateRiskSync(invoice) {
        const poMatches = this.invoices.filter(inv =>
            inv.po_id === invoice.po_id &&
            inv.invoice_id !== invoice.invoice_id &&
            inv.lender_id &&
            inv.lender_id !== invoice.lender_id
        );

        // Pre-computed fingerprint map check
        const fp = this._quickFingerprint(invoice);
        const matches = this.fingerprintMap[fp] || [];
        const uniqueLenders = new Set(matches.filter(m => m.lender_id).map(m => m.lender_id));
        const isDuplicate = uniqueLenders.size > 1 || poMatches.length > 0;

        return {
            risk: isDuplicate ? 1 : 0,
            po_duplicates: poMatches.length
        };
    }

    _quickFingerprint(invoice) {
        const msg = `${invoice.invoice_id}|${invoice.supplier_id}|${Math.round(parseFloat(invoice.invoice_amount || 0))}|${invoice.po_id}`;
        let hash = 0;
        for (let i = 0; i < msg.length; i++) {
            hash = ((hash << 5) - hash) + msg.charCodeAt(i);
            hash &= hash;
        }
        return Math.abs(hash).toString(16);
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 4: DILUTION RISK
    // dilution_ratio = actual_payment / expected_payment
    // ─────────────────────────────────────────────

    computeDilutionRisk(invoice) {
        const payment = this.paymentMap[invoice.invoice_id];
        if (!payment) return { risk: 0, ratio: 1, expected: 0, actual: 0 };

        const expected = parseFloat(payment.expected_payment) || 1;
        const actual = parseFloat(payment.actual_payment) || 0;
        const ratio = actual / expected;

        return {
            risk: ratio < 0.7 ? 1 : (ratio < 0.85 ? 0.5 : 0),
            ratio: Math.round(ratio * 1000) / 1000,
            expected,
            actual,
            shortfall: expected - actual,
            is_high_risk: ratio < 0.7
        };
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 5: CIRCULAR TRADE DETECTION
    // DFS-based cycle detection on supplier graph
    // ─────────────────────────────────────────────

    _buildGraphAdjacency() {
        this.adjacency = {}; // node -> Set of neighbors
        this.cycleNodes = new Set();
        this.cycles = [];

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

        const dfs = (node) => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const neighbors = this.adjacency[node] || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) return true;
                } else if (recursionStack.has(neighbor)) {
                    // Found cycle
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

        // Also check buyer->supplier cycles (for carousel detection)
        const allNodes = new Set([
            ...Object.keys(this.adjacency),
            ...Object.values(this.adjacency).flatMap(s => [...s])
        ]);

        for (const node of allNodes) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }

        // Mark carousel fraud if cycle with inflated volume
        this.carouselFraudNodes = new Set();
        this.cycles.forEach(cycle => {
            // Check if invoice volume within cycle nodes is inflated
            const cycleInvoices = this.invoices.filter(inv =>
                cycle.includes(inv.supplier_id) && cycle.includes(inv.buyer_id)
            );
            const totalCycleVolume = cycleInvoices.reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0);
            const avgInv = totalCycleVolume / Math.max(cycleInvoices.length, 1);

            // If average is > 2x market average → carousel fraud
            const globalAvg = this.invoices.reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0) / this.invoices.length;
            if (avgInv > 2 * globalAvg) {
                cycle.forEach(n => this.carouselFraudNodes.add(n));
            }
        });
    }

    isInCircularTrade(invoice) {
        const inCycle = this.cycleNodes.has(invoice.supplier_id) || this.cycleNodes.has(invoice.buyer_id);
        const isCarousel = this.carouselFraudNodes.has(invoice.supplier_id) || this.carouselFraudNodes.has(invoice.buyer_id);
        return { in_cycle: inCycle, carousel_fraud: isCarousel, cycles: this.cycles.length };
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 6: CASCADE RISK SIMULATION
    // FAI = Total Cascade Exposure / Base Invoice Amount
    // ─────────────────────────────────────────────

    computeCascadeRisk(invoice) {
        const baseAmount = parseFloat(invoice.invoice_amount) || 1;
        const supplierId = invoice.supplier_id;
        const lenderId = invoice.lender_id;

        // Find all invoices from this supplier (upstream)
        const upstreamInvoices = this.invoices.filter(inv =>
            inv.supplier_id === supplierId && inv.financed_flag == 1 && inv.invoice_id !== invoice.invoice_id
        );

        // Find all invoices from suppliers buying from same buyers (downstream exposure)
        const buyerId = invoice.buyer_id;
        const downstreamInvoices = this.invoices.filter(inv =>
            inv.buyer_id === buyerId && inv.financed_flag == 1 && inv.invoice_id !== invoice.invoice_id
        );

        // Lender exposure: all invoices financed by same lender
        const lenderExposureInvoices = lenderId
            ? this.invoices.filter(inv => inv.lender_id === lenderId && inv.financed_flag == 1 && inv.invoice_id !== invoice.invoice_id)
            : [];

        const upstreamExposure = upstreamInvoices.reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0);
        const downstreamExposure = downstreamInvoices.reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0);
        const lenderExposure = lenderExposureInvoices.reduce((s, inv) => s + parseFloat(inv.invoice_amount || 0), 0);

        const totalCascadeExposure = upstreamExposure + downstreamExposure + lenderExposure;
        const fai = baseAmount > 0 ? totalCascadeExposure / baseAmount : 0;

        // Normalize FAI to [0, 1] — FAI > 10 → 1.0
        const normalizedFAI = Math.min(1, fai / 10);

        return {
            fai: Math.round(fai * 100) / 100,
            normalized_fai: normalizedFAI,
            total_cascade_exposure: totalCascadeExposure,
            upstream_exposure: upstreamExposure,
            downstream_exposure: downstreamExposure,
            lender_exposure: lenderExposure,
            is_high_risk: fai > 3,
            upstream_count: upstreamInvoices.length,
            downstream_count: downstreamInvoices.length
        };
    }

    // ─────────────────────────────────────────────
    // ALGORITHM 7: FINAL RISK SCORE
    // Weighted composite formula
    // ─────────────────────────────────────────────

    async computeFullRiskScore(invoice) {
        const anomaly = this.computeBehavioralAnomalyScore(invoice);
        const feasibility = this.computeRevenueFeasibilityScore(invoice);
        const duplicate = this.computeDuplicateRiskSync(invoice);
        const dilution = this.computeDilutionRisk(invoice);
        const cascade = this.computeCascadeRisk(invoice);
        const circular = this.isInCircularTrade(invoice);

        // Component scores (0-100 each)
        const behaviorScore = anomaly.score * 100;
        const revenueScore = (feasibility.revenue_inflated ? 100 : 0) * 0.5 + (feasibility.capacity_exceeded ? (1 - feasibility.score) * 100 : 0) * 0.5;
        const dilutionScore = dilution.risk * 100;
        const duplicateScore = duplicate.risk * 100;
        const faiScore = cascade.normalized_fai * 100;
        const circularScore = circular.carousel_fraud ? 100 : (circular.in_cycle ? 50 : 0);

        // Weighted formula
        const riskScore =
            0.25 * behaviorScore +
            0.15 * revenueScore +
            0.15 * dilutionScore +
            0.20 * duplicateScore +
            0.15 * faiScore +
            0.10 * circularScore;

        const finalScore = Math.min(100, Math.round(riskScore));

        let decision, decision_class;
        if (finalScore >= 70) {
            decision = 'BLOCK DISBURSEMENT';
            decision_class = 'blocked';
        } else if (finalScore >= 40) {
            decision = 'MANUAL REVIEW';
            decision_class = 'review';
        } else {
            decision = 'APPROVE';
            decision_class = 'approved';
        }

        const confidence = this.computeOverallConfidenceScore(invoice);

        return {
            invoice_id: invoice.invoice_id,
            risk_score: finalScore,
            confidence_score: confidence,
            decision,
            decision_class,
            components: {
                behavioral_anomaly: { score: Math.round(behaviorScore), weight: '25%', detail: anomaly },
                revenue_feasibility: { score: Math.round(revenueScore), weight: '15%', detail: feasibility },
                dilution_risk: { score: Math.round(dilutionScore), weight: '15%', detail: dilution },
                duplicate_risk: { score: Math.round(duplicateScore), weight: '20%', detail: duplicate },
                cascade_fai: { score: Math.round(faiScore), weight: '15%', detail: cascade },
                circular_trade: { score: Math.round(circularScore), weight: '10%', detail: circular }
            }
        };
    }

    // New: Overall Confidence Score
    computeOverallConfidenceScore(invoice) {
        let points = 100;
        const supplier = this.supplierMap[invoice.supplier_id];

        if (!supplier) points -= 20;
        if (!invoice.po_id) points -= 15;
        if (!invoice.lender_id) points -= 10;
        if (!invoice.units_supplied) points -= 5;

        // Bonus for historical stability
        if (supplier && supplier.default_history_flag == 0) points += 5;

        return Math.min(100, Math.max(0, points));
    }

    // ─────────────────────────────────────────────
    // BATCH PROCESSING
    // ─────────────────────────────────────────────

    async processAllInvoices(onProgress) {
        const results = [];
        const total = this.invoices.length;

        for (let i = 0; i < total; i++) {
            const result = await this.computeFullRiskScore(this.invoices[i]);
            results.push(result);
            if (onProgress && i % 50 === 0) onProgress(Math.round((i / total) * 100));
        }

        if (onProgress) onProgress(100);
        return results;
    }

    // Summary statistics from processed results
    computeSummaryStats(riskResults) {
        const total = riskResults.length;
        const blocked = riskResults.filter(r => r.decision_class === 'blocked').length;
        const review = riskResults.filter(r => r.decision_class === 'review').length;
        const approved = riskResults.filter(r => r.decision_class === 'approved').length;
        const avgRisk = total > 0 ? riskResults.reduce((s, r) => s + r.risk_score, 0) / total : 0;
        const cascadeRisks = riskResults.filter(r => r.components.cascade_fai.detail.is_high_risk).length;

        return {
            total_invoices: total,
            fraud_alerts: blocked,
            manual_review: review,
            approved,
            avg_risk_score: Math.round(avgRisk * 10) / 10,
            active_cascade_risks: cascadeRisks,
            fraud_rate: total > 0 ? Math.round((blocked / total) * 100 * 10) / 10 : 0
        };
    }

    // ─────────────────────────────────────────────
    // SIMULATION MODE  (recalculate with overridden params)
    // ─────────────────────────────────────────────

    simulateRiskScore(params) {
        const {
            invoice_amount = 1000000,
            units_supplied = 500,
            invoice_frequency = 5,
            historical_avg_frequency = 5,
            historical_avg_amount = 1000000,
            annual_revenue = 50000000,
            monthly_capacity = 10000,
            actual_payment_ratio = 0.95
        } = params;

        // Behavioral anomaly
        const freqDev = historical_avg_frequency > 0
            ? (invoice_frequency - historical_avg_frequency) / historical_avg_frequency : 0;
        const amtDev = historical_avg_amount > 0
            ? (invoice_amount - historical_avg_amount) / historical_avg_amount : 0;
        const combinedDev = Math.abs(freqDev) * 0.5 + Math.abs(amtDev) * 0.5;
        const anomalyScore = 1 / (1 + Math.exp(-combinedDev + 1.5));

        // Revenue feasibility
        const monthlyRevCap = annual_revenue / 12;
        const revenueRatio = monthlyRevCap > 0 ? (invoice_amount * invoice_frequency) / monthlyRevCap : 0;
        const revenueInflated = revenueRatio > 1.5;
        const capRatio = monthly_capacity > 0 ? units_supplied / monthly_capacity : 0;
        const capExceeded = capRatio > 1;
        const feasScore = capExceeded ? monthly_capacity / Math.max(units_supplied, 1) : 1;

        // Dilution
        const dilutionRisk = actual_payment_ratio < 0.7 ? 1 : (actual_payment_ratio < 0.85 ? 0.5 : 0);

        // FAI simplified (based on frequency as proxy for exposure)
        const faiProxy = Math.min(1, (invoice_frequency / historical_avg_frequency) * 0.3);

        // Weighted score
        const revenueScore = (revenueInflated ? 50 : 0) + (capExceeded ? (1 - feasScore) * 50 : 0);
        const riskScore = Math.min(100,
            0.25 * anomalyScore * 100 +
            0.15 * revenueScore +
            0.15 * dilutionRisk * 100 +
            0.15 * faiProxy * 100
        );

        return {
            risk_score: Math.round(riskScore),
            anomaly_score: Math.round(anomalyScore * 100) / 100,
            fai: Math.round(faiProxy * 10 * 100) / 100,
            feasibility_score: Math.round(feasScore * 100) / 100,
            revenue_ratio: Math.round(revenueRatio * 100) / 100,
            dilution_risk: dilutionRisk,
            freq_deviation: Math.round(freqDev * 100) / 100,
            decision: riskScore >= 70 ? 'BLOCK' : riskScore >= 40 ? 'REVIEW' : 'APPROVE',
            decision_class: riskScore >= 70 ? 'blocked' : riskScore >= 40 ? 'review' : 'approved'
        };
    }
}

window.FraudEngine = FraudEngine;
