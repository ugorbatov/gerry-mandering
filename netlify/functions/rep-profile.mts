import type { Context, Config } from "@netlify/functions";

interface RepData {
  id: string;
  name: string;
  party: string;
  state: string;
  district: number;
  photoUrl: string;
  bio: string;
  officialWebsite: string;
  email: string;
  phone: string;
  committees: Committee[];
  recentVotes: Vote[];
  sponsoredBills: any[];
  cosponsoredBills: any[];
  termStart: string;
  chamber: string;
  campFinance: CampaignFinance;
  socialMedia: SocialLinks;
}

interface Committee {
  name: string;
  role: string;
}

interface Vote {
  billNumber: string;
  billTitle: string;
  date: string;
  position: "Yea" | "Nay" | "Present" | "Abstain";
  billSummary: string;
}

interface CampaignFinance {
  totalRaised: number;
  totalSpent: number;
  year: number;
}

interface SocialLinks {
  twitter?: string;
  facebook?: string;
  instagram?: string;
}

// Simple in-memory cache with 24-hour TTL
const cache = new Map<string, { data: RepData; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchRepFromCongress(bioguideId: string): Promise<RepData> {
  const cacheKey = `rep-${bioguideId}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache hit for ${bioguideId}`);
    return cached.data;
  }

  try {
    const apiKey = Netlify.env.get("CONGRESS_API_KEY") || "";
    
    // Fetch member details from Congress.gov API
    const url = `https://api.congress.gov/v3/member/${bioguideId}`;
    const headers: any = {
      "Content-Type": "application/json",
    };
    
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }
    
    const memberResponse = await fetch(url, { headers });

    if (!memberResponse.ok) {
      throw new Error(`Failed to fetch member data: ${memberResponse.status}`);
    }

    const memberData = await memberResponse.json();
    console.log("Member data keys:", Object.keys(memberData));
    
    // The response is { member: {...} } for single member endpoint
    const member = memberData.member || (memberData.members && memberData.members[0]) || memberData;
    
    if (!member) {
      throw new Error("No member data received from Congress.gov");
    }
    
    console.log("Member keys:", Object.keys(member));

    // Fetch recent votes (might fail, that's ok)
    let recentVotes: Vote[] = [];
    try {
      const votesUrl = `https://api.congress.gov/v3/member/${bioguideId}/votes?limit=10`;
      const votesResponse = await fetch(votesUrl, { headers });
      if (votesResponse.ok) {
        const votesData = await votesResponse.json();
        recentVotes = votesData.votes?.map((vote: any) => ({
          billNumber: vote.bill?.number || "Unknown",
          billTitle: vote.bill?.title || "Unknown Bill",
          date: vote.date || "Unknown Date",
          position: vote.position || "Abstain",
          billSummary: vote.bill?.summary || "",
        })) || [];
      }
    } catch (err) {
      console.log("Votes fetch failed:", err);
    }

    // Fetch sponsored legislation
    let sponsoredLegislation: any[] = [];
    try {
      const sponsoredUrl = `https://api.congress.gov/v3/member/${bioguideId}/sponsored-legislation?limit=5`;
      const sponsoredResponse = await fetch(sponsoredUrl, { headers });
      if (sponsoredResponse.ok) {
        const sponsoredData = await sponsoredResponse.json();
        sponsoredLegislation = sponsoredData.sponsoredLegislation || [];
        console.log(`Found ${sponsoredLegislation.length} sponsored bills`);
      }
    } catch (err) {
      console.log("Sponsored legislation fetch failed:", err);
    }

    // Fetch cosponsored legislation
    let cosponsoredLegislation: any[] = [];
    try {
      const cosponsoredUrl = `https://api.congress.gov/v3/member/${bioguideId}/cosponsored-legislation?limit=5`;
      const cosponsoredResponse = await fetch(cosponsoredUrl, { headers });
      if (cosponsoredResponse.ok) {
        const cosponsoredData = await cosponsoredResponse.json();
        cosponsoredLegislation = cosponsoredData.cosponsoredLegislation || [];
        console.log(`Found ${cosponsoredLegislation.length} cosponsored bills`);
      }
    } catch (err) {
      console.log("Cosponsored legislation fetch failed:", err);
    }

    // Parse name (format: "LastName, FirstName" or "FirstName LastName")
    let firstName = member.firstName || "";
    let lastName = member.lastName || "";
    let fullName = member.name || "";
    
    if (!firstName && fullName.includes(",")) {
      const parts = fullName.split(", ");
      lastName = parts[0];
      firstName = parts[1];
      fullName = `${firstName} ${lastName}`;
    } else if (!fullName) {
      fullName = `${firstName} ${lastName}`;
    }

    // Get district from terms
    let district = member.district || 0;
    if (member.terms?.item?.length > 0) {
      const latestTerm = member.terms.item[member.terms.item.length - 1];
      district = latestTerm.district || district;
    }

    // Get latest term info
    let termStart = "";
    let chamber = "";
    if (member.terms?.item?.length > 0) {
      const latestTerm = member.terms.item[member.terms.item.length - 1];
      termStart = latestTerm.startYear || "";
      chamber = latestTerm.chamber || "";
    }

    const repData: RepData = {
      id: bioguideId,
      name: fullName,
      party: member.partyName || member.partyHistory?.[0]?.partyName || "Independent",
      state: member.state || "New Jersey",
      district: district,
      photoUrl: member.depiction?.imageUrl || `https://www.congress.gov/img/member/${bioguideId.toLowerCase()}_200.jpg`,
      bio: member.honorificName 
        ? `${member.honorificName} ${fullName}, ${chamber} member representing ${member.state}, District ${district}, since ${termStart}.`
        : `${fullName} represents ${member.state}, District ${district}.`,
      officialWebsite: member.officialWebsiteUrl || "",
      email: "",
      phone: "",
      committees: [],
      recentVotes: recentVotes,
      sponsoredBills: sponsoredLegislation.map((bill: any) => ({
        number: bill.number,
        title: bill.title,
        introducedDate: bill.introducedDate,
        latestAction: bill.latestAction?.text || "",
      })),
      cosponsoredBills: cosponsoredLegislation.map((bill: any) => ({
        number: bill.number,
        title: bill.title,
        introducedDate: bill.introducedDate,
      })),
      termStart: termStart,
      chamber: chamber,
      campFinance: {
        totalRaised: 0,
        totalSpent: 0,
        year: 2024,
      },
      socialMedia: {
        twitter: "",
        facebook: "",
        instagram: "",
      },
    };

    // Cache the result
    cache.set(cacheKey, { data: repData, timestamp: Date.now() });

    return repData;
  } catch (error) {
    console.error(`Error fetching rep data for ${bioguideId}:`, error);
    throw error;
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const repId = url.searchParams.get("repId");

  if (!repId) {
    return new Response(
      JSON.stringify({ error: "Missing repId parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const repData = await fetchRepFromCongress(repId);
    return new Response(JSON.stringify(repData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch rep profile",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/rep-profile",
};
