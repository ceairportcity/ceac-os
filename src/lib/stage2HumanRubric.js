/**
 * Stage 2 owner-approved human-entered performance rubric.
 * Never calculates, predicts, averages, weights or ranks employee ratings.
 * Rating values and evidence selections MUST be entered by an authorised human
 * and validated again at the PostgreSQL authority boundary.
 */
export const HUMAN_RUBRIC_CATEGORIES = Object.freeze([
  { key: "delivery", label: "Delivery of responsibilities" },
  { key: "quality", label: "Quality of work" },
  { key: "reliability", label: "Ownership and reliability" },
  { key: "initiative", label: "Initiative and problem-solving" },
  { key: "collaboration", label: "Collaboration and contribution" },
]);
export const HUMAN_RATING_OPTIONS = Object.freeze([
  { value: "1", label: "1 — Below expectations" },
  { value: "2", label: "2 — Partially meets expectations" },
  { value: "3", label: "3 — Meets expectations" },
  { value: "4", label: "4 — Exceeds expectations" },
  { value: "5", label: "5 — Exceptional" },
  { value: "N/O", label: "N/O — Not observed / not applicable" },
]);
const RATING_VALUES = new Set(HUMAN_RATING_OPTIONS.map((v) => v.value));
const EVIDENCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function meaningful(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

export function blankHumanRubric() {
  return {
    categories: HUMAN_RUBRIC_CATEGORIES.map(({key}) => ({
      category: key, rating: "", explanation: "", evidenceIds: [],
    })),
    overallRating: "",
    overallNarrative: "",
    strengths: "",
    challenges: "",
    improvementActions: "",
    nextResponsibilities: "",
  };
}

/**
 * cadence 'monthly' explicitly allows no formal rating selection.
 * cadence 'quarterly' requires all 5 human-selected category judgments,
 * supporting evidence (except reasoned N/O) and separate overall judgment.
 * Returns only errors and a sanitized payload; DOES NOT derive a score.
 */
export function validateHumanRubric(payload, { cadence = "quarterly", allowNoMonthlyRatings = true } = {}) {
  const errors = [];
  if (!["monthly", "quarterly", "month", "quarter"].includes(cadence)) errors.push("Unsupported review cadence");
  if ((cadence === "monthly" || cadence === "month") && allowNoMonthlyRatings && (payload == null || payload === "")) {
    return { valid: errors.length === 0, errors, payload: null };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: [...errors, "Human-entered rubric is required"], payload: null };
  }
  if (!Array.isArray(payload.categories) || payload.categories.length !== 5) {
    return { valid:false, errors:[...errors, "Exactly five category judgments are required"], payload:null };
  }

  const distinct = new Set();
  const canonical = [];
  for (const category of HUMAN_RUBRIC_CATEGORIES) {
    const matching = payload.categories.filter((r) => r?.category === category.key);
    if (matching.length !== 1) {
      errors.push(`One judgment is required for ${category.label}`);
      continue;
    }
    const row = matching[0];
    distinct.add(row.category);
    if (!RATING_VALUES.has(row.rating)) errors.push(`Choose a human rating for ${category.label}`);
    if (!meaningful(row.explanation, 12, 1500)) errors.push(`Explain ${category.label} in 12–1,500 characters`);
    const evidence = row.evidenceIds;
    if (!Array.isArray(evidence) || evidence.length > 30 ||
        evidence.some((v) => typeof v !== "string" || !EVIDENCE_ID.test(v)) ||
        new Set(evidence).size !== evidence.length) {
      errors.push(`Choose valid, distinct evidence references for ${category.label}`);
    } else if (row.rating !== "N/O" && evidence.length === 0) {
      errors.push(`Select recorded evidence for ${category.label}, or use N/O with an explanation`);
    }
    canonical.push({
      category: category.key,
      rating: row.rating,
      explanation: String(row.explanation || "").trim(),
      evidenceIds: Array.isArray(evidence) ? [...evidence] : [],
    });
  }
  if (distinct.size !== 5) errors.push("Category judgments must be unique");
  if (!RATING_VALUES.has(payload.overallRating)) errors.push("Select the overall human judgment independently");
  for (const [key,label] of [
    ["overallNarrative", "Overall assessment narrative"],
    ["strengths", "Recorded strengths"],
    ["challenges", "Recorded challenges"],
    ["improvementActions", "Improvement actions"],
    ["nextResponsibilities", "Next responsibilities"],
  ]) {
    if (!meaningful(payload[key], 12, 3000)) errors.push(`${label} requires 12–3,000 characters`);
  }

  const normalized = errors.length ? null : {
    categories: canonical,
    overallRating: payload.overallRating,
    overallNarrative: payload.overallNarrative.trim(),
    strengths: payload.strengths.trim(),
    challenges: payload.challenges.trim(),
    improvementActions: payload.improvementActions.trim(),
    nextResponsibilities: payload.nextResponsibilities.trim(),
  };
  return { valid: errors.length === 0, errors, payload: normalized };
}

/** No AI-generated appraisal and no reviewer's self-approval. */
export function canHumanReview({ reviewerId, employeeId, caseReviewerId, caseOpen, cadence }) {
  return Boolean(reviewerId && employeeId && reviewerId !== employeeId &&
    reviewerId === caseReviewerId && caseOpen && ["monthly","quarterly","month","quarter"].includes(cadence));
}
