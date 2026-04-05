import type { ReactNode } from "react";

type CheckoutPageProps = {
  children: ReactNode;
};

export function CheckoutPage({ children }: CheckoutPageProps): JSX.Element {
  return <section className="flex flex-col gap-6">{children}</section>;
}
