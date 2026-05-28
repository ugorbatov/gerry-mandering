import type { Context, Config } from "@netlify/functions";

// Version: 2 - Fixed response parsing (May 28, 2026)
// Tested with: https://api.census.gov/data/2023/pep/charv?get=POP&for=state:34&YEAR=2023
// Response: [["POP","YEAR","state"],["9290841","2023","34"]]

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

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

async function fetchCensusPopulationData(state: string, censusApiKey: string) {
  const cacheKey = `census-pop-${state}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const fips = getStateFips(state);
    if (!fips) throw new Error(`Invalid state code: ${state}`);

    // Census Bureau PEP API - TESTED ENDPOINT
    const url = `https://api.census.gov/data/2023/pep/charv?get=POP&for=state:${fips}&YEAR=2023&key=${censusApiKey}`;

    console.log(`[census-data] Fetching for ${state} (FIPS: ${fips}) from: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[census-data] API error ${response.status}: ${errorText}`);
      throw new Error(`Census API error: ${response.status}`);
    }

    const rawData = await response.json() as any[];
    console.log(`[census-data] Raw response:`, rawData);

    if (!Array.isArray(rawData) || rawData.length < 2) {
      throw new Error("Invalid response format");
    }

    const header = rawData[0];
    const dataRow = rawData[1];
    
    const popIndex = header.indexOf("POP");
    if (popIndex === -1) throw new Error("POP field not found in response");

    const population = parseInt(dataRow[popIndex], 10);
    if (isNaN(population)) throw new Error("Could not parse population value");

    const data = [{
      year: 2023,
      state: state,
      population: population
    }];

    console.log(`[census-data] Successfully got population for ${state}: ${population}`);

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`[census-data] Error:`, error);
    throw error;
  }
}

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

  const url = new URL(req.url);
  const state = url.searchParams.get("state")?.toUpperCase() || "";

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
    const populationData = await fetchCensusPopulationData(state, censusApiKey);
    return new Response(JSON.stringify({
      state,
      data: populationData,
      timestamp: new Date().toISOString(),
    }, null, 2), {
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