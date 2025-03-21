
export default {
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/login") {
      return handleLogin();
    } else if (url.pathname === "/callback") {
      return handleCallback(url);
    } else if (url.pathname === "/upload" && req.method === "POST") {
      return handleUpload(req);
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleLogin() {
  const clientId = "YOUR_GOOGLE_CLIENT_ID";
  const redirectUri = "YOUR_WORKER_URL/callback";
  const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&access_type=offline&prompt=consent`;

  return Response.redirect(authUrl, 302);
}

async function handleCallback(url) {
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

  const clientId = "YOUR_GOOGLE_CLIENT_ID";
  const clientSecret = "YOUR_GOOGLE_CLIENT_SECRET";
  const redirectUri = "YOUR_WORKER_URL/callback";

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const tokens = await tokenResponse.json();
  if (tokens.error) return new Response(tokens.error, { status: 400 });

  await MY_KV.put("youtube_tokens", JSON.stringify(tokens));

  return new Response("Login successful! Tokens saved.");
}

async function handleUpload(req) {
  const { videoUrl, title, description } = await req.json();

  const tokenData = await MY_KV.get("youtube_tokens");
  if (!tokenData) return new Response("❌ No login found.", { status: 403 });

  const tokens = JSON.parse(tokenData);
  const youtubeApi = "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status";
  
  const metadata = {
    snippet: { title, description, categoryId: "22" },
    status: { privacyStatus: "public" }
  };

  const videoResponse = await fetch(youtubeApi, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
  });

  const uploadData = await videoResponse.json();
  return new Response(JSON.stringify({ url: `https://www.youtube.com/watch?v=${uploadData.id}` }), { headers: { "Content-Type": "application/json" } });
}
