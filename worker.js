addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  try {
    if (path === '/') {
      return handleIndex(isMobile, userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(path.substring(6), isMobile, userAgent);
    } else if (path === '/save' && request.method === 'POST') {
      return handleSave(request, userAgent);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleIndex(isMobile, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    const noteLinks = Object.keys(notes).map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`).join('');

    let html;
    if (isMobile) {
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
  } catch (error) {
    console.error('Error in handleIndex:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleNote(noteId, isMobile, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    const noteContent = notes[noteId];

    if (!noteContent) {
      return new Response('Note Not Found', { status: 404 });
    }

    let html;
    if (isMobile) {
      html = `<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre style="font-size:12px;">${noteContent}</pre><a href="/">Back</a></body></html>`;
    } else {
      html = `<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre>${noteContent}</pre><a href="/">Back to List</a></body></html>`;
    }

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error in handleNote:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleSave(request, userAgent) {
  try {
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
  } catch (error) {
    console.error('Error in handleSave:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// GitHub Interaction (Replace with your GitHub credentials and repository details)

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';
const GITHUB_OWNER = 'Hiplitehehe';
const GITHUB_REPO = 'Notes';
const GITHUB_FILE = 'j.json'; // Single JSON file

async function getNotesFromGitHub(userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App',
      },
    });
    const data = await response.json();
    if (data && data.content) {
      return JSON.parse(atob(data.content));
    } else {
      return {}; // Return empty object if file doesn't exist or is empty
    }
  } catch (error) {
    console.error('Error getting notes:', error);
    return {};
  }
}

async function saveNotesToGitHub(notes, userAgent) {
  try {
    const existingFile = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {headers: {Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App'}});
    let sha = undefined;
    if (existingFile.ok){
      const data = await existingFile.json();
      sha = data.sha;
    }

    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App',
      },
      body: JSON.stringify({
        message: 'Update notes',
        content: btoa(JSON.stringify(notes)),
        sha: sha,
      }),
    });

    if (!response.ok) {
      console.error('Error saving notes:', await response.text());
    }
  } catch (error) {
    console.error('Error saving notes:', error);
  }
}
