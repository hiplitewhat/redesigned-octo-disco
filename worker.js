const GITHUB_TOKEN = "your_personal_access_token_here";
const REPO_OWNER = "Hiplitehehe";
const REPO_NAME = "Notes";

// Handles incoming requests
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get("User-Agent");

  try {
    if (path === "/") {
      return serveStaticFile("index.html");
    } else if (path.startsWith("/note/")) {
      return handleNote(path.substring(6), userAgent);
    } else if (path === "/save" && request.method === "POST") {
      return handleSave(request, userAgent);
    } else if (path === "/login" && request.method === "POST") {
      return handleLogin(request, userAgent);
    } else if (path === "/register" && request.method === "POST") {
      return handleRegister(request, userAgent);
    } else {
      return new Response("Not Found", { status: 404 });
    }
  } catch (error) {
    console.error("Error in handleRequest:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Serve static HTML file
async function serveStaticFile(filename) {
  return new Response(await fetch(`https://raw.githubusercontent.com/Hiplitehehe/Notes/refs/heads/main/${filename}`).then(res => res.text()), {
    headers: { "Content-Type": "text/html" }
  });
}

// Get session user from cookies
function getSessionUser(cookieHeader) {
  const cookies = Object.fromEntries(cookieHeader.split("; ").map(c => c.split("=")));
  return cookies.sessionUser || null;
}

// Set session cookie
function setSessionCookie(username) {
  return `sessionUser=${username}; Path=/; HttpOnly`;
}

// Clear session cookie
function clearSessionCookie() {
  return `sessionUser=; Path=/; HttpOnly; Max-Age=0`;
}

// Fetch users from GitHub
async function getUsersFromGitHub(userAgent) {
  return fetchGitHubFile("K.json", userAgent);
}

// Save users to GitHub
async function saveUsersToGitHub(users, userAgent) {
  return saveGitHubFile("K.json", users, userAgent);
}

// Fetch notes from GitHub
async function getNotesFromGitHub(userAgent) {
  return fetchGitHubFile("j.json", userAgent);
}

// Save notes to GitHub
async function saveNotesToGitHub(notes, userAgent) {
  return saveGitHubFile("j.json", notes, userAgent);
}

// Fetch a file from GitHub
async function fetchGitHubFile(filename, userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": userAgent },
    });

    if (!response.ok) return {};

    const data = await response.json();
    return JSON.parse(atob(data.content));
  } catch (error) {
    console.error(`Error fetching ${filename}:`, error);
    return {};
  }
}

// Save a file to GitHub
async function saveGitHubFile(filename, data, userAgent) {
  try {
    const existingFile = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": userAgent },
    });

    let sha = undefined;
    if (existingFile.ok) {
      const fileData = await existingFile.json();
      sha = fileData.sha;
    }

    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({
        message: `Update ${filename}`,
        content: btoa(JSON.stringify(data)),
        sha: sha,
      }),
    });
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
  }
}

// Handle login
async function handleLogin(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (!username || !password) return new Response("Missing Username or Password", { status: 400 });

  const users = await getUsersFromGitHub(userAgent);

  if (users[username] && users[username] === btoa(password)) {
    const headers = new Headers();
    headers.append("Set-Cookie", setSessionCookie(username));
    headers.append("Content-Type", "text/plain");

    return new Response("Login Successful", { status: 200, headers });
  } else {
    return new Response("Unauthorized", { status: 401 });
  }
}

// Handle register
async function handleRegister(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (!username || !password) return new Response("Missing Username or Password", { status: 400 });

  const users = await getUsersFromGitHub(userAgent);

  if (users[username]) return new Response("Username already exists", { status: 409 });

  users[username] = btoa(password);
  await saveUsersToGitHub(users, userAgent);

  return new Response("Registration successful", { status: 200 });
}

// Handle saving a note
async function handleSave(request, userAgent) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionUser = getSessionUser(cookieHeader);

  if (!sessionUser) return new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const noteId = formData.get("noteId");
  const content = formData.get("content");

  if (!noteId || !content) return new Response("Missing Note ID or Content", { status: 400 });

  const notes = await getNotesFromGitHub(userAgent);
  notes[noteId] = content;
  await saveNotesToGitHub(notes, userAgent);

  return new Response("Note Saved", { status: 200 });
}

// Handle viewing a note
async function handleNote(noteId, userAgent) {
  const notes = await getNotesFromGitHub(userAgent);
  if (!notes[noteId]) return new Response("Note Not Found", { status: 404 });

  return new Response(`<h1>${noteId}</h1><p>${notes[noteId]}</p>`, {
    headers: { "Content-Type": "text/html" },
  });
}
