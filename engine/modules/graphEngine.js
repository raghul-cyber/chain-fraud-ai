/**
 * Graph Centrality Risk Scoring
 * Identifies systemic importance of nodes in the supply chain network.
 */

class GraphEngine {
    constructor(nodes, edges) {
        this.nodes = nodes;
        this.edges = edges;
        this.centralityData = {};
        this._precomputeCentrality();
    }

    _precomputeCentrality() {
        // Simple Degree Centrality (normalized)
        const inDegree = {};
        const outDegree = {};
        this.nodes.forEach(n => { inDegree[n.id] = 0; outDegree[n.id] = 0; });

        this.edges.forEach(e => {
            if (outDegree[e.source] !== undefined) outDegree[e.source]++;
            if (inDegree[e.target] !== undefined) inDegree[e.target]++;
        });

        const maxDegree = Math.max(...Object.values(inDegree), ...Object.values(outDegree), 1);

        this.nodes.forEach(n => {
            const degree = (inDegree[n.id] + outDegree[n.id]) / maxDegree;

            // Simulating PageRank/Betweenness for complexity
            const pseudoPageRank = (inDegree[n.id] * 1.5 + outDegree[n.id] * 0.5) / maxDegree;

            this.centralityData[n.id] = {
                degreeCentrality: degree,
                influenceScore: pseudoPageRank,
                systemicImpactFactor: degree > 0.7 ? 'CRITICAL' : (degree > 0.4 ? 'HIGH' : 'NORMAL')
            };
        });
    }

    calculateGraphCentralityRisk(nodeId) {
        const data = this.centralityData[nodeId] || { degreeCentrality: 0, influenceScore: 0, systemicImpactFactor: 'NORMAL' };

        // High centrality + systemic impact = higher risk multiplier
        const graphRiskScore = Math.round(data.degreeCentrality * 100);

        return {
            graphRiskScore,
            influenceScore: parseFloat(data.influenceScore.toFixed(2)),
            systemicImpactFactor: data.systemicImpactFactor,
            degreeCentrality: parseFloat(data.degreeCentrality.toFixed(2))
        };
    }
}

if (typeof window !== 'undefined') {
    window.GraphEngine = GraphEngine;
}
