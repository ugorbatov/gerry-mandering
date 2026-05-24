import type { Context, Config } from "@netlify/functions";

// In-memory cache (per function instance)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours - news changes frequently

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  author?: string;
}

interface NewsResponse {
  repName: string;
  articles: NewsArticle[];
  totalResults: number;
  cached: boolean;
}

/**
 * Fetch news from NewsAPI for a representative
 */
async function fetchNewsForRep(
  repName: string,
  state?: string,
  daysBack: number = 30
): Promise<NewsArticle[]> {
  const apiKey = Netlify.env.get("NEWSAPI_KEY");
  
  if (!apiKey) {
    console.log("NEWSAPI_KEY not found in environment");
    return [];
  }

  try {
    // Clean the name - strip suffixes that mess up search
    // "Frank Pallone, Jr." -> "Frank Pallone"
    const cleanName = repName
      .replace(/,?\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '')
      .trim();
    
    // Build search query - rep name in quotes
    const query = `"${cleanName}"`;
    
    // Calculate date range - free tier limit is ~30 days back maximum
    const fromDate = new Date();
    const actualDaysBack = Math.min(daysBack, 25);
    fromDate.setDate(fromDate.getDate() - actualDaysBack);
    const fromDateStr = fromDate.toISOString().split('T')[0];
    
    const params = new URLSearchParams({
      q: query,
      from: fromDateStr,
      searchIn: 'title,description',
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: '20',
      apiKey: apiKey,
    });
    
    const url = `https://newsapi.org/v2/everything?${params.toString()}`;
    console.log(`Fetching news for: ${repName}`);
    console.log(`Query: ${query}, from: ${fromDateStr}`);
    
    const response = await fetch(url);
    console.log(`NewsAPI response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`NewsAPI failed: ${response.status} - ${errorText.substring(0, 300)}`);
      return [];
    }
    
    const data = await response.json();
    
    if (data.status !== 'ok') {
      console.log(`NewsAPI error: ${data.message || 'Unknown error'} (code: ${data.code})`);
      return [];
    }
    
    console.log(`Got ${data.articles?.length || 0} articles for ${repName}`);
    
    // Sort by publishedAt date descending (newest first) to ensure correct order
    const sortedArticles = [...(data.articles || [])].sort((a, b) => {
      const dateA = new Date(a.publishedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || 0).getTime();
      return dateB - dateA;
    });
    
    // Map articles (NewsAPI already filtered by query)
    const articles: NewsArticle[] = sortedArticles
      .filter((article: any) => article.title && article.url && article.title !== '[Removed]')
      .slice(0, 10)
      .map((article: any) => ({
        title: article.title || '',
        description: article.description || '',
        url: article.url || '',
        source: article.source?.name || 'Unknown',
        publishedAt: article.publishedAt || '',
        imageUrl: article.urlToImage || undefined,
        author: article.author || undefined,
      }));
    
    return articles;
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const repName = url.searchParams.get("repName");
  const state = url.searchParams.get("state") || undefined;
  const daysBack = parseInt(url.searchParams.get("daysBack") || "30", 10);

  if (!repName) {
    return new Response(
      JSON.stringify({ error: "Missing repName parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check cache
  const cacheKey = `news-${repName}-${state || 'any'}-${daysBack}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const response: NewsResponse = {
      ...cached.data,
      cached: true
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
    });
  }

  try {
    const articles = await fetchNewsForRep(repName, state, daysBack);
    
    const result: NewsResponse = {
      repName,
      articles,
      totalResults: articles.length,
      cached: false,
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
    console.error("Error in rep-news handler:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch news",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/rep-news",
};
