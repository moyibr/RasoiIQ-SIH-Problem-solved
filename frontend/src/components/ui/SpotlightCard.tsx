'use client';

export default function SpotlightCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div
      className={"relative overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm " + className}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
