addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// ✅ Handle Requests
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionUser = getSessionUser(cookieHeader);

  try {
    if (path === '/') {
      return handleIndex(sessionUser, userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(path.substring(6), userAgent);
    } else if (path === '/save' && request.method === 'POST') {
      return handleSave(request, userAgent, sessionUser);
    } else if (path === '/login' && request.method === 'POST') {
      return handleLogin(request, userAgent);
    } else if (path === '/register' && request.method === 'POST') {
      return handleRegister(request, userAgent);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ✅ Get Logged-in User
function getSessionUser(cookieHeader) {
  const cookies = Object.fromEntries(cookieHeader.split("; ").map(c => c.split("=")));
  return cookies.sessionUser || null;
}

// ✅ Login Handler
async function handleLogin(request, userAgent) {
  try {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (!username || !password) {
      return new Response('Missing Username or Password', { status: 400 });
    }

    const users = await getUsersFromGitHub(userAgent);

    if (users[username] && users[username] === btoa(password)) {
      const headers = new Headers({ 'Set-Cookie': setSessionCookie(username) });
      return new Response('Login Successful', { status: 200, headers });
    } else {
      return new Response('Unauthorized', { status: 401 });
    }
  } catch (error) {
    console.error('Error in handleLogin:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ✅ Register Handler
async function handleRegister(request, userAgent) {
  try {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (!username || !password) {
      return new Response('Missing Username or Password', { status: 400 });
    }

    const users = await getUsersFromGitHub(userAgent);
    
    if (users[username]) {
      return new Response('Username already exists', { status: 409 });
    }

    users[username] = btoa(password);
    await saveUsersToGitHub(users, userAgent);

    return new Response('Registration successful', { status: 200 });
  } catch (error) {
    console.error('Error in handleRegister:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ✅ Save Note
async function handleSave(request, userAgent, sessionUser) {
  try {
    if (!sessionUser) {
      return new Response("Unauthorized", { status: 401 });
    }

    const formData = await request.formData();
    const noteId = formData.get("noteId");
    const content = formData.get("content");

    if (!noteId || !content) {
      return new Response("Missing Note ID or Content", { status: 400 });
    }

    const notes = await getNotesFromGitHub(userAgent);
    notes[noteId] = content;
    await saveNotesToGitHub(notes, userAgent);

    return Response.redirect(`/note/${noteId}`, 302);
  } catch (error) {
    console.error("Error in handleSave:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ✅ View Note
async function handleNote(noteId, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);

    if (!notes[noteId]) {
      return new Response("Note Not Found", { status: 404 });
    }

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
  } catch (error) {
    console.error("Error in handleNote:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ✅ Homepage
async function handleIndex(sessionUser, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    const noteLinks = Object.keys(notes)
      .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
      .join('');

    let loginSection = sessionUser ? `
      <p>Welcome, ${sessionUser}!</p>
      <form action="/logout" method="POST">
        <input type="submit" value="Logout">
      </form>
    ` : `
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

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>Code Notes</title></head>
      <body>
        <h1>Code Notes</h1>
        <ul>${noteLinks}</ul>
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

// ✅ GitHub Helper Functions
async function getUsersFromGitHub(userAgent) {
  return getGitHubFile('K.json', userAgent);
}

async function saveUsersToGitHub(users, userAgent) {
  return saveGitHubFile('K.json', users, userAgent);
}

async function getNotesFromGitHub(userAgent) {
  return getGitHubFile('j.json', userAgent);
}

async function saveNotesToGitHub(notes, userAgent) {
  return saveGitHubFile('j.json', notes, userAgent);
}

async function getGitHubFile(filename, userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/${filename}`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    if (!response.ok) return {};
    const data = await response.json();
    return data.content ? JSON.parse(atob(data.content)) : {};
  } catch (error) {
    console.error(`Error getting ${filename}:`, error);
    return {};
  }
}

async function saveGitHubFile(filename, content, userAgent) {
  try {
    const existingFile = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/${filename}`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    let sha = existingFile.ok ? (await existingFile.json()).sha : undefined;

    await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/${filename}`, {
      method: 'PUT',
      headers: {
        Authorization: `token YOUR_GITHUB_TOKEN`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        message: `Update ${filename}`,
        content: btoa(JSON.stringify(content)),
        sha: sha,
      }),
    });
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
  }
}
