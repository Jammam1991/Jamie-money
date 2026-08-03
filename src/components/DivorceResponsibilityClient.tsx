"use client";

import { Card, Tint } from "@/components/ui";

export default function DivorceResponsibilityClient() {
  return (
    <div className="space-y-4">
      {/* Header note */}
      <div className="rounded-2xl border border-border bg-tint p-4">
        <p className="text-[13px] text-muted">
          This is a framework for analyzing potential financial responsibility in a divorce scenario.
          Based on current assets and debts.
        </p>
      </div>

      {/* Debt Responsibility Section */}
      <Card>
        <p className="mb-4 text-[13px] font-medium text-muted">Debt Responsibility</p>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Jamie's Current Debt</p>
            <Tint>
              <p className="text-[13px] text-muted mb-1">Personal credit cards & loans</p>
              <p className="text-lg font-medium">$35,000</p>
              <p className="text-xs text-muted mt-1">
                Secured by Jamie — likely Jamie's responsibility
              </p>
            </Tint>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Jamie's Business Debt</p>
            <Tint>
              <p className="text-[13px] text-muted mb-1">Business loan & credit card</p>
              <p className="text-lg font-medium">$53,500</p>
              <p className="text-xs text-muted mt-1">
                Secured by Jamie's business — responsibility depends on business structure & separation
              </p>
            </Tint>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Joint Debt</p>
            <Tint>
              <p className="text-[13px] text-muted mb-1">Auto loan</p>
              <p className="text-lg font-medium">$86,000</p>
              <p className="text-xs text-muted mt-1">
                Joint responsibility — likely split based on asset/income division
              </p>
            </Tint>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Chris's Debt</p>
            <Tint>
              <p className="text-[13px] text-muted mb-1">
                Home equity, personal loans, credit cards, lines of credit
              </p>
              <p className="text-lg font-medium">$365,000</p>
              <p className="text-xs text-muted mt-1">
                Primarily Chris's responsibility — but home equity is tied to marital assets
              </p>
            </Tint>
          </div>
        </div>
      </Card>

      {/* Spending History Section */}
      <Card>
        <p className="mb-4 text-[13px] font-medium text-muted">Spending History</p>
        <p className="text-[13px] text-muted mb-4">
          5-6 years of financial history will inform asset/debt division. To be analyzed by legal counsel.
        </p>
        <Tint>
          <p className="text-[13px] text-muted">Sections for review:</p>
          <ul className="mt-2 space-y-1 text-[13px] text-muted">
            <li>• Monthly income by source (job, business, other)</li>
            <li>• Major spending categories & trends</li>
            <li>• Business income & expenses</li>
            <li>• Investment activity</li>
            <li>• Real estate purchases & refinancing</li>
            <li>• Significant one-time expenses</li>
          </ul>
          <p className="mt-3 text-xs italic text-muted">
            Chris will provide detailed spending records for analysis.
          </p>
        </Tint>
      </Card>

      {/* Summary Section */}
      <Card>
        <p className="mb-4 text-[13px] font-medium text-muted">Summary</p>
        <div className="space-y-3">
          <div className="pb-3 border-b border-border">
            <p className="text-[13px] text-muted mb-1">Jamie's clear personal responsibility</p>
            <p className="text-lg font-medium">$88,500</p>
            <p className="text-xs text-muted mt-1">
              Personal credit cards ($35k) + business debt ($53.5k)
            </p>
          </div>

          <div className="pb-3 border-b border-border">
            <p className="text-[13px] text-muted mb-1">Shared responsibility (requiring negotiation)</p>
            <p className="text-lg font-medium">$86,000</p>
            <p className="text-xs text-muted mt-1">
              Joint auto loan — split depends on asset division & income consideration
            </p>
          </div>

          <div>
            <p className="text-[13px] text-muted mb-1">Chris's primary responsibility</p>
            <p className="text-lg font-medium">$365,000</p>
            <p className="text-xs text-muted mt-1">
              Secured in Chris's name — though home equity tied to marital home
            </p>
          </div>
        </div>
      </Card>

      {/* Note */}
      <Card className="bg-tint">
        <p className="text-xs text-muted">
          <strong>This is not legal advice.</strong> Actual responsibility depends on:
          state law, how long debts existed before marriage, business structure,
          who benefited from the debt, marital property laws, and agreement between parties.
          Consult legal counsel for accurate division.
        </p>
      </Card>
    </div>
  );
}
