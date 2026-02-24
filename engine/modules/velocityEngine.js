/**
 * Temporal Velocity & Sequencing Anomaly Detection
 * Monitors the speed and pattern of transaction flow.
 */

class VelocityEngine {
    /**
     * @param {Array} supplierInvoices Historical invoices for the same supplier
     */
    calculateVelocityRisk(supplierInvoices) {
        if (!supplierInvoices || supplierInvoices.length < 3) {
            return { velocityRiskScore: 0, spikeDetected: false, anomalyZScore: 0 };
        }

        // Sort by date
        const sortedInvoices = [...supplierInvoices].sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));

        // 1. Frequency Spike (rolling 7-day window)
        const lastInvoiceDate = new Date(sortedInvoices[sortedInvoices.length - 1].invoice_date);
        const sevenDaysAgo = new Date(lastInvoiceDate);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentInvoices = sortedInvoices.filter(inv => new Date(inv.invoice_date) >= sevenDaysAgo);
        const avgFrequency = supplierInvoices.length / 12; // Very simplified base freq
        const spikeDetected = recentInvoices.length > (avgFrequency * 2) && recentInvoices.length > 5;

        // 2. Z-Score Deviation of Invoice Amount
        const amounts = supplierInvoices.map(inv => parseFloat(inv.invoice_amount) || 0);
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length) || 1;

        const latestAmount = amounts[amounts.length - 1];
        const zScore = Math.abs((latestAmount - mean) / stdDev);

        // 3. Sequential Invoice Number Irregularities
        // Check if invoice_id numbers are too close/sequential in short time
        let sequentialRisk = 0;
        if (recentInvoices.length >= 2) {
            const ids = recentInvoices.map(inv => parseInt(inv.invoice_id.split('-')[1])).sort((a, b) => a - b);
            let gaps = 0;
            for (let i = 1; i < ids.length; i++) {
                if (ids[i] - ids[i - 1] === 1) gaps++;
            }
            sequentialRisk = (gaps / ids.length) * 100;
        }

        // Overall Velocity Risk Score (0-100)
        let riskScore = (spikeDetected ? 40 : 0) + (zScore > 2 ? 30 : 0) + (sequentialRisk > 50 ? 30 : 0);
        riskScore = Math.min(100, riskScore);

        return {
            velocityRiskScore: Math.round(riskScore),
            spikeDetected,
            anomalyZScore: parseFloat(zScore.toFixed(2)),
            recentCount: recentInvoices.length,
            sequentialRiskFactor: Math.round(sequentialRisk)
        };
    }
}

if (typeof window !== 'undefined') {
    window.VelocityEngine = VelocityEngine;
}
