const { faker } = require('@faker-js/faker');

// Configuration
const NUM_SUPPLIERS = 50;
const NUM_BUYERS = 10;
const NUM_LENDERS = 3;
const NUM_INVOICES = 500;

function generateSuppliers() {
    const suppliers = [];
    for (let i = 1; i <= NUM_SUPPLIERS; i++) {
        const id = `SUP-${i.toString().padStart(3, '0')}`;
        const tier = faker.helpers.arrayElement([1, 2, 3]);
        
        let multiplier = 1;
        if (tier === 1) multiplier = 10;
        if (tier === 2) multiplier = 5;

        suppliers.push({
            supplier_id: id,
            tier_level: tier,
            annual_revenue: faker.number.int({ min: 1000000 * multiplier, max: 10000000 * multiplier }),
            monthly_production_capacity: faker.number.int({ min: 5000 * multiplier, max: 50000 * multiplier }),
            historical_avg_invoice_amount: faker.number.int({ min: 50000 * multiplier, max: 500000 * multiplier }),
            historical_invoice_frequency: faker.number.int({ min: 1, max: 20 }),
            default_history_flag: faker.number.float() > 0.95 ? 1 : 0 // 5% chance of default history
        });
    }
    return suppliers;
}

function generateInvoices(suppliers) {
    const buyers = Array.from({ length: NUM_BUYERS }, (_, i) => `BUY-${(i + 1).toString().padStart(3, '0')}`);
    const lenders = Array.from({ length: NUM_LENDERS }, (_, i) => `LND-${(i + 1).toString().padStart(3, '0')}`);
    
    const invoices = [];
    for (let i = 1; i <= NUM_INVOICES; i++) {
        const supplier = faker.helpers.arrayElement(suppliers);
        const buyer = faker.helpers.arrayElement(buyers);
        const isFinanced = faker.number.float() > 0.4 ? 1 : 0;
        
        const invoice_amount = faker.number.int({ 
            min: supplier.historical_avg_invoice_amount * 0.5, 
            max: supplier.historical_avg_invoice_amount * 1.5 
        });
        const unit_price = faker.number.int({ min: 100, max: 5000 });
        const units_supplied = Math.round(invoice_amount / unit_price);

        // Inject some anomalies for the fraud engine
        const anomalyChance = faker.number.float();
        let amount = invoice_amount;
        if (anomalyChance > 0.95) {
            amount = amount * faker.number.float({ min: 3, max: 5 }); // Sudden spike anomaly
        }

        const date = faker.date.recent({ days: 90 });
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + faker.helpers.arrayElement([30, 45, 60, 90]));

        invoices.push({
            invoice_id: `INV-2024-${i.toString().padStart(4, '0')}`,
            supplier_id: supplier.supplier_id,
            buyer_id: buyer,
            tier_level: supplier.tier_level,
            invoice_amount: amount,
            invoice_date: date.toISOString().split('T')[0],
            due_date: dueDate.toISOString().split('T')[0],
            po_id: `PO-${faker.string.alphanumeric(8).toUpperCase()}`,
            units_supplied: units_supplied,
            unit_price: unit_price,
            financed_flag: isFinanced,
            lender_id: isFinanced ? faker.helpers.arrayElement(lenders) : null
        });
    }
    return invoices;
}

function generatePayments(invoices) {
    const payments = [];
    for (const inv of invoices) {
        // Most payments match perfectly. Some are shortfalls, some are non-payments.
        let actual_payment = inv.invoice_amount;
        const roll = faker.number.float();
        
        if (roll > 0.95) {
            // Unpaid
            actual_payment = 0;
        } else if (roll > 0.85) {
            // Partial payment
            actual_payment = Math.round(inv.invoice_amount * faker.number.float({ min: 0.1, max: 0.9 }));
        }

        payments.push({
            invoice_id: inv.invoice_id,
            expected_payment: inv.invoice_amount,
            actual_payment: actual_payment
        });
    }
    return payments;
}

function generateGraph(suppliers, invoices) {
    const nodesMap = new Map();
    const edges = [];

    // Add suppliers
    suppliers.forEach(s => {
        nodesMap.set(s.supplier_id, {
            id: s.supplier_id,
            label: s.supplier_id,
            type: "supplier",
            tier: s.tier_level
        });
    });

    // Add buyers and lenders from invoices, and create edges
    invoices.forEach(inv => {
        if (!nodesMap.has(inv.buyer_id)) {
            nodesMap.set(inv.buyer_id, {
                id: inv.buyer_id,
                label: inv.buyer_id,
                type: "buyer"
            });
        }
        
        edges.push({
            source: inv.supplier_id,
            target: inv.buyer_id,
            type: "supplies"
        });

        if (inv.financed_flag && inv.lender_id) {
            if (!nodesMap.has(inv.lender_id)) {
                nodesMap.set(inv.lender_id, {
                    id: inv.lender_id,
                    label: inv.lender_id,
                    type: "lender"
                });
            }
            edges.push({
                source: inv.lender_id,
                target: inv.supplier_id,
                type: "finances"
            });
        }
    });

    // Add some random circular edges to trigger circular trade detection rules
    for (let i = 0; i < 5; i++) {
        const t1 = faker.helpers.arrayElement(suppliers).supplier_id;
        const t2 = faker.helpers.arrayElement(suppliers).supplier_id;
        const t3 = faker.helpers.arrayElement(suppliers).supplier_id;
        
        if (t1 !== t2 && t2 !== t3 && t1 !== t3) {
            edges.push({ source: t1, target: t2, type: "supplies" });
            edges.push({ source: t2, target: t3, type: "supplies" });
            edges.push({ source: t3, target: t1, type: "supplies" }); // The cycle
        }
    }

    return {
        nodes: Array.from(nodesMap.values()),
        edges: edges
    };
}

function generateAllMockData() {
    const suppliers = generateSuppliers();
    const invoices = generateInvoices(suppliers);
    const payments = generatePayments(invoices);
    const graph = generateGraph(suppliers, invoices);

    return {
        suppliers,
        invoices,
        payments,
        graph
    };
}

module.exports = {
    generateAllMockData
};
