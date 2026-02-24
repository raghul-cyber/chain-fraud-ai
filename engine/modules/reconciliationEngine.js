/**
 * PO-GRN-Invoice Reconciliation Engine
 * Validates fiscal discipline across the supply chain document trail.
 */

class ReconciliationEngine {
    /**
     * @param {Object} invoice Current invoice object
     * @param {Object} po ERP Purchase Order record
     * @param {Object} grn ERP Goods Received Note record
     */
    calculateReconciliationScore(invoice, po, grn) {
        if (!po || !grn) {
            return {
                reconciliationScore: 0,
                mismatchPercentage: 100,
                toleranceFlag: true,
                reason: 'MISSING_DOCUMENTS'
            };
        }

        const invAmt = parseFloat(invoice.invoice_amount) || 0;
        const poAmt = parseFloat(po.amount) || 0;
        const invQty = parseFloat(invoice.units_supplied) || 0;
        const grnQty = parseFloat(grn.received_quantity) || 0;

        // Logic 1: Invoice Amount must be <= PO Amount
        const amtMismatch = invAmt > poAmt ? (invAmt - poAmt) / poAmt : 0;

        // Logic 2: Invoice Quantity must be <= GRN Quantity
        const qtyMismatch = invQty > grnQty ? (invQty - grnQty) / grnQty : 0;

        const maxMismatch = Math.max(amtMismatch, qtyMismatch);
        const mismatchPercentage = (maxMismatch * 100).toFixed(2);

        // Threshold: 5% tolerance
        const toleranceFlag = maxMismatch > 0.05;

        // Score 0-100: 100 means perfect match, 0 means high risk
        let score = 100 - (maxMismatch * 100 * 2);
        score = Math.max(0, Math.min(100, score));

        return {
            reconciliationScore: Math.round(score),
            mismatchPercentage: parseFloat(mismatchPercentage),
            toleranceFlag,
            details: {
                amtMismatch: (amtMismatch * 100).toFixed(2),
                qtyMismatch: (qtyMismatch * 100).toFixed(2)
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.ReconciliationEngine = ReconciliationEngine;
}
