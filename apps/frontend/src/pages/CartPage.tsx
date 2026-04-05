import type { ReactNode } from "react";

type CartPageProps = {
  children: ReactNode;
};

export function CartPage({ children }: CartPageProps): JSX.Element {
  return <section>{children}</section>;
}
