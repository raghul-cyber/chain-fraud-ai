/**
 * ERPConnector Mock Layer
 * Simulates integration with ERP systems (SAP, Oracle, NetSuite)
 * Returns PO, GRN, and delivery data for reconciliation.
 */

class ERPConnector {
    constructor(invoices) {
        this.invoices = invoices;
        this.poStore = {};
        this.grnStore = {};

        this._initializeMockData();
    }

    _initializeMockData() {
        // Generate mock POs and GRNs for each invoice to ensure reconciliation engine has data
        this.invoices.forEach(inv => {
            const poId = inv.po_id || `PO-INTERNAL-${inv.invoice_id}`;
            const amount = parseFloat(inv.invoice_amount) || 0;
            const quantity = parseFloat(inv.units_supplied) || 0;

            // Mock PO: Sometimes matches, sometimes mismatches (for fraud detection)
            // 5% chance of mismatch for demo purposes
            const poMismatch = Math.random() < 0.05;
            this.poStore[poId] = {
                po_id: poId,
                amount: poMismatch ? amount * 0.8 : amount * (1 + Math.random() * 0.2),
                currency: 'INR',
                supplier_id: inv.supplier_id,
                status: 'RELEASED'
            };

            // Mock GRN: Sometimes matches, sometimes mismatches
            const grnMismatch = Math.random() < 0.05;
            this.grnStore[poId] = {
                po_id: poId,
                received_quantity: grnMismatch ? quantity * 0.7 : quantity,
                rejected_quantity: 0,
                delivery_date: inv.invoice_date,
                quality_check: 'PASSED'
            };
        });
    }

    async getPO(poId) {
        // Simulate network latency
        return new Promise(resolve => {
            setTimeout(() => resolve(this.poStore[poId] || null), 10);
        });
    }

    async getGRN(poId) {
        return new Promise(resolve => {
            setTimeout(() => resolve(this.grnStore[poId] || null), 10);
        });
    }

    async getDeliveryConfirmation(invoiceId) {
        return {
            invoice_id: invoiceId,
            status: 'DELIVERED',
            hash: '0x' + Math.random().toString(16).slice(2, 10) + '...'
        };
    }
}

if (typeof window !== 'undefined') {
    window.ERPConnector = ERPConnector;
}
