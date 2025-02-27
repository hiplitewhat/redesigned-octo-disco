addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const GITHUB_OWNER = 'Hiplitehehe'; // Replace with your GitHub username
    const GITHUB_REPO = 'Note'; // Replace with your GitHub repository name
    const GITHUB_TOKEN = env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
      return new Response('GitHub token not set.', { status: 500 });
    }

    if (path === '/login' && method === 'POST') {
      return handleLogin(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    } else if (path === '/dashboard') {
      return handleDashboard(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    } else if (path.startsWith('/view_note/')) {
      return handleViewNote(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path.substring(11));
    } else if (path.startsWith('/raw_note/')) {
      return handleRawNote(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path.substring(10));
    } else if (path === '/new_note' && method === 'POST') {
      return handleNewNote(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    } else if (path === '/register' && method === 'POST') {
      return handleRegister(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    } else if (path.startsWith('/edit_note/') && method === 'POST') {
      return handleEditNote(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path.substring(11));
    } else if (path.startsWith('/delete_note/') && method === 'POST') {
      return handleDeleteNote(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path.substring(13));
    } else if (path === '/admin' && method === 'POST') {
      return handleAdmin(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    } else if (path === '/logout') {
      return handleLogout(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    }

    // Default routes for GET requests
    if (path === 'n9.mcst.io:35834/') {
      return Response.redirect('n9.mcst.io:35834/login', 302);
    } else if (path === 'n9.mcst.io:35834/login') {
      return renderTemplate('login.html');
    } else if (path === 'n9.mcst.io:35834/dashboard') {
      return handleDashboard(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    } else if (path.startsWith('n9.mcst.io:35834/view_note/')) {
      return handleViewNote(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path.substring(11));
    } else if (path === 'n9.mcst.io:35834/new_note') {
      return renderTemplate('new_note.html');
    } else if (path === 'n9.mcst.io:35834/register') {
      return renderTemplate('register.html');
    } else if (path.startsWith('n9.mcst.io:35834/edit_note/')) {
      return handleEditNote(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path.substring(11));
    } else if (path === 'n9.mcst.io:35834/admin') {
      return handleAdmin(request, env, GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// --- GitHub Interaction Functions ---
async function fetchGitHubFile(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path) {
  const url = `https://api.github.com/repos/<span class="math-inline">\{GITHUB\_OWNER\}/</span>{GITHUB_REPO}/contents/${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw+json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const content = JSON.parse(atob(data.content));
  return [content, data.sha];
}

async function updateGitHubFile(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, path, content, sha, message) {
  const url = `https://api.github.com/repos/<span class="math-inline">\{GITHUB\_OWNER\}/</span>{GITHUB_REPO}/contents/${path}`;
  const encodedContent = btoa(JSON.stringify(content, null, 4));
  return fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: encodedContent, sha }),
  });
}

// --- Data Access Functions ---
async function getNotes(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN) {
  return fetchGitHubFile(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, 'Notes.json');
}

async function saveNotes(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, notes, message) {
  const [_, sha] = await getNotes(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
  return updateGitHubFile(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, 'Notes.json', notes, sha, message);
}

async function getUsers(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN) {
  return fetchGitHubFile(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, 'Users.json');
}

async function saveUsers(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, users, message) {
  const [_, sha] = await getUsers(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
  return updateGitHubFile(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, 'Users.json', users, sha, message);
}

// --- User Authentication and Session Functions ---
async function getUserById(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, userId) {
  const [users, _] = await getUsers(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN);
  return users.find(user => user.id === parseInt(userId));
}

async function createSession(userId) {
  return btoa(`<span class="math-inline">\{userId\}\:</span>{Date.now()}`);
}

async function getSession(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader
    .split(';')
    .find(cookie => cookie.trim().startsWith('session='));
  if (!sessionCookie) return null;
  const sessionToken = sessionCookie.split('=')[1];
  if (!sessionToken) return null;
  try {
    const [userId, _] = atob(sessionToken).split(':');
    return { userId: parseInt(userId) };
  } catch (e) {
    return null;
  }
}

async function verifyPassword(password, hashedPassword) {
  return password === hashedPassword;
}

async function hashPassword(password) {
  return password;
}

// --- Image Upload Function 
async function uploadImageToGithub(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, imageFile) {
  const filename = `${Date.now()}-${imageFile.name}`;
  const path = `images/${filename}`;
  const content = btoa(await imageFile.arrayBuffer());
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload image ${filename}`,
        content: content,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload image: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}
