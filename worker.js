addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');
  const cookies = request.headers.get('Cookie') || '';
  const session = cookies.split('; ').find(c => c.startsWith('session='))?.split('=')[1];

  try {
    if (path === '/') {
      return handleIndex(session, userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(path.substring(6), userAgent);
    } else if (path === '/save' && request.method === 'POST' && session) {
      return handleSave(request, userAgent);
    } else if (path === '/register' && request.method === 'POST') {
      return handleRegister(request, userAgent);
    } else if (path === '/login' && request.method === 'POST') {
      return handleLogin(request, userAgent);
    } else if (path === '/logout') {
      return handleLogout();
    } else {
      return new Response('Unauthorized or Not Found', { status: 401 });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ------------------------- User Authentication -------------------------

const USERS_FILE = 'users.json';
const NOTES_FILE = 'j.json';

async function handleRegister(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  if (!username || !password) {
    return new Response('Missing username or password', { status: 400 });
  }

  const users = await getUsersFromGitHub(userAgent);

  if (users[username]) {
    return new Response('Username already exists', { status: 400 });
  }

  users[username] = { password };

  await saveUsersToGitHub(users, userAgent);

  return new Response('Registration successful! <a href="/">Go to Notes</a>', {
    headers: { 'Content-Type': 'text/html' },
  });
}

async function handleLogin(request, userAgent) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  if (!username || !password) {
    return new Response('Missing username or password', { status: 400 });
  }

  const users = await getUsersFromGitHub(userAgent);

  if (!users[username] || users[username].password !== password) {
    return new Response('Invalid username or password', { status: 401 });
  }

  return new Response('Login successful! <a href="/">Go to Notes</a>', {
    headers: {
      'Set-Cookie': `session=${username}; Path=/; HttpOnly`,
      'Content-Type': 'text/html',
    },
  });
}

function handleLogout() {
  return new Response('Logged out. <a href="/">Back to Notes</a>', {
    headers: {
      'Set-Cookie': 'session=; Max-Age=0; Path=/;',
      'Content-Type': 'text/html',
    },
  });
}

// ------------------------- Notes Handling -------------------------

async function handleIndex(session, userAgent) {
  const notes = await getNotesFromGitHub(userAgent);
  const noteLinks = Object.keys(notes)
    .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
    .join('');

  const loginOrLogout = session
    ? `<a href="/logout">Logout</a>`
    : `<a href="/login">Login</a> | <a href="/register">Register</a>`;

  const saveForm = session
    ? `
        <form action="/save" method="POST">
          <input type="text" name="noteId" placeholder="Note ID"><br>
          <textarea name="content" rows="5" cols="30" placeholder="Content"></textarea><br>
          <input type="submit" value="Save">
        </form>`
    : `<p><a href="/login">Login to add notes</a></p>`;

  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><title>Code Notes</title></head>
    <body>
      <h1>Code Notes</h1>
      <ul>${noteLinks}</ul>
      ${saveForm}
      ${loginOrLogout}
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
}

async function handleNote(noteId, userAgent) {
  const notes = await getNotesFromGitHub(userAgent);
  const noteContent = notes[noteId];

  if (!noteContent) {
    return new Response('Note Not Found', { status: 404 });
  }

  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><title>Note: ${noteId}</title></head>
    <body>
      <h1>Note: ${noteId}</h1>
      <pre>${noteContent}</pre>
      <a href="/">Back</a>
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
}

async function handleSave(request, userAgent) {
  const formData = await request.formData();
  const noteId = formData.get('noteId');
  const content = formData.get('content');

  if (!noteId || !content) {
    return new Response('Missing Note ID or Content', { status: 400 });
  }

  const notes = await getNotesFromGitHub(userAgent);
  notes[noteId] = content;
  await saveNotesToGitHub(notes, userAgent);

  return Response.redirect(`/note/${noteId}`, 302);
}

// ------------------------- GitHub Interaction -------------------------

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';
const GITHUB_OWNER = 'Hiplitehehe';
const GITHUB_REPO = 'Notes';

async function getNotesFromGitHub(userAgent) {
  return await fetchGitHubFile(NOTES_FILE, userAgent);
}

async function saveNotesToGitHub(notes, userAgent) {
  await saveGitHubFile(NOTES_FILE, notes, userAgent);
}

async function getUsersFromGitHub(userAgent) {
  try {
    console.log('Fetching users.json from GitHub...');
    
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/users.json`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App' },
    });

    const data = await response.json();
    console.log('GitHub API Response:', data);

    if (!data || !data.content) {
      console.log('users.json not found or empty.');
      return {};
    }

    return JSON.parse(atob(data.content)); // Decode base64 JSON
  } catch (error) {
    console.error('Error fetching users.json:', error);
    return {};
  }
}


async function saveUsersToGitHub(users, userAgent) {
  await saveGitHubFile(USERS_FILE, users, userAgent);
}

async function fetchGitHubFile(filename, userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': userAgent },
    });
    const data = await response.json();
    return data.content ? JSON.parse(atob(data.content)) : {};
  } catch {
    return {};
  }
}

async function saveGitHubFile(filename, data, userAgent) {
  const existingFile = await fetchGitHubFile(filename, userAgent);
  const sha = existingFile.sha || undefined;

  await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`, {
    method: 'PUT',
    headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': userAgent },
    body: JSON.stringify({ message: `Update ${filename}`, content: btoa(JSON.stringify(data)), sha }),
  });
}
