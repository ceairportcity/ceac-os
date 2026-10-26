import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import FinanceRequestQueue from "../components/FinanceRequestQueue";
import { Skeleton, StatePanel } from "../experience-v2/components";
import {
  FinanceCurrencyCard,
  FinanceEmpty,
  FinanceFootnote,
  FinancePageHeader,
  FinanceRecordRow,
  FinanceSection,
} from "../experience-v2/finance-family/FinanceFamilyV2";

const money = (minor, currency) => (currency || "GHS") + " " + (Number(minor || 0) / 100).toLocaleString("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function totals(rows) {
  const out = {};
  rows.forEach((row) => {
    const currency = row.currency || "GHS";
    out[currency] = (out[currency] || 0) + Number(row.amount_minor || 0);
  });
  return out;
}

export default function ExecutiveFinance({ me }) {
  const [requests, setRequests] = useState([]);
  const [income, setIncome] = useState([]);
  const [spend, setSpend] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.org_id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [requestResult, incomeResult, spendResult, budgetResult] = await Promise.all([
        supabase.from("finance_requests").select("id,amount_minor,currency,state,unit_id,units(name)").eq("org_id", me.org_id).order("created_at", { ascending: false }).limit(250),
        supabase.from("income_lines").select("id,amount_minor,currency,received_on,reverses_id").eq("org_id", me.org_id).order("received_on", { ascending: false }).limit(400),
        supabase.from("spend_lines").select("id,amount_minor,currency,unit_id,units(name),spent_on,reverses_id").eq("org_id", me.org_id).order("spent_on", { ascending: false }).limit(400),
        supabase.from("budgets").select("id,amount_minor,currency,unit_id,project_id,units(name)").eq("org_id", me.org_id),
      ]);
      const firstError = [requestResult.error, incomeResult.error, spendResult.error, budgetResult.error].find(Boolean);
      if (firstError) throw firstError;
      setRequests(requestResult.data || []);
      setIncome(incomeResult.data || []);
      setSpend(spendResult.data || []);
      setBudgets(budgetResult.data || []);
    } catch (loadError) {
      setError(humanError(loadError, "Finance could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const incomeTotals = useMemo(
    () => totals(income.map((row) => ({
      ...row,
      amount_minor: row.reverses_id ? -Number(row.amount_minor || 0) : Number(row.amount_minor || 0),
    }))),
    [income],
  );
  const budgetTotals = useMemo(() => totals(budgets), [budgets]);
  const spendTotals = useMemo(
    () => totals(spend.map((row) => ({
      ...row,
      amount_minor: row.reverses_id ? -Number(row.amount_minor || 0) : Number(row.amount_minor || 0),
    }))),
    [spend],
  );
  const currencies = useMemo(
    () => Array.from(new Set([
      ...Object.keys(incomeTotals),
      ...Object.keys(budgetTotals),
      ...Object.keys(spendTotals),
      ...requests.filter((row) => row.state === "submitted").map((row) => row.currency || "GHS"),
    ])).sort(),
    [incomeTotals, budgetTotals, spendTotals, requests],
  );
  const submittedByCurrency = useMemo(() => {
    const out = {};
    requests.filter((row) => row.state === "submitted").forEach((row) => {
      const currency = row.currency || "GHS";
      out[currency] = (out[currency] || 0) + 1;
    });
    return out;
  }, [requests]);
  const byUnit = useMemo(() => {
    const out = {};
    spend.forEach((row) => {
      const currency = row.currency || "GHS";
      const unitName = row.units?.name || "Unassigned";
      const amount = row.reverses_id ? -Number(row.amount_minor || 0) : Number(row.amount_minor || 0);
      out[currency] = out[currency] || {};
      out[currency][unitName] = (out[currency][unitName] || 0) + amount;
    });
    return out;
  }, [spend]);
  const unitSpendRows = useMemo(
    () => Object.entries(byUnit)
      .flatMap(([currency, units]) => Object.entries(units).map(([unitName, amount]) => ({ currency, unitName, amount })))
      .sort((a, b) => a.currency.localeCompare(b.currency) || a.unitName.localeCompare(b.unitName)),
    [byUnit],
  );

  const statusLabel = loading
    ? "Loading records"
    : error
      ? "Context unavailable"
      : currencies.length
        ? `${currencies.length} ${currencies.length === 1 ? "currency" : "currencies"} recorded`
        : "No position recorded";

  return (
    <div className="body ev2-finance-page ev2-finance-executive">
      <FinancePageHeader
        eyebrow="Executive insight"
        title="Finance"
        description="Review income, spending and requests awaiting your decision. Each currency stays separate."
        statusLabel={statusLabel}
        statusTone={error ? "danger" : "neutral"}
      />

      <div className="ev2fin-executive-brief">
        <div className="ev2fin-authority">
          <FinanceRequestQueue me={me} authority="exec" title="Requests needing Group Pastor" />
        </div>

        <div className="ev2fin-executive-position">
          {loading ? (
            <div className="ev2fin-loading" aria-label="Loading financial context" aria-busy="true">
              <Skeleton variant="block" height="8rem" />
              <Skeleton variant="block" height="12rem" />
            </div>
          ) : error ? (
            <div className="ev2fin-state">
              <StatePanel
                state="error"
                title="Financial context could not be loaded"
                description="No budget, spend or request totals are being shown because the current records could not be retrieved."
                actionLabel="Try again"
                onAction={load}
                icon="finance"
              />
            </div>
          ) : (
            <FinanceSection
              eyebrow="Recorded context"
              title="Financial context by currency"
              description="Compare income, budget and spending in each recorded currency."
            >
              <div className="ev2fin-card-grid">
                {currencies.length === 0 ? (
                  <FinanceEmpty
                    title="No financial context recorded yet"
                    description="Budget, spend and request records will build this leadership view when they exist."
                  />
                ) : null}
                {currencies.map((currency) => {
                  const hasBudget = budgets.some((budget) => (budget.currency || "GHS") === currency);
                  return (
                    <FinanceCurrencyCard
                      key={currency}
                      currency={currency}
                      contextLabel="No currency conversion"
                      facts={[
                        { label: "Received", value: money(incomeTotals[currency] || 0, currency), detail: "Reversal-aware recorded income" },
                        { label: "Actual spend", value: money(spendTotals[currency] || 0, currency) },
                        {
                          label: "Budget recorded",
                          value: hasBudget ? money(budgetTotals[currency] || 0, currency) : "Not recorded",
                          detail: hasBudget ? null : "No budget recorded for this currency",
                        },
                        { label: "Submitted requests", value: String(submittedByCurrency[currency] || 0), detail: "Organisation requests still submitted" },
                      ]}
                    />
                  );
                })}
              </div>
            </FinanceSection>
          )}
        </div>
      </div>

      {!loading && !error ? (
        <>
          <FinanceSection
            eyebrow="Units"
            title="Recorded spend by unit"
            description="See spending by department and currency. Reversed entries are accounted for."
          >
            {unitSpendRows.length === 0 ? (
              <FinanceEmpty
                title="No unit spend recorded yet"
                description="Recorded spend will appear here by unit and currency when it exists."
              />
            ) : (
              <div className="ev2fin-list">
                {unitSpendRows.map((row) => (
                  <FinanceRecordRow
                    key={`${row.currency}:${row.unitName}`}
                    eyebrow={row.currency}
                    title={row.unitName}
                    meta={`${money(row.amount, row.currency)} recorded spend`}
                    note="Reversal-aware recorded spend."
                  />
                ))}
              </div>
            )}
          </FinanceSection>

          <FinanceFootnote>
            Recorded income minus recorded spend is not a bank balance. CEAC OS does not convert currencies or infer opening balances or unrecorded activity. Requests remain distinct from actual spend.
          </FinanceFootnote>
        </>
      ) : null}
    </div>
  );
}
