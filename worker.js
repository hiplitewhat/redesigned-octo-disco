addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');

  try {
    if (path === '/') {
      return handleIndex(request, userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(request, userAgent, path.substring(6));
    } else if (path === '/save' && request.method === 'POST') {
      return handleSave(request, userAgent);
    } else if (path === '/login' && request.method === 'POST') {
      return handleLogin(request, userAgent);
    } else if (path === '/register' && request.method === 'POST') {
      return handleRegister(request, userAgent);
    } else if (path === '/logout' && request.method === 'POST') {
      return handleLogout();
    } else {
      return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ✅ GitHub Helpers
const GITHUB_API = "https://api.github.com";
const OWNER = "Hiplitehehe";
const REPO = "Note";
const FILE_USERS = "K.json";  // Stores user data
const FILE_NOTES = "j.json";  // Stores notes
const TOKEN = "your-github-token"; // Personal Access Token

async function fetchGitHubFile(filename, userAgent) {
  const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${filename}`;
  const response = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}`, "User-Agent": userAgent },
  });

  if (!response.ok) {
    if (response.status === 404) return {}; // If file doesn't exist, return empty object
    throw new Error(`GitHub API Error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(atob(data.content)); // Decode Base64 content
}

async function saveGitHubFile(filename, data, userAgent) {
  const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${filename}`;
  const existingData = await fetchGitHubFile(filename, userAgent);
  const sha = existingData.sha || null; // File SHA for updating

  const response = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `token ${TOKEN}`, "User-Agent": userAgent, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Update ${filename}`,
      content: btoa(JSON.stringify(data, null, 2)), // Encode to Base64
      sha: sha, // Required for updating
    }),
  });

  if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
}

async function getUsersFromGitHub(userAgent) {
  return await fetchGitHubFile(FILE_USERS, userAgent);
}

async function saveUsersToGitHub(users, userAgent) {
  await saveGitHubFile(FILE_USERS, users, userAgent);
}

async function getNotesFromGitHub(userAgent) {
  return await fetchGitHubFile(FILE_NOTES, userAgent);
}

async function saveNotesToGitHub(notes, userAgent) {
  await saveGitHubFile(FILE_NOTES, notes, userAgent);
}

// ✅ Handle Homepage (Notes List & Login)
async function handleIndex(request, userAgent) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const sessionUser = getSessionUser(cookieHeader);

    const notes = await getNotesFromGitHub(userAgent);
    const noteLinks = Object.keys(notes)
      .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
      .join('');

    let loginSection = `
      <h2>Login</h2>
      <form action="/login" method="POST">
        <input type="text" name="username" placeholder="Username" required><br>
        <input type="password" name="password" placeholder="Password" required><br>
        <input type="submit" value="Login">
      </form>

      <h2>Register</h2>
      <form action="/register" method="POST">
        <input type="text" name="username" placeholder="Username" required><br>
        <input type="password" name="password" placeholder="Password" required><br>
        <input type="submit" value="Register">
      </form>
    `;

    let noteSection = "<p>Log in to create notes.</p>";
    if (sessionUser) {
      loginSection = `
        <p>Welcome, ${sessionUser}!</p>
        <form action="/logout" method="POST">
          <input type="submit" value="Logout">
        </form>
      `;

      noteSection = `
        <h2>Make a New Note</h2>
        <form action="/save" method="POST">
          <input type="text" name="noteId" placeholder="Note ID" required><br>
          <textarea name="content" rows="5" cols="30" placeholder="Write your note here..." required></textarea><br>
          <input type="submit" value="Save Note">
        </form>
      `;
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>Code Notes</title></head>
      <body>
        <h1>Code Notes</h1>
        <ul>${noteLinks}</ul>
        ${noteSection}
        ${loginSection}
      </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error in handleIndex:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ✅ Session Helpers
function getSessionUser(cookieHeader) {
  const cookies = Object.fromEntries(cookieHeader.split("; ").map(c => c.split("=")));
  return cookies.sessionUser || null;
}

function setSessionCookie(username) {
  return `sessionUser=${username}; Path=/; HttpOnly`;
}

function clearSessionCookie() {
  return `sessionUser=; Path=/; HttpOnly; Max-Age=0`;
}

// ✅ Handle Viewing a Note
async function handleNote(request, userAgent, noteId) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    if (!notes[noteId]) return new Response("Note Not Found", { status: 404 });

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>Note: ${noteId}</title></head>
      <body>
        <h1>Note: ${noteId}</h1>
        <pre>${notes[noteId]}</pre>
        <a href="/">Back to Notes</a>
      </body>
      </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  } catch (error) {
    console.error("Error in handleNote:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ✅ Handle Saving Notes
async function handleSave(request, userAgent) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const sessionUser = getSessionUser(cookieHeader);

    if (!sessionUser) return new Response("Unauthorized", { status: 401 });

    const formData = await request.formData();
    const noteId = formData.get("noteId");
    const content = formData.get("content");

    if (!noteId || !content) return new Response("Missing data", { status: 400 });

    const notes = await getNotesFromGitHub(userAgent);
    notes[noteId] = content;

    await saveNotesToGitHub(notes, userAgent);

    return Response.redirect(`/note/${noteId}`, 302);
  } catch (error) {
    console.error("Error in handleSave:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
