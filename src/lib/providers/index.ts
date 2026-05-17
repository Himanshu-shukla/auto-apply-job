import { MockJobProvider } from "@/lib/providers/mockJobProvider";
import { PublicCareerPageProvider } from "@/lib/providers/publicCareerPageProvider";
import { RSSJobProvider } from "@/lib/providers/rssJobProvider";
import { ManualImportProvider } from "@/lib/providers/manualJobImport";
import { PublicAPIProvider } from "@/lib/providers/publicApiProvider";
import { CompanyCareerPageProvider } from "@/lib/providers/companyCareerPageProvider";
import { DirectEmailJobProvider } from "@/lib/providers/directEmailJobProvider";
import { PartnerFeedProvider } from "@/lib/providers/partnerFeedProvider";
import { GreenhouseProvider } from "@/lib/providers/greenhouseProvider";
import { LeverProvider } from "@/lib/providers/leverProvider";
import { AshbyProvider } from "@/lib/providers/ashbyProvider";
import { getRestrictedPlatformProviders } from "@/lib/providers/restrictedPlatformProviders";
import type { JobProvider } from "@/lib/providers/types";

export function getJobProviders() {
  const providers: JobProvider[] = [
    new MockJobProvider(),
    new ManualImportProvider(),
    new RSSJobProvider(),
    new GreenhouseProvider(),
    new LeverProvider(),
    new AshbyProvider(),
    new PublicAPIProvider(),
    new PublicCareerPageProvider(),
    new CompanyCareerPageProvider(),
    new DirectEmailJobProvider(),
    new PartnerFeedProvider(),
    ...getRestrictedPlatformProviders()
  ];
  return providers.filter((provider) => provider.enabled !== false);
}

export function findProviderBySource(source: string | null | undefined): JobProvider | null {
  const normalized = String(source ?? "").toLowerCase();
  return getJobProviders().find((provider) => provider.sourceName.toLowerCase() === normalized) ?? null;
}
