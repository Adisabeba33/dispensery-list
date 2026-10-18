import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  TerritoryShopPage,
  territoryShopBySlug,
  territoryShopMetadata,
  territoryShopParams,
} from '@/components/TerritoryShopPage';

/** One shop whose shelf has been read, and that shelf (src/components/TerritoryShopPage). */
type Params = { params: Promise<{ slug: string }> };

const TERRITORY = 'long-island';

export const dynamicParams = false;
export const generateStaticParams = () => territoryShopParams(TERRITORY);

export const generateMetadata = async ({ params }: Params): Promise<Metadata> =>
  territoryShopMetadata(TERRITORY, (await params).slug);

export default async function LongIslandShopPage({ params }: Params) {
  const d = territoryShopBySlug(TERRITORY, (await params).slug);
  if (!d) notFound();
  return <TerritoryShopPage id={TERRITORY} d={d} />;
}
