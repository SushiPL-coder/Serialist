// functions/api/tmdb-search.js
// Proxies TMDB TV search — keeps API key server-side
// Requires env variable: TMDB_API_KEY

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url   = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query) return json({ results: [] });

  const apiKey = env.TMDB_API_KEY;
  if (!apiKey) return json({ error: 'TMDB_API_KEY not configured', results: [] }, 500);

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=pl-PL&page=1`;
    const res = await fetch(tmdbUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });
    const data = await res.json();
    return json({ results: data.results?.slice(0, 8) || [] });
  } catch (e) {
    return json({ error: e.message, results: [] }, 502);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
