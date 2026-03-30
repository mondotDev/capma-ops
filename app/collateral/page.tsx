import { CollateralView } from "@/components/collateral-view";

export default async function CollateralPage({
  searchParams
}: {
  searchParams: Promise<{
    collateralId?: string;
    eventInstanceId?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <CollateralView
      initialEventInstanceId={params.eventInstanceId}
      initialSelectedCollateralId={params.collateralId}
    />
  );
}
