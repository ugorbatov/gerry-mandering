import type { Context, Config } from "@netlify/functions";

interface NJRep {
  id: string;
  name: string;
  party: string;
  district: number;
  photoUrl: string;
}

// Simple in-memory cache with 24-hour TTL
const cache = new Map<string, { data: NJRep[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchNJReps(): Promise<NJRep[]> {
  const cacheKey = "nj-reps-2024";

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("Cache hit for NJ reps");
    return cached.data;
  }

  try {
    const apiKey = Netlify.env.get("CONGRESS_API_KEY") || "";
    console.log("API Key present:", apiKey ? "yes" : "no");
    
    // Fetch all members for NJ from Congress.gov API
    const url = `https://api.congress.gov/v3/member?state=NJ&currentMember=true`;
    console.log("Fetching from Congress.gov...");
    
    const headers: any = {
      "Content-Type": "application/json",
    };
    
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }
    
    const response = await fetch(url, { headers });
    console.log("Congress.gov response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Congress.gov error:", errorText);
      throw new Error(`Failed to fetch NJ reps: ${response.status}`);
    }

    const data = await response.json();
    console.log("Congress.gov response keys:", Object.keys(data));
    
    // Handle both response formats
    let members = data.members || [];
    console.log("Congress.gov data received, members count:", members.length);
    
    // Log ENTIRE first member to see structure
    if (members.length > 0) {
      console.log("FULL FIRST MEMBER:", JSON.stringify(members[0], null, 2));
    }

    // Filter for House members only and map to NJRep
    console.log("Starting filter...");
    
    // First, log all members' chambers to see what we're getting
    const chamberCounts = { House: 0, Senate: 0 };
    members.forEach((m: any) => {
      const latestTerm = m.terms?.item?.[m.terms.item.length - 1];
      if (latestTerm?.chamber) {
        chamberCounts[latestTerm.chamber as keyof typeof chamberCounts]++;
      }
    });
    console.log("Chamber distribution:", chamberCounts);
    
    const njReps: NJRep[] = members
      .filter((member: any) => {
        // Check if member has terms.item array
        if (!member.terms || !member.terms.item || !Array.isArray(member.terms.item) || member.terms.item.length === 0) {
          return false;
        }
        
        // Get latest term
        const latestTerm = member.terms.item[member.terms.item.length - 1];
        if (!latestTerm) {
          return false;
        }
        
        // Check chamber (House) and state (New Jersey)
        const isHouseNJ = (latestTerm.chamber === "House" || latestTerm.chamber === "House of Representatives") && member.state === "New Jersey";
        
        if (isHouseNJ) {
          console.log(`✓ Found: ${member.name} - ${latestTerm.chamber}`);
        }
        
        return isHouseNJ;
      })
      .map((member: any) => {
        // Parse name: "LastName, FirstName" -> "FirstName LastName"
        const nameParts = member.name.split(", ");
        const fullName = nameParts.length === 2 ? `${nameParts[1]} ${nameParts[0]}` : member.name;
        
        // Extract district from latest term
        const latestTerm = member.terms.item[member.terms.item.length - 1];
        const district = latestTerm.district || 0;
        
        return {
          id: member.bioguideId,
          name: fullName,
          party: member.partyName || "Independent",
          district: district,
          photoUrl: member.depiction?.imageUrl || "",
        };
      })
      .sort((a: NJRep, b: NJRep) => a.district - b.district);

    console.log("Filtered NJ reps:", njReps.length);
    
    // Cache the result
    cache.set(cacheKey, { data: njReps, timestamp: Date.now() });

    return njReps;
  } catch (error) {
    console.error("Error fetching NJ reps:", error);
    throw error;
  }
}

export default async (req: Request, context: Context) => {
  try {
    const njReps = await fetchNJReps();
    return new Response(JSON.stringify(njReps), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch NJ representatives",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/nj-reps",
};
