export function Eyebrow({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.08em] text-accent">
      <span className="h-px w-6 bg-accent" aria-hidden="true" />
      {children}
    </span>
  );
}
