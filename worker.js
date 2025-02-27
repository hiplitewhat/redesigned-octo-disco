addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Handle Requests
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');

  try {
    if (path === '/') {
      return handleIndex(request, userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(path, userAgent);
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

// **Session Handling**
function getSessionUser(cookieHeader) {
  const cookies = Object.fromEntries(cookieHeader.split("; ").map(c => c.split("=")));
  return cookies.sessionUser || null;
}

function setSessionCookie(username) {
  return `sessionUser=${username}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie() {
  return `sessionUser=; Path=/; HttpOnly; Max-Age=0`;
}

// **Home Page**
async function handleIndex(request, userAgent) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const sessionUser = getSessionUser(cookieHeader);
    const notes = await getNotesFromGitHub(userAgent);

    const noteLinks = Object.keys(notes)
      .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
      .join('');

    let loginSection = sessionUser
      ? `<p>Welcome, ${sessionUser}!</p>
         <form action="/logout" method="POST">
           <input type="submit" value="Logout">
         </form>`
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

    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Code Notes</title></head>
      <body>
        <h1>Code Notes</h1>
        <ul>${noteLinks}</ul>
        <h2>Create Note</h2>
        <form action="/save" method="POST">
          <input type="text" name="noteId" placeholder="Note ID" required><br>
          <textarea name="content" rows="5" cols="30" placeholder="Write your note..." required></textarea><br>
          <input type="submit" value="Save Note">
        </form>
        ${loginSection}
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error in handleIndex:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// **Note Handling**
async function handleNote(path, userAgent) {
  try {
    const noteId = path.substring(6);
    const notes = await getNotesFromGitHub(userAgent);

    if (!notes[noteId]) {
      return new Response("Note Not Found", { status: 404 });
    }

    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Note: ${noteId}</title></head>
      <body>
        <h1>Note: ${noteId}</h1>
        <pre>${notes[noteId]}</pre>
        <a href="/">Back</a>
      </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });
  } catch (error) {
    console.error("Error in handleNote:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function handleSave(request, userAgent) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const sessionUser = getSessionUser(cookieHeader);
    if (!sessionUser) return new Response("Unauthorized", { status: 401 });

    const formData = await request.formData();
    const noteId = formData.get("noteId");
    const content = formData.get("content");

    if (!noteId || !content) return new Response("Missing Data", { status: 400 });

    const notes = await getNotesFromGitHub(userAgent);
    notes[noteId] = content;
    await saveNotesToGitHub(notes, userAgent);

    return Response.redirect(`/note/${noteId}`, 302);
  } catch (error) {
    console.error("Error in handleSave:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// **User Authentication**
async function handleRegister(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  if (!username || !password) return new Response('Missing Data', { status: 400 });

  const users = await getUsersFromGitHub(userAgent);
  if (users[username]) return new Response('User Exists', { status: 409 });

  users[username] = btoa(password);
  await saveUsersToGitHub(users, userAgent);

  return new Response('Registration successful', { status: 200 });
}

async function handleLogin(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  if (!username || !password) return new Response('Missing Data', { status: 400 });

  const users = await getUsersFromGitHub(userAgent);
  if (users[username] && users[username] === btoa(password)) {
    return new Response('Login Successful', { headers: { 'Set-Cookie': setSessionCookie(username) } });
  } else {
    return new Response('Unauthorized', { status: 401 });
  }
}

function handleLogout() {
  return new Response('Logged out', { headers: { 'Set-Cookie': clearSessionCookie() } });
}

// **GitHub Helpers**
async function getUsersFromGitHub(userAgent) {
  return fetchGitHubFile('K.json', userAgent);
}

async function saveUsersToGitHub(users, userAgent) {
  await saveGitHubFile('K.json', users, userAgent);
}

async function getNotesFromGitHub(userAgent) {
  return fetchGitHubFile('j.json', userAgent);
}

async function saveNotesToGitHub(notes, userAgent) {
  await saveGitHubFile('j.json', notes, userAgent);
}

async function fetchGitHubFile(filename, userAgent) {
  const response = await fetch(`https://api.github.com/repos/YOUR_USER/YOUR_REPO/contents/${filename}`, {
    headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
  });

  if (!response.ok) return {};
  const data = await response.json();
  return data.content ? JSON.parse(atob(data.content)) : {};
}

async function saveGitHubFile(filename, content, userAgent) {
  await fetch(`https://api.github.com/repos/YOUR_USER/YOUR_REPO/contents/${filename}`, {
    method: 'PUT',
    headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    body: JSON.stringify({ message: 'Update', content: btoa(JSON.stringify(content)) }),
  });
}
