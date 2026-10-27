import { AppHeader } from "@/components/AppHeader";
import { Strategist } from "@/components/Strategist";

export default function Home() {
  return (
    <main className="page">
      <AppHeader />
      <div className="container">
        <Strategist />
      </div>
    </main>
  );
}
