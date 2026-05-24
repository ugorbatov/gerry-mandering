import type { Context, Config } from "@netlify/functions";

// In-memory cache (per function instance)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

interface FinanceData {
  candidateName?: string;
  candidateId?: string;
  committeeName?: string;
  committeeId?: string;
  cycle: number;
  totals?: {
    totalReceipts: number;
    totalDisbursements: number;
    cashOnHand: number;
    debts: number;
    individualContributions: number;
    pacContributions: number;
    partyContributions: number;
  };
  topEmployers?: Array<{
    employer: string;
    total: number;
    count: number;
  }>;
  topOccupations?: Array<{
    occupation: string;
    total: number;
    count: number;
  }>;
  topIndividuals?: Array<{
    name: string;
    total: number;
    count: number;
    employer: string;
    city: string;
    state: string;
    occupation: string;
  }>;
  topPACs?: Array<{
    name: string;
    total: number;
    count: number;
    committeeId: string;
    state: string;
  }>;
  topStates?: Array<{
    state: string;
    total: number;
  }>;
  contributionSizes?: Array<{
    size: string;
    total: number;
  }>;
  error?: string;
}

/**
 * Fetch with timeout - aborts if takes too long
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`Request timed out after ${timeoutMs}ms: ${url.replace(/api_key=[^&]+/, 'api_key=***').substring(0, 100)}`);
    }
    return null;
  }
}

/**
 * Get FEC API key from environment
 */
function getFecApiKey(): string {
  const key = Netlify.env.get("FEC_API_KEY");
  if (!key) {
    console.log("⚠️ FEC_API_KEY not set, falling back to DEMO_KEY (30/hr limit)");
    return "DEMO_KEY";
  }
  console.log(`✓ Using FEC_API_KEY (length: ${key.length})`);
  return key;
}

/**
 * Build FEC API URL with auth
 */
function fecUrl(path: string, params: Record<string, any> = {}): string {
  const apiKey = getFecApiKey();
  const searchParams = new URLSearchParams({ api_key: apiKey });
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  }
  
  return `https://api.open.fec.gov/v1${path}?${searchParams.toString()}`;
}

/**
 * Look up FEC candidate ID by name, state, district, and cycle
 */
async function findCandidateId(
  name: string, 
  state: string, 
  district: number, 
  cycle: number
): Promise<{ candidateId: string; candidateName: string; principalCommitteeId?: string } | null> {
  const cacheKey = `fec-candidate-${name}-${state}-${district}-${cycle}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 7) {
    console.log(`Cache hit for FEC candidate: ${name}`);
    return cached.data;
  }

  try {
    // Search candidates by name + state + district
    const url = fecUrl('/candidates/search/', {
      q: name,
      state: state,
      district: district === 0 ? '00' : String(district).padStart(2, '0'),
      cycle: cycle,
      office: 'H', // House
      sort: 'name',
      per_page: 5,
    });
    
    console.log(`FEC candidate search: name="${name}", state=${state}, district=${district}, cycle=${cycle}`);
    console.log(`Request URL: ${url.replace(/api_key=[^&]+/, 'api_key=***')}`);
    
    const response = await fetchWithTimeout(url, 8000);
    
    if (!response) {
      console.log(`FEC candidate search timed out`);
      return null;
    }
    
    console.log(`FEC response status: ${response.status}`);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.log(`FEC candidate search failed: ${response.status}`);
      console.log(`Error body: ${errorBody.substring(0, 500)}`);
      return null;
    }

    const data = await response.json();
    console.log(`FEC returned ${data.results?.length || 0} results`);
    
    if (!data.results || data.results.length === 0) {
      console.log(`No candidates found for "${name}" in ${state}-${district}`);
      return null;
    }

    // Log first few results to see what we got
    data.results.slice(0, 3).forEach((c: any, i: number) => {
      console.log(`  ${i+1}. ${c.name} (${c.candidate_id}) - ${c.state}-${c.district}, cycles: ${c.cycles?.join(',')}`);
    });

    // Pick the most recent matching candidate
    const candidate = data.results[0];
    const result = {
      candidateId: candidate.candidate_id,
      candidateName: candidate.name,
      principalCommitteeId: candidate.principal_committees?.[0]?.committee_id,
    };
    
    console.log(`✓ Selected: ${result.candidateId}, committee: ${result.principalCommitteeId || 'NONE'}`);
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error finding candidate:', error);
    return null;
  }
}

/**
 * Get committee from candidate (if not in search result)
 */
async function getPrincipalCommittee(candidateId: string, cycle: number): Promise<string | null> {
  try {
    const url = fecUrl(`/candidate/${candidateId}/committees/`, {
      cycle: cycle,
      designation: ['P'], // Principal campaign committee
    });
    
    const response = await fetchWithTimeout(url, 6000);
    if (!response || !response.ok) return null;
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].committee_id;
    }
    return null;
  } catch (error) {
    console.error('Error getting committee:', error);
    return null;
  }
}

/**
 * Get committee financial totals
 */
async function getCommitteeTotals(committeeId: string, cycle: number) {
  try {
    const url = fecUrl(`/committee/${committeeId}/totals/`, {
      cycle: cycle,
      per_page: 1,
    });
    
    const response = await fetchWithTimeout(url, 8000);
    if (!response || !response.ok) return null;
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const t = data.results[0];
      return {
        totalReceipts: t.receipts || 0,
        totalDisbursements: t.disbursements || 0,
        cashOnHand: t.last_cash_on_hand_end_period || 0,
        debts: t.last_debts_owed_by_committee || 0,
        individualContributions: t.individual_contributions || 0,
        pacContributions: t.other_political_committee_contributions || 0,
        partyContributions: t.political_party_committee_contributions || 0,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting totals:', error);
    return null;
  }
}

/**
 * Get top individual contributors (by name)
 */
async function getTopIndividuals(committeeId: string, cycle: number, limit: number = 10) {
  try {
    const url = fecUrl(`/schedules/schedule_a/`, {
      committee_id: committeeId,
      two_year_transaction_period: cycle,
      is_individual: true,
      per_page: 100,
      sort: '-contribution_receipt_amount',
    });
    
    console.log(`Fetching top individuals: ${url.replace(/api_key=[^&]+/, 'api_key=***').substring(0, 150)}`);
    const response = await fetchWithTimeout(url, 15000);
    
    if (!response) {
      console.log(`Top individuals: request timed out`);
      return [];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Top individuals failed: ${response.status} - ${errorText.substring(0, 300)}`);
      return [];
    }
    
    const data = await response.json();
    const results = data.results || [];
    console.log(`Top individuals: got ${results.length} raw records`);
    
    // Aggregate by contributor name + employer
    const aggregated = new Map<string, { name: string; total: number; count: number; employer: string; city: string; state: string; occupation: string }>();
    
    for (const r of results) {
      const name = r.contributor_name || 'Unknown';
      const key = name.toUpperCase();
      
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          name: name,
          total: 0,
          count: 0,
          employer: r.contributor_employer || '',
          city: r.contributor_city || '',
          state: r.contributor_state || '',
          occupation: r.contributor_occupation || '',
        });
      }
      
      const entry = aggregated.get(key)!;
      entry.total += r.contribution_receipt_amount || 0;
      entry.count += 1;
    }
    
    const final = Array.from(aggregated.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
    console.log(`Top individuals: aggregated to ${final.length} unique donors`);
    return final;
  } catch (error) {
    console.error('Error getting top individuals:', error);
    return [];
  }
}

/**
 * Get top PAC contributors
 */
async function getTopPACs(committeeId: string, cycle: number, limit: number = 10) {
  try {
    const url = fecUrl(`/schedules/schedule_a/`, {
      committee_id: committeeId,
      two_year_transaction_period: cycle,
      is_individual: false,
      per_page: 100,
      sort: '-contribution_receipt_amount',
    });
    
    console.log(`Fetching top PACs: ${url.replace(/api_key=[^&]+/, 'api_key=***').substring(0, 150)}`);
    const response = await fetchWithTimeout(url, 15000);
    
    if (!response) {
      console.log(`Top PACs: request timed out`);
      return [];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Top PACs failed: ${response.status} - ${errorText.substring(0, 300)}`);
      return [];
    }
    
    const data = await response.json();
    const results = data.results || [];
    console.log(`Top PACs: got ${results.length} raw records`);
    
    // Aggregate by contributor name
    const aggregated = new Map<string, { name: string; total: number; count: number; committeeId: string; state: string }>();
    
    for (const r of results) {
      const name = r.contributor_name || 'Unknown';
      const key = name.toUpperCase();
      
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          name: name,
          total: 0,
          count: 0,
          committeeId: r.contributor_id || '',
          state: r.contributor_state || '',
        });
      }
      
      const entry = aggregated.get(key)!;
      entry.total += r.contribution_receipt_amount || 0;
      entry.count += 1;
    }
    
    const final = Array.from(aggregated.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
    console.log(`Top PACs: aggregated to ${final.length} unique PACs`);
    return final;
  } catch (error) {
    console.error('Error getting top PACs:', error);
    return [];
  }
}

/**
 * Get top contributors aggregated by employer
 */
async function getTopByEmployer(committeeId: string, cycle: number, limit: number = 10) {
  try {
    const url = fecUrl(`/committee/${committeeId}/schedules/schedule_a/by_employer/`, {
      cycle: cycle,
      per_page: limit,
      sort: '-total',
    });
    
    // by_employer is the most valuable data but slowest endpoint - give it more time
    const response = await fetchWithTimeout(url, 20000);
    if (!response || !response.ok) {
      console.log(`by_employer failed or timed out`);
      return [];
    }
    
    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      employer: r.employer || 'Unknown',
      total: r.total || 0,
      count: r.count || 0,
    }));
  } catch (error) {
    console.error('Error getting employers:', error);
    return [];
  }
}

/**
 * Get top contributors aggregated by occupation
 */
async function getTopByOccupation(committeeId: string, cycle: number, limit: number = 10) {
  try {
    const url = fecUrl(`/committee/${committeeId}/schedules/schedule_a/by_occupation/`, {
      cycle: cycle,
      per_page: limit,
      sort: '-total',
    });
    
    const response = await fetchWithTimeout(url, 20000);
    if (!response || !response.ok) {
      console.log(`by_occupation failed or timed out`);
      return [];
    }
    
    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      occupation: r.occupation || 'Unknown',
      total: r.total || 0,
      count: r.count || 0,
    }));
  } catch (error) {
    console.error('Error getting occupations:', error);
    return [];
  }
}

/**
 * Get contributions grouped by state
 */
async function getTopByState(committeeId: string, cycle: number, limit: number = 10) {
  try {
    const url = fecUrl(`/committee/${committeeId}/schedules/schedule_a/by_state/`, {
      cycle: cycle,
      per_page: limit,
      sort: '-total',
    });
    
    const response = await fetchWithTimeout(url, 10000);
    if (!response || !response.ok) return [];
    
    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      state: r.state || 'Unknown',
      total: r.total || 0,
    }));
  } catch (error) {
    console.error('Error getting states:', error);
    return [];
  }
}

/**
 * Get contributions by size category
 */
async function getContributionSizes(committeeId: string, cycle: number) {
  try {
    const url = fecUrl(`/committee/${committeeId}/schedules/schedule_a/by_size/`, {
      cycle: cycle,
    });
    
    const response = await fetchWithTimeout(url, 10000);
    if (!response || !response.ok) return [];
    
    const data = await response.json();
    const sizeLabels: Record<string, string> = {
      '0': '$200 and under',
      '200': '$200.01 - $499.99',
      '500': '$500 - $999.99',
      '1000': '$1,000 - $1,999.99',
      '2000': '$2,000 and over',
    };
    
    return (data.results || []).map((r: any) => ({
      size: sizeLabels[String(r.size)] || `$${r.size}`,
      total: r.total || 0,
    }));
  } catch (error) {
    console.error('Error getting sizes:', error);
    return [];
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const state = url.searchParams.get("state");
  const district = parseInt(url.searchParams.get("district") || "0", 10);
  const cycle = parseInt(url.searchParams.get("cycle") || "2026", 10);

  if (!name || !state) {
    return new Response(
      JSON.stringify({ error: "Missing required parameters: name, state" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const cacheKey = `finance-v2-${name}-${state}-${district}-${cycle}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
    });
  }

  try {
    // Step 1: Find FEC candidate ID
    const candidate = await findCandidateId(name, state, district, cycle);
    
    if (!candidate) {
      const errorResponse: FinanceData = {
        cycle,
        error: "Candidate not found on FEC. Try a different election cycle."
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Step 2: Get committee ID (from search result or fetch separately)
    let committeeId = candidate.principalCommitteeId;
    if (!committeeId) {
      committeeId = await getPrincipalCommittee(candidate.candidateId, cycle);
    }
    
    if (!committeeId) {
      const errorResponse: FinanceData = {
        candidateName: candidate.candidateName,
        candidateId: candidate.candidateId,
        cycle,
        error: "No principal committee found for candidate."
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Step 3: Fetch financial data in parallel
    // Using allSettled means a slow/failing endpoint won't block the others
    console.log(`Starting parallel fetches for committee ${committeeId}`);
    const startTime = Date.now();
    
    const results = await Promise.allSettled([
      getCommitteeTotals(committeeId, cycle),
      getTopByEmployer(committeeId, cycle, 10),
      getTopByOccupation(committeeId, cycle, 6),
      getContributionSizes(committeeId, cycle),
      getTopIndividuals(committeeId, cycle, 10),
      getTopPACs(committeeId, cycle, 10),
    ]);
    
    console.log(`Parallel fetches completed in ${Date.now() - startTime}ms`);
    
    const totals = results[0].status === 'fulfilled' ? results[0].value : null;
    const topEmployers = results[1].status === 'fulfilled' ? results[1].value : [];
    const topOccupations = results[2].status === 'fulfilled' ? results[2].value : [];
    const contributionSizes = results[3].status === 'fulfilled' ? results[3].value : [];
    const topIndividuals = results[4].status === 'fulfilled' ? results[4].value : [];
    const topPACs = results[5].status === 'fulfilled' ? results[5].value : [];
    
    // Log what succeeded
    console.log(`Results: totals=${!!totals}, employers=${topEmployers.length}, occupations=${topOccupations.length}, sizes=${contributionSizes.length}, individuals=${topIndividuals.length}, pacs=${topPACs.length}`);

    const result: FinanceData = {
      candidateName: candidate.candidateName,
      candidateId: candidate.candidateId,
      committeeId: committeeId,
      cycle,
      totals: totals || undefined,
      topEmployers,
      topOccupations,
      topIndividuals,
      topPACs,
      topStates: [],
      contributionSizes,
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
    });
  } catch (error) {
    console.error("Error in rep-finance handler:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch finance data",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/rep-finance",
};
