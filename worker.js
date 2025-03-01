
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ALLOWED_USERS = ["Hiplitehehe"];
    const repo = "Hiplitehehe/Notes";
    const notesFile = "j.json";
    const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
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
      if (!code) return new Response("Missing code", { status: 400, headers: corsHeaders });

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
        return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400, headers: corsHeaders });
      }

      return Response.redirect(
        `https://hiplitehehe.github.io/bookish-octo-robot/index.html?token=${tokenData.access_token}`,
        302
      );
    }

    // 🔹 Create a New Note
    if (url.pathname === "/make-note" && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }

      const token = authHeader.split(" ")[1];
      const userResponse = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userData = await userResponse.json();
      if (!userData.login) return new Response("Invalid token", { status: 401, headers: corsHeaders });

      const body = await request.json();
      if (!body.title || !body.content) return new Response("Missing title or content", { status: 400, headers: corsHeaders });

      let notes = [];
      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
      });

      let sha = null;
      if (fetchNotes.ok) {
        const fileData = await fetchNotes.json();
        sha = fileData.sha;
        notes = JSON.parse(atob(fileData.content));
      }

      notes.push({ title: body.title, content: body.content, approved: false });

      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Added note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha: sha || undefined,
        }),
      });

      if (!updateResponse.ok) {
        return new Response("Failed to save note", { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ message: `Note "${body.title}" created!` }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // 🔹 Approve Note (Only Allowed Users)
    if (url.pathname === "/approve" && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }

      const token = authHeader.split(" ")[1];
      const userResponse = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userData = await userResponse.json();
      if (!userData.login) return new Response("Invalid token", { status: 401, headers: corsHeaders });

      if (!ALLOWED_USERS.includes(userData.login)) {
        return new Response("Permission denied", { status: 403, headers: corsHeaders });
      }

      const body = await request.json();
      if (!body.title) return new Response("Missing note title", { status: 400, headers: corsHeaders });

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
      });

      let sha = null;
      let notes = [];
      if (fetchNotes.ok) {
        const fileData = await fetchNotes.json();
        sha = fileData.sha;
        notes = JSON.parse(atob(fileData.content));
      }

      const note = notes.find(n => n.title === body.title);
      if (!note) return new Response("Note not found", { status: 404, headers: corsHeaders });

      note.approved = true;

      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Approved note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha,
        }),
      });

      if (!updateResponse.ok) {
        return new Response("Failed to approve note", { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ message: `Note "${body.title}" approved!` }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // 🔹 Get Approved Notes
    if (url.pathname === "/notes") {
      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
      });

      if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500, headers: corsHeaders });

      const fileData = await fetchNotes.json();
      const notes = JSON.parse(atob(fileData.content));
      const approvedNotes = notes.filter(note => note.approved);

      return new Response(JSON.stringify(approvedNotes), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
