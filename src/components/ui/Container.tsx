import { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1150px] px-6 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}
