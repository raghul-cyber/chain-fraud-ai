/**
 * Fraud DNA Behavioral Fingerprint
 * Creates a mathematical "fingerprint" of supplier behavior to detect drift.
 */

class DNAEngine {
    /**
     * Compute profile for a supplier based on historical invoices
     */
    computeDNAProfile(supplierInvoices) {
        if (!supplierInvoices || supplierInvoices.length === 0) return null;

        const amounts = supplierInvoices.map(inv => parseFloat(inv.invoice_amount) || 0);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((a, b) => a + Math.pow(b - avgAmount, 2), 0) / amounts.length) || 1;

        const frequency = supplierInvoices.length / 12; // simplistic annual freq
        const uniqueCounterparties = new Set(supplierInvoices.map(inv => inv.buyer_id)).size;

        return {
            avgAmount,
            stdDev,
            frequency,
            counterpartyDiversity: uniqueCounterparties,
            vector: [avgAmount, stdDev, frequency, uniqueCounterparties]
        };
    }

    /**
     * Compare new invoice behavior against DNA profile
     */
    calculateDNADeviation(invoice, profile) {
        if (!profile) return { dnaDeviationScore: 0, behavioralDriftFlag: false };

        const invAmount = parseFloat(invoice.invoice_amount) || 0;
        const amountDiff = Math.abs(invAmount - profile.avgAmount) / profile.stdDev;

        // Anomaly if amount is > 3 standard deviations from DNA
        const drift = amountDiff > 3;
        const deviationScore = Math.min(100, Math.round(amountDiff * 20));

        return {
            dnaDeviationScore: deviationScore,
            behavioralDriftFlag: drift,
            differenceFactor: parseFloat(amountDiff.toFixed(2))
        };
    }
}

if (typeof window !== 'undefined') {
    window.DNAEngine = DNAEngine;
}
