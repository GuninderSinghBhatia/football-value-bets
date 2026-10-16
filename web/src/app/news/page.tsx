import { AccountsPanel, NewsFeed } from "@/components/news/news-view";
import { XAccountsProvider } from "@/components/news/x-accounts";
import { PageColumns } from "@/components/shell/page-columns";

export const metadata = { title: "News · BetMind" };

export default function NewsPage() {
  return (
    <XAccountsProvider>
      <PageColumns right={<AccountsPanel />}>
        <h1 className="sr-only">Team news from X</h1>
        <NewsFeed />
      </PageColumns>
    </XAccountsProvider>
  );
}
