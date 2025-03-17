
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve HTML from KV
    if (url.pathname === "/") {
      const html = await env.NOTES_KV.get("index.html");
      if (!html) return new Response("HTML not found in KV", { status: 404 });
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // GitHub Login Redirect
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo`,
        302
      );
    }

    // GitHub OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const { access_token } = await tokenResponse.json();
      return new Response(`<script>localStorage.setItem("token", "${access_token}"); window.location.href = "/";</script>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Get Notes from GitHub
    if (url.pathname === "/get-notes") {
      const token = request.headers.get("Authorization");
      if (!token) return new Response("Unauthorized", { status: 401 });

      const notesResponse = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/notes.json`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (!notesResponse.ok) return new Response("Error fetching notes", { status: 500 });

      const notesData = await notesResponse.json();
      const content = atob(notesData.content);
      return new Response(content, { headers: { "Content-Type": "application/json" } });
    }

    // Save Notes to GitHub
    if (url.pathname === "/save-note") {
      const token = request.headers.get("Authorization");
      if (!token) return new Response("Unauthorized", { status: 401 });

      const { note } = await request.json();
      const existingNotesResponse = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/notes.json`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      let notes = [];
      let sha = "";

      if (existingNotesResponse.ok) {
        const existingNotes = await existingNotesResponse.json();
        sha = existingNotes.sha;
        notes = JSON.parse(atob(existingNotes.content));
      }

      notes.push(note);
      const content = btoa(JSON.stringify(notes, null, 2));

      const saveResponse = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/notes.json`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Updated notes", content, sha }),
      });

      if (!saveResponse.ok) return new Response("Error saving note", { status: 500 });
      return new Response("Note saved", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
