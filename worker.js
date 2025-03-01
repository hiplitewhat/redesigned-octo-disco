
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ALLOWED_USERS = ["Hiplitehehe"];
    const REPO = "Hiplitehehe/Notes"; // Change if needed
    const NOTES_FILE = "j.json";
    const NOTES_URL = `https://api.github.com/repos/${REPO}/contents/${NOTES_FILE}`;
    const HEADERS = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Cloudflare Worker",
    };

    // 🔹 GitHub Login
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
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.REDIRECT_URI,
        }),
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

    // 🔹 Approve Note (Only Allowed Users)
    if (url.pathname === "/approve") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const token = authHeader.split(" ")[1];

      // Verify GitHub user
      const userResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}` } });
      const userData = await userResponse.json();
      if (!userData.login || !ALLOWED_USERS.includes(userData.login)) {
        return new Response("Permission denied", { status: 403 });
      }

      const body = await request.json();
      if (!body.title || !body.content) return new Response("Missing title or content", { status: 400 });

      // Fetch existing notes
      let notes = [];
      const fetchNotes = await fetch(NOTES_URL, { headers: HEADERS });

      let sha = null;
      if (fetchNotes.ok) {
        const fileData = await fetchNotes.json();
        sha = fileData.sha;
        notes = JSON.parse(atob(fileData.content));
      }

      notes.push({ title: body.title, content: body.content, approved: true });

      // Update GitHub file
      const updateResponse = await fetch(NOTES_URL, {
        method: "PUT",
        headers: { ...HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Approved note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha,
        }),
      });

      if (!updateResponse.ok) return new Response("Failed to approve note", { status: 500 });

      return new Response(JSON.stringify({ message: `Note "${body.title}" approved!` }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 200,
      });
    }

    // 🔹 Get Approved Notes
    if (url.pathname === "/notes") {
      const fetchNotes = await fetch(NOTES_URL, { headers: HEADERS });
      if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

      const fileData = await fetchNotes.json();
      const notes = JSON.parse(atob(fileData.content));

      // Filter only approved notes
      const approvedNotes = notes.filter(note => note.approved);

      return new Response(JSON.stringify(approvedNotes), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 200,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
