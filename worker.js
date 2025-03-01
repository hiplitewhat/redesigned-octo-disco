
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

    // 🔹 Approve Note (CORS Enabled)
    if (url.pathname === "/approve") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const token = authHeader.split(" ")[1];

      // Verify GitHub user
      const userResponse = await fetch("https://api.github.com/user", {
        headers: { 
          Authorization: `Bearer ${token}`,
          "User-Agent": "HipliteheheApp"
        },
      });

      const userData = await userResponse.json();
      if (!userData.login) return new Response("Invalid token", { status: 401 });

      if (!ALLOWED_USERS.includes(userData.login)) {
        return new Response("Permission denied: You cannot approve notes.", { status: 403 });
      }

      // Get note title from request
      const body = await request.json();
      if (!body.title) return new Response("Missing note title", { status: 400 });

      // Fetch current notes
      const repo = "hiplitehehe/notes";
      const notesFile = "j.json";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;
      
      let notes = [];
      let fileSha = "";

      const fetchNotes = await fetch(notesUrl, {
        headers: { 
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "HipliteheheApp"
        },
      });

      if (fetchNotes.ok) {
        const fileData = await fetchNotes.json();
        notes = JSON.parse(atob(fileData.content));
        fileSha = fileData.sha;
      }

      // Add approved note
      notes.push({ title: body.title, approved: true });

      // Update GitHub
      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "HipliteheheApp"
        },
        body: JSON.stringify({
          message: `Approved note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha: fileSha, 
        }),
      });

      if (!updateResponse.ok) {
        return new Response("Failed to approve note", { status: 500 });
      }

      return new Response(JSON.stringify({ message: `Note "${body.title}" approved!` }), {
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
