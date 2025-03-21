export default {
  async fetch(req) {
    const url = new URL(req.url);

    // Allow cross-origin requests
    const headers = {
      "Access-Control-Allow-Origin": "*", // Adjust as needed for your specific origin
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      // Handle preflight request
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/login") {
      return handleLogin(headers);
    } else if (url.pathname === "/callback") {
      return handleCallback(url, headers);
    } else if (url.pathname === "/upload" && req.method === "POST") {
      return handleUpload(req, headers);
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleLogin(headers) {
  const clientId = "790695082520-ruumnpram2c2md8icib6vljm0h0tqq7u.apps.googleusercontent.com";
  const redirectUri = "https://falling-heart-7255.hiplitehehe.workers.dev/callback";
  const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&access_type=offline&prompt=consent`;

  return new Response(null, { status: 302, headers: { ...headers, Location: authUrl } });
}

async function handleCallback(url, headers) {
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400, headers });

  const clientId = "790695082520-ruumnpram2c2md8icib6vljm0h0tqq7u.apps.googleusercontent.com";
  const clientSecret = "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";
  const redirectUri = "https://falling-heart-7255.hiplitehehe.workers.dev/callback";

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
  if (tokens.error) return new Response(tokens.error, { status: 400, headers });

  await MY_KV.put("youtube_tokens", JSON.stringify(tokens));

  return new Response("Login successful! Tokens saved.", { headers });
}

async function handleUpload(req, headers) {
  const formData = await req.formData();
  const videoFile = formData.get("video");
  const title = formData.get("title");
  const description = formData.get("description");

  const tokenData = await MY_KV.get("youtube_tokens");
  if (!tokenData) return new Response("❌ No login found.", { status: 403, headers });

  const tokens = JSON.parse(tokenData);
  
  const youtubeApi = "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status";
  
  const metadata = {
    snippet: { title, description, categoryId: "22" },
    status: { privacyStatus: "public" }
  };

  // Upload the video file to YouTube
  const videoResponse = await fetch(youtubeApi, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
  });

  const uploadData = await videoResponse.json();
  return new Response(JSON.stringify({ videoId: uploadData.id }), { headers: { "Content-Type": "application/json", ...headers } });
}
