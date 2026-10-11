import { PageColumns } from "@/components/shell/page-columns";
import { Card, EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "Settings · BetMind" };

export default function SettingsPage() {
  return (
    <PageColumns>
      <h1 className="text-xl font-semibold">Settings</h1>
      <Card>
        <EmptyState title="Nothing to configure yet" hint="Settings arrive once the backend is connected." />
      </Card>
    </PageColumns>
  );
}
