import { ActionView } from "@/components/action-view";

export default async function ActionPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string; focus?: string; issue?: string; eventGroup?: string; dueDate?: string; q?: string }>;
}) {
  const params = await searchParams;

  return (
    <ActionView
      initialDueDate={params.dueDate}
      initialEventGroup={params.eventGroup}
      initialFilter={params.filter}
      initialFocus={params.focus}
      initialIssue={params.issue}
      initialQuery={params.q}
    />
  );
}
