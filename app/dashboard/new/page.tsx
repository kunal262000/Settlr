'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import type { ColumnMapping, DetectedColumn, Marketplace } from '@/lib/types';
import { MARKETPLACES } from '@/lib/types';

interface UploadResult {
  fileName: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
  detected: DetectedColumn[];
  suggestedMapping: ColumnMapping;
}

type StepId = 'marketplace' | 'upload' | 'mapping' | 'running';

export default function NewReconciliationPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>('marketplace');
  const [marketplace, setMarketplace] = useState<Marketplace>('meesho');

  const [settlement, setSettlement] = useState<UploadResult | null>(null);
  const [sales, setSales] = useState<UploadResult | null>(null);
  const [settlementMapping, setSettlementMapping] = useState<ColumnMapping>({});
  const [salesMapping, setSalesMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto">
      <Stepper current={step} />

      {error && (
        <div className="mt-6 rounded-xl bg-error-bg text-error text-sm p-4">{error}</div>
      )}

      {step === 'marketplace' && (
        <MarketplaceStep
          marketplace={marketplace}
          onSelect={setMarketplace}
          onNext={() => setStep('upload')}
        />
      )}

      {step === 'upload' && (
        <UploadStep
          marketplace={marketplace}
          settlement={settlement}
          sales={sales}
          onSettlement={(r) => {
            setSettlement(r);
            setSettlementMapping(r.suggestedMapping);
          }}
          onSales={(r) => {
            setSales(r);
            setSalesMapping(r.suggestedMapping);
          }}
          onError={setError}
          onBack={() => setStep('marketplace')}
          onNext={() => setStep('mapping')}
        />
      )}

      {step === 'mapping' && settlement && sales && (
        <MappingStep
          settlement={settlement}
          sales={sales}
          settlementMapping={settlementMapping}
          salesMapping={salesMapping}
          setSettlementMapping={setSettlementMapping}
          setSalesMapping={setSalesMapping}
          onBack={() => setStep('upload')}
          onRun={async () => {
            setError(null);
            setStep('running');
            try {
              const res = await fetch('/api/reconcile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  marketplace,
                  settlementFileName: settlement.fileName,
                  settlementRows: settlement.rows,
                  settlementMapping,
                  salesFileName: sales.fileName,
                  salesRows: sales.rows,
                  salesMapping,
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(
                  data.upgradeRequired
                    ? `${data.error} — visit Billing to upgrade.`
                    : data.error ?? 'Reconciliation failed.'
                );
                setStep('mapping');
                return;
              }
              router.push(`/dashboard/jobs/${data.jobId}`);
            } catch (err) {
              setError((err as Error).message);
              setStep('mapping');
            }
          }}
        />
      )}

      {step === 'running' && (
        <Card className="mt-6 p-12 text-center">
          <p className="text-navy font-medium">Reconciling your orders…</p>
          <p className="text-sm text-ink-muted mt-2">This usually takes a few seconds.</p>
        </Card>
      )}
    </div>
  );
}

function Stepper({ current }: { current: StepId }) {
  const steps: { id: StepId; label: string }[] = [
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'upload', label: 'Upload' },
    { id: 'mapping', label: 'Column Mapping' },
    { id: 'running', label: 'Reconcile' },
  ];
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 flex-1">
          <div
            className={`h-2 rounded-full flex-1 ${i <= currentIndex ? 'bg-teal' : 'bg-border'}`}
          />
        </div>
      ))}
      <span className="ml-3 text-xs text-ink-muted whitespace-nowrap">{steps[currentIndex]?.label}</span>
    </div>
  );
}

function MarketplaceStep({
  marketplace,
  onSelect,
  onNext,
}: {
  marketplace: Marketplace;
  onSelect: (m: Marketplace) => void;
  onNext: () => void;
}) {
  return (
    <Card className="mt-6 p-8">
      <h2 className="text-lg font-semibold text-navy">Select marketplace</h2>
      <p className="text-sm text-ink-muted mt-1">Reconcile settlements from any of your marketplaces.</p>
      <div className="mt-6 grid sm:grid-cols-3 gap-3">
        {MARKETPLACES.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`rounded-xl border-2 p-5 text-left transition-colors ${
              marketplace === m.id ? 'border-teal bg-teal-soft/40' : 'border-border hover:border-navy/20'
            }`}
          >
            <p className="font-medium text-navy">{m.label}</p>
            <p className="text-xs text-ink-muted mt-1">{marketplace === m.id ? 'Selected' : 'Ready'}</p>
          </button>
        ))}
      </div>
      <Button className="mt-8" onClick={onNext}>Continue</Button>
    </Card>
  );
}

function UploadStep({
  marketplace,
  settlement,
  sales,
  onSettlement,
  onSales,
  onError,
  onBack,
  onNext,
}: {
  marketplace: Marketplace;
  settlement: UploadResult | null;
  sales: UploadResult | null;
  onSettlement: (r: UploadResult) => void;
  onSales: (r: UploadResult) => void;
  onError: (e: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const marketplaceLabel = MARKETPLACES.find((m) => m.id === marketplace)?.label ?? marketplace;
  return (
    <div className="mt-6 space-y-4">
      <FileUploadCard
        title="Marketplace Settlement Report"
        description={`Your ${marketplaceLabel} settlement export (XLSX, XLS, or CSV).`}
        kind="settlement"
        marketplace={marketplace}
        result={settlement}
        onResult={onSettlement}
        onError={onError}
      />
      <FileUploadCard
        title="Seller Sales / Order Report"
        description="Your own sales register or order export (XLSX, XLS, or CSV)."
        kind="sales"
        result={sales}
        onResult={onSales}
        onError={onError}
      />
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button disabled={!settlement || !sales} onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}

function FileUploadCard({
  title,
  description,
  kind,
  marketplace,
  result,
  onResult,
  onError,
}: {
  title: string;
  description: string;
  kind: 'settlement' | 'sales';
  marketplace?: Marketplace;
  result: UploadResult | null;
  onResult: (r: UploadResult) => void;
  onError: (e: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    onError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      if (marketplace) form.append('marketplace', marketplace);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? 'Upload failed.');
        return;
      }
      onResult(data);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6">
      <h3 className="font-medium text-navy">{title}</h3>
      <p className="text-sm text-ink-muted mt-1">{description}</p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {!result ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="mt-4 w-full rounded-xl border-2 border-dashed border-border hover:border-teal py-8 text-sm text-ink-muted transition-colors"
        >
          {loading ? 'Reading file…' : 'Click to choose a file'}
        </button>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-bg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-ink">{result.fileName}</p>
            <p className="text-xs text-ink-muted mt-0.5">{result.rowCount.toLocaleString('en-IN')} rows detected</p>
          </div>
          <Button variant="ghost" className="!py-1.5 !px-3 text-xs" onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
        </div>
      )}
    </Card>
  );
}

function MappingStep({
  settlement,
  sales,
  settlementMapping,
  salesMapping,
  setSettlementMapping,
  setSalesMapping,
  onBack,
  onRun,
}: {
  settlement: UploadResult;
  sales: UploadResult;
  settlementMapping: ColumnMapping;
  salesMapping: ColumnMapping;
  setSettlementMapping: (m: ColumnMapping) => void;
  setSalesMapping: (m: ColumnMapping) => void;
  onBack: () => void;
  onRun: () => void;
}) {
  const settlementReady = !!settlementMapping.order_id;
  const salesReady = !!salesMapping.order_id;

  return (
    <div className="mt-6 space-y-6">
      <ColumnMappingTable
        title="Settlement report columns"
        fileName={settlement.fileName}
        columns={settlement.columns}
        detected={settlement.detected}
        mapping={settlementMapping}
        onChange={setSettlementMapping}
      />
      <ColumnMappingTable
        title="Sales report columns"
        fileName={sales.fileName}
        columns={sales.columns}
        detected={sales.detected}
        mapping={salesMapping}
        onChange={setSalesMapping}
      />
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button disabled={!settlementReady || !salesReady} onClick={onRun}>
          Run Reconciliation
        </Button>
      </div>
    </div>
  );
}

function ColumnMappingTable({
  title,
  fileName,
  columns,
  detected,
  mapping,
  onChange,
}: {
  title: string;
  fileName: string;
  columns: string[];
  detected: DetectedColumn[];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
}) {
  const confidenceLabel: Record<DetectedColumn['confidence'], string> = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence',
    none: 'Not detected — select manually',
  };

  return (
    <Card className="p-6">
      <h3 className="font-medium text-navy">{title}</h3>
      <p className="text-xs text-ink-muted mt-1">{fileName}</p>

      <div className="mt-4 divide-y divide-border">
        {detected.map((d) => (
          <div key={d.internalField} className="py-3 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-ink">
                {d.label}
                {d.required && <span className="text-error ml-1">*</span>}
              </p>
              <p className="text-xs text-ink-muted">{confidenceLabel[mapping[d.internalField] ? d.confidence : 'none']}</p>
            </div>
            <select
              value={mapping[d.internalField] ?? ''}
              onChange={(e) => {
                const next = { ...mapping };
                if (e.target.value) next[d.internalField] = e.target.value;
                else delete next[d.internalField];
                onChange(next);
              }}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm min-w-[180px]"
            >
              <option value="">— Not mapped —</option>
              {columns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </Card>
  );
}
