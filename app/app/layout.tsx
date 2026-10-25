import { Suspense } from "react";
import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <AppNav />
      </Suspense>
      <main>{children}</main>
      <footer className="footer">
        <div className="wrap-wide">
          Data: MCX daily bhavcopy, gold futures. Settlement prices are exchange values, not guaranteed fills. Analysis only, not investment advice.
        </div>
      </footer>
    </>
  );
}
