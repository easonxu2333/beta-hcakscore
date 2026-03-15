const CRITERION_KEYS = [
  'innovation',
  'technical_complexity',
  'design_ux',
  'impact_market',
  'presentation_demo',
];

function getDefaultSettings() {
  return {
    score_scale_min: 1,
    score_scale_max: 10,
    use_weighted_criteria: 1,
    use_judge_weights: 1,
    outlier_mode: 'average_all',
    comments_enabled: 1,
    finalist_nomination_enabled: 1,
    leaderboard_public: 1,
  };
}

function buildCriterionWeights(rows) {
  const weights = {};
  rows.forEach((row) => {
    weights[row.criterion_key] = Number(row.weight ?? 0);
  });
  return weights;
}

function getTotalFromCriteria(score) {
  return CRITERION_KEYS.reduce((sum, key) => sum + Number(score[key] || 0), 0);
}

function getWeightedCriteriaTotal(score, criterionWeights) {
  const totalWeight = CRITERION_KEYS.reduce((sum, key) => sum + Number(criterionWeights[key] || 0), 0) || 1;
  return CRITERION_KEYS.reduce((sum, key) => {
    return sum + Number(score[key] || 0) * (Number(criterionWeights[key] || 0) / totalWeight);
  }, 0);
}

function getDerivedScore(score, settings, criterionWeights, judgeWeight = 1) {
  const totalScore = getTotalFromCriteria(score);
  const criteriaWeightedTotal = settings.use_weighted_criteria
    ? getWeightedCriteriaTotal(score, criterionWeights)
    : totalScore;
  const weightedScore = settings.use_judge_weights
    ? criteriaWeightedTotal * Number(judgeWeight || 1)
    : criteriaWeightedTotal;

  return {
    totalScore,
    weightedScore,
  };
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function dropHighLow(values) {
  if (values.length < 3) return average(values);
  const sorted = [...values].sort((a, b) => a - b).slice(1, -1);
  return average(sorted);
}

function aggregateValues(values, mode) {
  if (!values.length) return null;
  switch (mode) {
    case 'median':
      return median(values);
    case 'drop_high_low':
      return dropHighLow(values);
    case 'weighted_average':
      return average(values);
    case 'average_all':
    default:
      return average(values);
  }
}

function computeLeaderboard(projects, scores, settings, criterionWeights) {
  const submittedScores = scores.filter((score) => !score.is_draft);

  return projects.map((project) => {
    const projectScores = submittedScores.filter((score) => score.project_id === project.id);
    const metricKey = settings.use_weighted_criteria || settings.use_judge_weights || settings.outlier_mode === 'weighted_average'
      ? 'weighted_score'
      : 'total_score';
    const metricValues = projectScores.map((score) => Number(score[metricKey] || 0));

    const aggregateScore = aggregateValues(metricValues, settings.outlier_mode);
    const criterionAverages = {};
    CRITERION_KEYS.forEach((key) => {
      criterionAverages[key] = average(projectScores.map((score) => Number(score[key] || 0)));
    });

    const finalistNominationCount = projectScores.filter((score) => score.finalist_nomination).length;
    const finalist = project.is_finalist || finalistNominationCount > 0;

    return {
      ...project,
      average_score: aggregateScore,
      submission_count: projectScores.length,
      finalist_nomination_count: finalistNominationCount,
      finalist,
      average_total_score: average(projectScores.map((score) => Number(score.total_score || 0))),
      average_weighted_score: average(projectScores.map((score) => Number(score.weighted_score || 0))),
      criterion_averages: criterionAverages,
    };
  }).sort((a, b) => {
    const scoreDiff = Number(b.average_score || -1) - Number(a.average_score || -1);
    if (scoreDiff !== 0) return scoreDiff;
    const tieBreakDiff = Number(b.tie_breaker_score || 0) - Number(a.tie_breaker_score || 0);
    if (tieBreakDiff !== 0) return tieBreakDiff;
    return a.name.localeCompare(b.name);
  }).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function computeWinners(leaderboard) {
  const ranked = leaderboard.filter((entry) => entry.average_score !== null);
  const overall = ranked[0] || null;
  const byTrack = {};

  ranked.forEach((entry) => {
    if (!byTrack[entry.track]) byTrack[entry.track] = entry;
  });

  const bestDesign = [...ranked].sort((a, b) => {
    return Number(b.criterion_averages.design_ux || 0) - Number(a.criterion_averages.design_ux || 0);
  })[0] || null;

  const bestTechnical = [...ranked].sort((a, b) => {
    return Number(b.criterion_averages.technical_complexity || 0) - Number(a.criterion_averages.technical_complexity || 0);
  })[0] || null;

  return {
    overall,
    byTrack,
    bestDesign,
    bestTechnical,
    audienceFavorite: null,
  };
}

module.exports = {
  CRITERION_KEYS,
  getDefaultSettings,
  buildCriterionWeights,
  getDerivedScore,
  computeLeaderboard,
  computeWinners,
};
