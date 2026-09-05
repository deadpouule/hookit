import { SiteHeader } from "@/components/home/market/SiteHeader";
import { StatusBar } from "@/components/home/market/StatusBar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <SiteHeader />
      <main className="app-main-pad flex-1 bg-background">{children}</main>
      <StatusBar />
      <MobileBottomNav />
    </div>
  );
}
