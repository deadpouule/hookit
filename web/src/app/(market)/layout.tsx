import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="app-main-pad flex-1 bg-background">{children}</main>
      <MobileBottomNav />
    </>
  );
}
