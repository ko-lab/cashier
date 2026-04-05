import type { ReactNode } from "react";

type AdminPageProps = {
  children: ReactNode;
};

export function AdminPage({ children }: AdminPageProps): JSX.Element {
  return (
    <section className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      {children}
    </section>
  );
}
