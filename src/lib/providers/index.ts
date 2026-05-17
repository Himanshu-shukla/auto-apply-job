import { MockJobProvider } from "@/lib/providers/mockJobProvider";
import { PublicCareerPageProvider } from "@/lib/providers/publicCareerPageProvider";
import { RSSJobProvider } from "@/lib/providers/rssJobProvider";
import { ManualImportProvider } from "@/lib/providers/manualJobImport";
import { PublicAPIProvider } from "@/lib/providers/publicApiProvider";
import { CompanyCareerPageProvider } from "@/lib/providers/companyCareerPageProvider";
import { DirectEmailJobProvider } from "@/lib/providers/directEmailJobProvider";
import { PartnerFeedProvider } from "@/lib/providers/partnerFeedProvider";
import type { JobProvider } from "@/lib/providers/types";

export function getJobProviders() {
  const providers: JobProvider[] = [
    new MockJobProvider(),
    new ManualImportProvider(),
    new RSSJobProvider(),
    new PublicAPIProvider(),
    new PublicCareerPageProvider(),
    new CompanyCareerPageProvider(),
    new DirectEmailJobProvider(),
    new PartnerFeedProvider()
  ];
  return providers.filter((provider) => provider.enabled !== false);
}
