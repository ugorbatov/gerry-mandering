import type { Context, Config } from "@netlify/functions";

// In-memory cache (per function instance)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

interface BillSummary {
  billNumber: string;
  title: string;
  summary: string;
  introducedDate?: string;
  policyArea?: string;
  subjects?: string[];
  latestAction?: string;
  url?: string;
}

/**
 * Simplify an official bill summary into plain English
 * Transforms legalese into more accessible language
 */
function simplifySummary(text: string): string {
  if (!text) return '';
  
  let simplified = text;
  
  // Strip HTML tags first
  simplified = simplified.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  
  // Remove common legislative boilerplate
  simplified = simplified
    .replace(/^This bill /, '')
    .replace(/Specifically, the bill /g, 'It ')
    .replace(/Additionally, /g, 'Also, ')
    .replace(/Furthermore, /g, 'Also, ')
    .replace(/Moreover, /g, 'Also, ')
    .replace(/In addition, /g, 'Also, ')
    .replace(/such as /g, 'like ')
    .replace(/in order to /g, 'to ')
    .replace(/with respect to /g, 'about ')
    .replace(/pursuant to /g, 'under ')
    .replace(/notwithstanding /g, 'despite ')
    .replace(/in accordance with /g, 'following ')
    .replace(/shall be required to /g, 'must ')
    .replace(/is authorized to /g, 'can ')
    .replace(/are authorized to /g, 'can ')
    .replace(/may be /g, 'can be ')
    .replace(/utilize/g, 'use')
    .replace(/utilizes/g, 'uses')
    .replace(/utilized/g, 'used')
    .replace(/establish/g, 'set up')
    .replace(/promulgate/g, 'issue')
    .replace(/promulgates/g, 'issues')
    .replace(/promulgated/g, 'issued')
    .replace(/aforementioned/g, 'said')
    .replace(/the term ['"]?([^'""]+)['"]? means/gi, '$1 means')
    .replace(/for the purposes of this section/g, 'here')
    .replace(/for the purpose of /g, 'to ')
    .replace(/Title (\w+) of the United States Code/g, 'federal law')
    .replace(/section \d+ of the/g, '')
    .replace(/\bU\.S\.C\.\b/g, '')
    .replace(/the United States/g, 'the U.S.');
  
  // Make first letter capital
  if (simplified.length > 0) {
    simplified = simplified.charAt(0).toUpperCase() + simplified.slice(1);
  }
  
  // Truncate to ~3 sentences or 400 chars
  const sentences = simplified.match(/[^.!?]+[.!?]+/g) || [simplified];
  if (sentences.length > 3) {
    simplified = sentences.slice(0, 3).join(' ').trim();
  }
  if (simplified.length > 450) {
    // Cut at last sentence boundary
    const cut = simplified.substring(0, 450);
    const lastPeriod = cut.lastIndexOf('. ');
    simplified = lastPeriod > 200 ? cut.substring(0, lastPeriod + 1) : cut + '...';
  }
  
  return simplified.replace(/\s+/g, ' ').trim();
}

/**
 * Parse bill number - handles multiple formats
 * Examples: "H.R. 1234", "HR1234", "S567", "8130" (plain number = assume H.R.)
 */
function parseBillNumber(billNumber: string, defaultType: string = 'hr'): { type: string; number: string } | null {
  if (!billNumber) return null;
  
  // Normalize: remove dots, spaces, make uppercase
  const normalized = String(billNumber).toUpperCase().replace(/[.\s]/g, '');
  
  // Try to match with type prefix first
  const matchWithType = normalized.match(/^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)(\d+)$/);
  if (matchWithType) {
    const typeMap: Record<string, string> = {
      'HR': 'hr',
      'S': 's',
      'HJRES': 'hjres',
      'SJRES': 'sjres',
      'HCONRES': 'hconres',
      'SCONRES': 'sconres',
      'HRES': 'hres',
      'SRES': 'sres',
    };
    return {
      type: typeMap[matchWithType[1]] || 'hr',
      number: matchWithType[2]
    };
  }
  
  // Try plain number - assume default type
  const matchPlain = normalized.match(/^(\d+)$/);
  if (matchPlain) {
    return {
      type: defaultType,
      number: matchPlain[1]
    };
  }
  
  return null;
}

/**
 * Fetch bill summary from Congress.gov
 */
async function fetchBillSummary(billNumber: string, congress: string = '119', defaultType: string = 'hr'): Promise<BillSummary | null> {
  const cacheKey = `bill-${congress}-${defaultType}-${billNumber}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const parsed = parseBillNumber(billNumber, defaultType);
  if (!parsed) {
    console.log(`Could not parse bill number: ${billNumber}`);
    return null;
  }

  const apiKey = Netlify.env.get("CONGRESS_API_KEY") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  try {
    // Fetch bill details
    const billUrl = `https://api.congress.gov/v3/bill/${congress}/${parsed.type}/${parsed.number}`;
    console.log(`Fetching: ${billUrl}`);
    
    const billResponse = await fetch(billUrl, { headers });
    
    if (!billResponse.ok) {
      console.log(`Bill fetch failed: ${billResponse.status}`);
      return null;
    }

    const billData = await billResponse.json();
    const bill = billData.bill;
    
    if (!bill) {
      return null;
    }

    // Fetch summary separately (it's a different endpoint)
    let summary = '';
    try {
      const summaryUrl = `https://api.congress.gov/v3/bill/${congress}/${parsed.type}/${parsed.number}/summaries`;
      const summaryResponse = await fetch(summaryUrl, { headers });
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        // Get the most recent summary
        if (summaryData.summaries && summaryData.summaries.length > 0) {
          const latestSummary = summaryData.summaries[summaryData.summaries.length - 1];
          const rawSummary = latestSummary.text || '';
          // Apply plain-English simplification
          summary = simplifySummary(rawSummary);
        }
      }
    } catch (err) {
      console.log("Summary fetch failed:", err);
    }

    // Fetch subjects (topics)
    let subjects: string[] = [];
    let policyArea = '';
    try {
      const subjectsUrl = `https://api.congress.gov/v3/bill/${congress}/${parsed.type}/${parsed.number}/subjects`;
      const subjectsResponse = await fetch(subjectsUrl, { headers });
      
      if (subjectsResponse.ok) {
        const subjectsData = await subjectsResponse.json();
        if (subjectsData.subjects) {
          policyArea = subjectsData.subjects.policyArea?.name || '';
          subjects = (subjectsData.subjects.legislativeSubjects || [])
            .slice(0, 5)
            .map((s: any) => s.name);
        }
      }
    } catch (err) {
      console.log("Subjects fetch failed:", err);
    }

    const result: BillSummary = {
      billNumber: billNumber,
      title: bill.title || '',
      summary: summary || 'No summary available',
      introducedDate: bill.introducedDate,
      policyArea: policyArea,
      subjects: subjects,
      latestAction: bill.latestAction?.text || '',
      url: `https://www.congress.gov/bill/${congress}th-congress/${parsed.type === 'hr' ? 'house-bill' : 'senate-bill'}/${parsed.number}`,
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error(`Error fetching bill ${billNumber}:`, error);
    return null;
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const billNumber = url.searchParams.get("billNumber");
  const billType = url.searchParams.get("billType") || "hr"; // Default to House bill
  const congress = url.searchParams.get("congress") || "119";

  if (!billNumber) {
    return new Response(
      JSON.stringify({ error: "Missing billNumber parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const summary = await fetchBillSummary(billNumber, congress, billType);
    
    if (!summary) {
      return new Response(
        JSON.stringify({ error: "Bill not found", billNumber }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400"
      },
    });
  } catch (error) {
    console.error("Error in bill-summary handler:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch bill summary",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/bill-summary",
};
