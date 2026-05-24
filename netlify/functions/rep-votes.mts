import type { Context, Config } from "@netlify/functions";

// In-memory cache (per function instance)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

interface VoteRecord {
  date: string;
  question: string;
  result: string;
  position: string;  // Yea, Nay, Not Voting, etc.
  voteUrl: string;
  category: string;
  billNumber?: string;
  billTitle?: string;
  congressUrl?: string;
}

/**
 * Look up GovTrack person ID from bioguide ID
 */
async function getGovTrackPersonId(bioguideId: string): Promise<number | null> {
  const cacheKey = `gt-person-${bioguideId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 7) {
    return cached.data;
  }

  try {
    // GovTrack lets you query by bioguide ID
    const url = `https://www.govtrack.us/api/v2/person?bioguideid=${bioguideId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`GovTrack person lookup failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.objects && data.objects.length > 0) {
      const personId = data.objects[0].id;
      cache.set(cacheKey, { data: personId, timestamp: Date.now() });
      return personId;
    }
    return null;
  } catch (error) {
    console.error('Error looking up GovTrack person:', error);
    return null;
  }
}

/**
 * Fetch recent votes for a person from GovTrack
 */
async function fetchVotesForPerson(personId: number, limit: number = 10): Promise<VoteRecord[]> {
  try {
    // Get the most recent votes by this person
    // vote_voter endpoint returns individual votes cast by a person
    const url = `https://www.govtrack.us/api/v2/vote_voter?person=${personId}&limit=${limit}&order_by=-created`;
    console.log(`Fetching GovTrack votes: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`GovTrack votes failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.objects || data.objects.length === 0) {
      return [];
    }

    // Map GovTrack response to our format
    const votes: VoteRecord[] = data.objects.map((v: any) => {
      const vote = v.vote || {};
      return {
        date: vote.created ? vote.created.split('T')[0] : '',
        question: vote.question || 'Unknown vote',
        result: vote.result || '',
        position: v.option?.value || 'Unknown',
        voteUrl: vote.link ? `https://www.govtrack.us${vote.link}` : '',
        category: vote.category_label || vote.category || '',
        billNumber: vote.related_bill?.display_number || '',
        billTitle: vote.related_bill?.title_without_number || vote.related_bill?.title || '',
        congressUrl: vote.related_bill?.link ? `https://www.govtrack.us${vote.related_bill.link}` : '',
      };
    });

    return votes;
  } catch (error) {
    console.error('Error fetching votes:', error);
    return [];
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const bioguideId = url.searchParams.get("bioguideId");
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  if (!bioguideId) {
    return new Response(
      JSON.stringify({ error: "Missing bioguideId parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const cacheKey = `votes-${bioguideId}-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400"
      },
    });
  }

  try {
    // Step 1: Get GovTrack person ID
    const personId = await getGovTrackPersonId(bioguideId);
    
    if (!personId) {
      const errorResponse = { 
        error: "Could not find member on GovTrack",
        bioguideId,
        votes: []
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`Found GovTrack person ID ${personId} for bioguide ${bioguideId}`);

    // Step 2: Fetch their votes
    const votes = await fetchVotesForPerson(personId, limit);

    const result = {
      bioguideId,
      govtrackId: personId,
      votes: votes,
      count: votes.length
    };

    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400"
      },
    });
  } catch (error) {
    console.error("Error in rep-votes handler:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch votes",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/rep-votes",
};
