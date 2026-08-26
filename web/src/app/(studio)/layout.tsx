import { HomeNav } from "@/components/home/market/HomeNav";
import { HomeTicker } from "@/components/home/market/HomeTicker";
import { StatusBar } from "@/components/home/market/StatusBar";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-black">
      <HomeTicker />
      <HomeNav />
      <main className="flex-1 bg-black pb-12">{children}</main>
      <StatusBar />
    </div>
  );
}
