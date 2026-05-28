import type { Context, Config } from "@netlify/functions";

// In-memory cache (per function instance)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

interface PopulationData {
  year: number;
  state: string;
  population: number;
  change?: number;
  changePercent?: number;
}

/**
 * Fetch annual population estimates from Census Bureau API
 * Uses Census Bureau's Population Estimates Program (PEP) data
 */
async function fetchCensusPopulationData(
  state: string,
  censusApiKey: string
): Promise<PopulationData[]> {
  const cacheKey = `census-pop-${state}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Census Bureau Population Estimates API endpoint
    // Variables: POP (total population)
    // Time series: 2010-2023 (annual)
    const url = new URL("https://api.census.gov/data/2023/pep/population");
    
    url.searchParams.set("get", "POP,NAME");
    url.searchParams.set("for", `state:${getStateFips(state)}`);
    url.searchParams.set("time", "from 2020 to 2023"); // Recent years for shifts
    url.searchParams.set("key", censusApiKey);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Census API error: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json() as any[];
    
    if (!Array.isArray(rawData) || rawData.length < 2) {
      throw new Error("Invalid Census API response format");
    }

    // Parse response: first row is header, remaining are data
    // Format: [POP, NAME, state, time]
    const header = rawData[0];
    const popIndex = header.indexOf("POP");
    const timeIndex = header.indexOf("time");

    if (popIndex === -1 || timeIndex === -1) {
      throw new Error("Missing required fields in Census response");
    }

    const data: PopulationData[] = [];
    let previousPop: number | null = null;

    // Parse rows and calculate year-over-year change
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const year = parseInt(row[timeIndex], 10);
      const population = parseInt(row[popIndex], 10);

      const entry: PopulationData = {
        year,
        state,
        population,
      };

      // Calculate change from previous year
      if (previousPop !== null) {
        entry.change = population - previousPop;
        entry.changePercent = ((population - previousPop) / previousPop) * 100;
      }

      data.push(entry);
      previousPop = population;
    }

    // Sort by year ascending
    data.sort((a, b) => a.year - b.year);

    // Cache the result
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error(`Error fetching Census data for ${state}:`, error);
    throw error;
  }
}

/**
 * Convert state abbreviation to FIPS code
 * Example: 'NY' -> '36', 'CA' -> '06'
 */
function getStateFips(stateAbbr: string): string {
  const fipsMap: Record<string, string> = {
    AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
    DE: "10", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18",
    IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25",
    MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32",
    NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
    OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47",
    TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55",
    WY: "56", DC: "11"
  };
  return fipsMap[stateAbbr.toUpperCase()] || "";
}

/**
 * Calculate population shift metrics for a state
 * Returns: total change, % change, avg annual growth rate
 */
function calculatePopulationShifts(data: PopulationData[]) {
  if (data.length < 2) return null;

  const firstYear = data[0];
  const lastYear = data[data.length - 1];

  const totalChange = lastYear.population - firstYear.population;
  const changePercent = ((totalChange) / firstYear.population) * 100;
  const yearsSpan = lastYear.year - firstYear.year;
  const avgAnnualGrowth = yearsSpan > 0 ? changePercent / yearsSpan : 0;

  return {
    startYear: firstYear.year,
    endYear: lastYear.year,
    startPop: firstYear.population,
    endPop: lastYear.population,
    totalChange,
    changePercent: Number(changePercent.toFixed(2)),
    avgAnnualGrowth: Number(avgAnnualGrowth.toFixed(2)),
  };
}

/**
 * Main handler
 */
export default async (req: Request, context: Context) => {
  const censusApiKey = Netlify.env.get("CENSUS_DATA_API") || "";
  
  if (!censusApiKey) {
    return new Response(
      JSON.stringify({
        error: "CENSUS_DATA_API key not configured",
        code: "MISSING_API_KEY"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse query parameters
  const url = new URL(req.url);
  const state = url.searchParams.get("state")?.toUpperCase() || "";
  const includeShifts = url.searchParams.get("shifts") === "true";

  if (!state || state.length !== 2) {
    return new Response(
      JSON.stringify({
        error: "Missing or invalid 'state' parameter. Use 2-letter state code (e.g., ?state=NY)",
        code: "INVALID_PARAMS"
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch population data
    const populationData = await fetchCensusPopulationData(state, censusApiKey);

    // Build response
    const response: any = {
      state,
      data: populationData,
      cached: cache.has(`census-pop-${state}`),
      timestamp: new Date().toISOString(),
    };

    // Optionally include shifts analysis
    if (includeShifts) {
      response.shifts = calculatePopulationShifts(populationData);
    }

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        state,
        code: "CENSUS_API_ERROR"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/census-data",
};
