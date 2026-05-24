import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const apiKey = Netlify.env.get("CONGRESS_API_KEY") || "";
  
  const checks = {
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey.length,
    timestamp: new Date().toISOString(),
    results: [] as any[]
  };

  // Test 1: Simple member endpoint
  try {
    const url = `https://api.congress.gov/v3/member/L000554`;
    const headers: any = {
      "Content-Type": "application/json",
    };
    
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }
    
    const response = await fetch(url, { headers });
    
    checks.results.push({
      test: "Fetch single member",
      status: response.status,
      ok: response.ok,
      url: url,
      responseTime: "see network tab"
    });

    if (response.ok) {
      const data = await response.json();
      checks.results.push({
        test: "Parse JSON response",
        status: "ok",
        dataKeys: Object.keys(data),
        hasMembersArray: !!data.members
      });
    }
  } catch (error) {
    checks.results.push({
      test: "Fetch single member",
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }

  // Test 2: Query with parameters
  try {
    const url = `https://api.congress.gov/v3/member?state=NJ&currentMember=true`;
    const headers: any = {
      "Content-Type": "application/json",
    };
    
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }
    
    const response = await fetch(url, { headers });
    
    checks.results.push({
      test: "Query NJ members",
      status: response.status,
      ok: response.ok,
      membersCount: response.ok ? (await response.json()).members?.length : "N/A"
    });
  } catch (error) {
    checks.results.push({
      test: "Query NJ members",
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

export const config: Config = {
  path: "/api/health-check",
};
