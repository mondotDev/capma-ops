import { AmcBucketWorkspace } from "@/components/amc-bucket-workspace";

export default async function BucketPage({
  params
}: {
  params: Promise<{ clientId: string; bucketId: string }>;
}) {
  const { bucketId, clientId } = await params;

  return <AmcBucketWorkspace bucketId={bucketId} clientId={clientId} />;
}
