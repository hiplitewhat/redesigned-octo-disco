// Cloudflare Worker Code for a Code Notes Web App with User Agent Conditional Logic

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (path === '/') {
    return handleIndex(isMobile); // Pass isMobile to handleIndex
  } else if (path.startsWith('/note/')) {
    return handleNote(path.substring(6), isMobile); // Pass isMobile to handleNote
  } else if (path === '/save' && request.method === 'POST') {
    return handleSave(request);
  } else {
    return new Response('Not Found', { status: 404 });
  }
}

async function handleIndex(isMobile) {
  const noteList = await listNotes();
  const noteLinks = noteList.map(note => `<li><a href="/note/${note.name}">${note.name}</a></li>`).join('');

  let html;
  if (isMobile) {
    // Mobile-specific HTML (simplified form, smaller font, etc.)
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Code Notes (Mobile)</title>
      </head>
      <body>
        <h1>Code Notes (Mobile)</h1>
        <ul>
          ${noteLinks}
        </ul>
        <form action="/save" method="POST">
          <input type="text" name="noteId" placeholder="Note ID"><br>
          <textarea name="content" rows="5" cols="30" placeholder="Content"></textarea><br>
          <input type="submit" value="Save">
        </form>
      </body>
      </html>
    `;
  } else {
    // Desktop HTML (original form, larger text area, etc.)
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Code Notes</title>
      </head>
      <body>
        <h1>Code Notes</h1>
        <ul>
          ${noteLinks}
        </ul>
        <form action="/save" method="POST">
          <label for="noteId">Note ID:</label><br>
          <input type="text" id="noteId" name="noteId"><br><br>
          <label for="content">Content:</label><br>
          <textarea id="content" name="content" rows="10" cols="50"></textarea><br><br>
          <input type="submit" value="Save">
        </form>
      </body>
      </html>
    `;
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

async function handleNote(noteId, isMobile) {
  const noteContent = await getNote(noteId);

  if (noteContent === null) {
    return new Response('Note Not Found', { status: 404 });
  }

  let html;
  if(isMobile){
    html = `<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre style="font-size:12px;">${noteContent}</pre><a href="/">Back</a></body></html>`;
  } else {
    html = `<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre>${noteContent}</pre><a href="/">Back to List</a></body></html>`;
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// ... (rest of the handleSave, listNotes, getNote, saveNote functions remain the same)

// GitHub Interaction (Replace with your GitHub credentials and repository details)

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';
const GITHUB_OWNER = 'Hiplitehehe';
const GITHUB_REPO = 'Notes';
const GITHUB_PATH = '';
