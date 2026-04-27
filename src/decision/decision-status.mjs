export const DECISION_STATUS = {
  APPLY: "APPLY",
  APPLY_ONLY_IF_CLARIFIED: "APPLY_ONLY_IF_CLARIFIED",
  DISCARD: "DISCARD",
  REVIEW: "REVIEW"
};

const DECISION_LABELS_ES = {
  [DECISION_STATUS.APPLY]: "APLICAR",
  [DECISION_STATUS.APPLY_ONLY_IF_CLARIFIED]: "SOLO SI ACLARAN X",
  [DECISION_STATUS.DISCARD]: "DESCARTAR",
  [DECISION_STATUS.REVIEW]: "REVISAR"
};

export function decisionLabelEs(status) {
  return DECISION_LABELS_ES[status] || status || "";
}

export function deriveDecision({ totalScore, thresholds, openQuestions, hardFilterStatus }) {
  if (hardFilterStatus) {
    return hardFilterStatus;
  }

  if (totalScore >= thresholds.apply && !openQuestions) {
    return DECISION_STATUS.APPLY;
  }
  if (totalScore >= thresholds.clarify) {
    return DECISION_STATUS.APPLY_ONLY_IF_CLARIFIED;
  }
  return DECISION_STATUS.DISCARD;
}
