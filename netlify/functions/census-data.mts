import type { Context, Config } from "@netlify/functions";

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// 2020 Census data (official baseline for post-redistricting analysis)
const CENSUS_2020: Record<string, number> = {
  AL: 5024279, AK: 733391, AZ: 7151502, AR: 3011524,
  CA: 39538223, CO: 5773714, CT: 3605944, DE: 990837,
  FL: 21538187, GA: 10711908, HI: 1435138, ID: 1839106,
  IL: 12812508, IN: 6785528, IA: 3190369, KS: 2937880,
  KY: 4505836, LA: 4657757, ME: 1362359, MD: 6177224,
  MA: 7029917, MI: 10077331, MN: 5706494, MS: 2961279,
  MO: 6154913, MT: 1084225, NE: 1961504, NV: 3104614,
  NH: 1377529, NJ: 8882190, NM: 2117522, NY: 20201249,
  NC: 10439388, ND: 779094, OH: 11799448, OK: 3959353,
  OR: 4237256, PA: 13002700, RI: 1097379, SC: 5118425,
  SD: 886667, TN: 6910840, TX: 29145505, UT: 3271616,
  VT: 643077, VA: 8631393, WA: 7705281, WV: 1793716,
  WI: 5893718, WY: 576851, DC: 705749
};

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

// Fetch state-level population from PEP
async function fetchStatePopulation(state: string, censusApiKey: string) {
  const cacheKey = `census-state-${state}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const fips = getStateFips(state);
    if (!fips) throw new Error(`Invalid state code: ${state}`);

    const url = `https://api.census.gov/data/2023/pep/charv?get=POP&for=state:${fips}&YEAR=2023&key=${censusApiKey}`;
    console.log(`[census-data] Fetching state population for ${state}`);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[census-data] API error ${response.status}: ${errorText}`);
      throw new Error(`Census API error: ${response.status}`);
    }

    const rawData = await response.json() as any[];
    if (!Array.isArray(rawData) || rawData.length < 2) {
      throw new Error("Invalid response format");
    }

    const header = rawData[0];
    const dataRow = rawData[1];
    const popIndex = header.indexOf("POP");
    if (popIndex === -1) throw new Error("POP field not found");

    const population = parseInt(dataRow[popIndex], 10);
    if (isNaN(population)) throw new Error("Could not parse population value");

    const data = { year: 2023, state, population };
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`[census-data] Error fetching state population:`, error);
    throw error;
  }
}

// Calculate population shifts: 2020 Census to 2023 PEP
async function calculatePopulationShifts(state: string, pop2023: number) {
  try {
    const pop2020 = CENSUS_2020[state];
    if (!pop2020) throw new Error(`No 2020 Census data for ${state}`);

    console.log(`[census-data] Calculating shifts for ${state}: 2020=${pop2020} 2023=${pop2023}`);

    const totalChange = pop2023 - pop2020;
    const changePercent = (totalChange / pop2020) * 100;
    const yearsSpan = 3; // 2020 to 2023 = 3 years
    const avgAnnualGrowth = changePercent / yearsSpan;

    return {
      startYear: 2020,
      endYear: 2023,
      startPop: pop2020,
      endPop: pop2023,
      totalChange,
      changePercent: Number(changePercent.toFixed(2)),
      avgAnnualGrowth: Number(avgAnnualGrowth.toFixed(3))
    };
  } catch (error) {
    console.error(`[census-data] Error calculating shifts:`, error);
    return null;
  }
}

// Fetch district-level population from ACS 2024
async function fetchDistrictPopulation(state: string, district: number, censusApiKey: string) {
  const cacheKey = `census-district-${state}-${district}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const fips = getStateFips(state);
    if (!fips) throw new Error(`Invalid state code: ${state}`);

    const districtStr = String(district).padStart(2, '0');
    const url = `https://api.census.gov/data/2024/acs/acs1?get=NAME,B01003_001E&for=congressional%20district:${districtStr}&in=state:${fips}&key=${censusApiKey}`;
    
    console.log(`[census-data] Fetching district population for ${state} District ${district}`);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[census-data] API error ${response.status}: ${errorText}`);
      throw new Error(`Census API error: ${response.status}`);
    }

    const rawData = await response.json() as any[];
    if (!Array.isArray(rawData) || rawData.length < 2) {
      throw new Error("Invalid response format");
    }

    const header = rawData[0];
    const dataRow = rawData[1];
    const popIndex = header.indexOf("B01003_001E");
    if (popIndex === -1) throw new Error("B01003_001E field not found");

    const population = parseInt(dataRow[popIndex], 10);
    if (isNaN(population)) throw new Error("Could not parse population value");

    const data = { year: 2024, state, district, population, source: "ACS 2024" };
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`[census-data] Error fetching district population:`, error);
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
  const district = url.searchParams.get("district");
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
    // If district is requested, fetch district population
    if (district) {
      const districtNum = parseInt(district, 10);
      if (isNaN(districtNum) || districtNum < 0 || districtNum > 98) {
        return new Response(
          JSON.stringify({
            error: "Invalid district number. Must be 0-98",
            code: "INVALID_PARAMS"
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const populationData = await fetchDistrictPopulation(state, districtNum, censusApiKey);
      return new Response(JSON.stringify({
        state,
        district: districtNum,
        data: populationData,
        timestamp: new Date().toISOString(),
      }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch state population
    const populationData = await fetchStatePopulation(state, censusApiKey);
    
    const response: any = {
      state,
      data: populationData,
      timestamp: new Date().toISOString(),
    };

    // Optionally include shifts (2020 Census to 2023 PEP)
    if (includeShifts) {
      response.shifts = await calculatePopulationShifts(state, populationData.population);
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
