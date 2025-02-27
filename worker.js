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

// ✅ Handle Index (Home Page)
async function handleIndex(request, userAgent) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionUser = getSessionUser(cookieHeader);
  const notes = await getNotesFromGitHub(userAgent);

  const noteLinks = Object.keys(notes)
    .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
    .join('');

  let loginSection = sessionUser
    ? `<p>Welcome, ${sessionUser}!</p>
       <form action="/logout" method="POST"><input type="submit" value="Logout"></form>`
    : `<h2>Login</h2>
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
       </form>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Code Notes</title></head>
    <body>
      <h1>Code Notes</h1>
      <ul>${noteLinks}</ul>
      <h2>Make a New Note</h2>
      <form action="/save" method="POST">
        <input type="text" name="noteId" placeholder="Note ID" required><br>
        <textarea name="content" rows="5" cols="30" placeholder="Write your note here..." required></textarea><br>
        <input type="submit" value="Save Note">
      </form>
      ${loginSection}
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// ✅ Handle Viewing Notes
async function handleNote(request, userAgent, noteId) {
  const notes = await getNotesFromGitHub(userAgent);
  if (!notes[noteId]) return new Response("Note Not Found", { status: 404 });

  const html = `
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
}

// ✅ Handle Saving Notes
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

  return Response.redirect(`/note/${noteId}`, 302);
}

// ✅ Handle User Login
async function handleLogin(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (!username || !password) return new Response("Missing credentials", { status: 400 });

  const users = await getUsersFromGitHub(userAgent);
  if (!users[username] || users[username].password !== password) {
    return new Response("Invalid credentials", { status: 401 });
  }

  return new Response("Logged in", {
    status: 200,
    headers: { "Set-Cookie": setSessionCookie(username) },
  });
}

// ✅ Handle User Registration
async function handleRegister(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (!username || !password) return new Response("Missing credentials", { status: 400 });

  const users = await getUsersFromGitHub(userAgent);
  if (users[username]) return new Response("Username already exists", { status: 409 });

  users[username] = { password };
  await saveUsersToGitHub(users, userAgent);

  return new Response("Registered successfully", {
    status: 200,
    headers: { "Set-Cookie": setSessionCookie(username) },
  });
}

// ✅ Handle Logout
function handleLogout() {
  return new Response("Logged out", {
    status: 200,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

// ✅ GitHub Helpers
async function getUsersFromGitHub(userAgent) {
  return fetchGitHubFile("K.json", userAgent);
}

async function saveUsersToGitHub(users, userAgent) {
  return saveGitHubFile("K.json", users, userAgent);
}

async function getNotesFromGitHub(userAgent) {
  return fetchGitHubFile("j.json", userAgent);
}

async function saveNotesToGitHub(notes, userAgent) {
  return saveGitHubFile("j.json", notes, userAgent);
}

async function fetchGitHubFile(file, userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/${file}`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    if (!response.ok) return {};
    const data = await response.json();
    return data.content ? JSON.parse(atob(data.content)) : {};
  } catch (error) {
    console.error(`Error fetching ${file}:`, error);
    return {};
  }
}

async function saveGitHubFile(file, data, userAgent) {
  try {
    const existingFile = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/${file}`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    let sha;
    if (existingFile.ok) {
      const fileData = await existingFile.json();
      sha = fileData.sha;
    }

    await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/${file}`, {
      method: 'PUT',
      headers: {
        Authorization: `token YOUR_GITHUB_TOKEN`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        message: `Update ${file}`,
        content: btoa(JSON.stringify(data)),
        sha: sha,
      }),
    });
  } catch (error) {
    console.error(`Error saving ${file}:`, error);
  }
}

function setSessionCookie(username) {
  return `sessionUser=${username}; Path=/; HttpOnly`;
}

function clearSessionCookie() {
  return `sessionUser=; Path=/; HttpOnly; Max-Age=0`;
}
