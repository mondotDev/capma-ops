import { ActionView } from "@/components/action-view";

export default async function ActionPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;

  return <ActionView initialFilter={params.filter} />;
}
