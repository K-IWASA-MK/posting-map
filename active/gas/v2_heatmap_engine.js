// ==============================
// Phase 16: Heatmap Visualization OS
// ==============================

function generateHeatmap(branchId, tenantId = "DEFAULT") {
  const strategy = generateStrategy(branchId, tenantId).map;

  return strategy.map(block => {
    let color = "blue"; // 完了 / 低優先

    if (block.opportunityScore > 0.7) color = "red";       // 最優先攻撃エリア
    else if (block.opportunityScore > 0.4) color = "yellow"; // 中優先

    return {
      blockId: block.blockId,
      name: block.name,
      score: block.opportunityScore,
      color: color
    };
  });
}
