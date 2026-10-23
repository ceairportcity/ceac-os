// One annual allowance and ONE shared sick/study allowance. Never give every
// covered request type its own nine days or silently cap protected leave.
export function confirmedLeaveSplitRules(existingRules = []) {
  const retained = existingRules.filter((rule) => !["annual", "shared_other", "sick", "study"].includes(rule.leave_kind));
  const rule = (leave_kind, entitlement_amount, accrual_rate) => ({
    leave_kind, employment_type: null, entitlement_amount, entitlement_unit: "days",
    accrual_method: "quarterly", accrual_rate, carryover_method: "none",
    carryover_limit: null, approval_route: "manager_then_admin", opening_balance_required: false,
  });
  return [...retained, rule("annual", 15, 3.75), rule("shared_other", 9, 2.25)];
}

export function leavePoolLabel(kind) {
  return kind === "shared_other" ? "Shared sick/study allowance" : null;
}

export function hasConfirmedLeaveSplit(rules) {
  return rules.some((rule) => rule.leave_kind === "annual" && rule.complete && Number(rule.entitlement_amount) === 15 && Number(rule.accrual_rate) === 3.75)
    && rules.some((rule) => rule.leave_kind === "shared_other" && rule.complete && Number(rule.entitlement_amount) === 9 && Number(rule.accrual_rate) === 2.25);
}
