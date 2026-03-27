import { ActionView } from "@/components/action-view";

export default async function ActionPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string; focus?: string; issue?: string }>;
}) {
  const params = await searchParams;

  return (
    <ActionView
      initialFilter={params.filter}
      initialFocus={params.focus}
      initialIssue={params.issue}
    />
  );
}
