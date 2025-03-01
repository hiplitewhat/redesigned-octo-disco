
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ALLOWED_USERS = ["Hiplitehehe"]; // Replace with your GitHub username

    // Handle CORS Preflight Requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // 🔹 GitHub Login Redirect
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
        302
      );
    }

    // 🔹 GitHub OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.REDIRECT_URI
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400 });
      }

      return Response.redirect(
        `https://hiplitehehe.github.io/bookish-octo-robot/index.html?token=${tokenData.access_token}`,
        302
      );
    }

    // 🔹 Get Only Approved Notes (CORS Enabled)
    if (url.pathname === "/notes") {
      const repo = "Hiplitehehe/Notes";
      const notesFile = "j.json";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

      const fetchNotes = await fetch(notesUrl, {
        headers: { 
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "HipliteheheApp"
        },
      });

      if (!fetchNotes.ok) {
        return new Response("Failed to fetch notes", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
      }

      const fileData = await fetchNotes.json();
      const notes = JSON.parse(atob(fileData.content));

      // Filter only approved notes
      const approvedNotes = notes.filter(note => note.approved);

      return new Response(JSON.stringify(approvedNotes), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 200,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
