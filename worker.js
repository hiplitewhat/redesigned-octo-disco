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

// ------------------------- Notes Handling -------------------------

async function handleIndex(session, userAgent) {
  try {
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Code Notes</title>
      </head>
      <body>
        <h1>Code Notes</h1>
        <ul>${noteLinks}</ul>
        ${saveForm}
        ${loginOrLogout}
      </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error in handleIndex:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleNote(noteId, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    const noteContent = notes[noteId];

    if (!noteContent) {
      return new Response('Note Not Found', { status: 404 });
    }

    return new Response(`<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre>${noteContent}</pre><a href="/">Back</a></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error in handleNote:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
