import type { Context, Config } from "@netlify/functions";

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

    // Fetch 2023 population
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

// Fetch multi-year population for calculating shifts (2020-2023)
async function fetchPopulationShifts(state: string, censusApiKey: string) {
  const cacheKey = `census-shifts-${state}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const fips = getStateFips(state);
    if (!fips) throw new Error(`Invalid state code: ${state}`);

    console.log(`[census-data] Fetching population shifts for ${state}`);

    // Fetch multiple years to calculate shifts
    const years = [2020, 2021, 2022, 2023];
    const populationByYear: Record<number, number> = {};

    for (const year of years) {
      const url = `https://api.census.gov/data/${year}/pep/charv?get=POP&for=state:${fips}&YEAR=${year}&key=${censusApiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`[census-data] Could not fetch year ${year}`);
        continue;
      }

      const rawData = await response.json() as any[];
      if (!Array.isArray(rawData) || rawData.length < 2) continue;

      const header = rawData[0];
      const dataRow = rawData[1];
      const popIndex = header.indexOf("POP");
      if (popIndex === -1) continue;

      const population = parseInt(dataRow[popIndex], 10);
      if (!isNaN(population)) {
        populationByYear[year] = population;
      }
    }

    if (Object.keys(populationByYear).length < 2) {
      throw new Error("Not enough years of data to calculate shifts");
    }

    const yearsSorted = Object.keys(populationByYear).map(Number).sort((a, b) => a - b);
    const startYear = yearsSorted[0];
    const endYear = yearsSorted[yearsSorted.length - 1];
    const startPop = populationByYear[startYear];
    const endPop = populationByYear[endYear];

    const totalChange = endPop - startPop;
    const changePercent = (totalChange / startPop) * 100;
    const yearsSpan = endYear - startYear;
    const avgAnnualGrowth = yearsSpan > 0 ? changePercent / yearsSpan : 0;

    const data = {
      startYear,
      endYear,
      startPop,
      endPop,
      totalChange,
      changePercent: Number(changePercent.toFixed(2)),
      avgAnnualGrowth: Number(avgAnnualGrowth.toFixed(3))
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`[census-data] Error calculating shifts:`, error);
    throw error;
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

    // Optionally include shifts
    if (includeShifts) {
      try {
        response.shifts = await fetchPopulationShifts(state, censusApiKey);
      } catch (err) {
        console.warn(`[census-data] Could not calculate shifts:`, err);
        response.shifts = null;
      }
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
