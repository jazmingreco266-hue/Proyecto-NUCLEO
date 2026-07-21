import { FileText, ListChecks, Calculator, FolderKanban } from "lucide-react";

const items = [
  { icon: FileText, label: "Manual de atención" },
  { icon: ListChecks, label: "Proceso de facturación" },
  { icon: Calculator, label: "Cotizador de obra" },
  { icon: FolderKanban, label: "Plantillas de RRHH" },
];

export function PortalMockup() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-6 -z-10 rounded-[28px] bg-offwhite sm:-inset-10"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(16,16,18,0.04)]">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <span className="h-2.5 w-2.5 rounded-full bg-line" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" aria-hidden="true" />
          <span className="ml-3 text-[13px] text-ink-soft">portal.tuempresa.com</span>
        </div>

        <div className="grid grid-cols-[auto_1fr]">
          <div className="hidden w-40 flex-col gap-1 border-r border-line p-4 sm:flex">
            <div className="mb-3 h-2 w-16 rounded-full bg-ink/80" aria-hidden="true" />
            {["Manuales", "Procesos", "Plantillas", "Calculadoras"].map((label, i) => (
              <div
                key={label}
                className={`rounded-md px-3 py-2 text-[13px] ${
                  i === 0 ? "bg-accent-soft text-accent" : "text-ink-soft"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            <div className="mb-4 h-2.5 w-28 rounded-full bg-ink/10" aria-hidden="true" />
            <div className="grid grid-cols-2 gap-3">
              {items.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col gap-3 rounded-xl border border-line p-4"
                >
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.5} />
                  <div className="space-y-1.5">
                    <div className="text-[13px] font-medium text-ink">{label}</div>
                    <div className="h-1.5 w-3/4 rounded-full bg-ink/10" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
