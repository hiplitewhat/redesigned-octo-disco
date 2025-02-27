// Cloudflare Worker Code for a Code Notes Web App with User Agent in GitHub API Calls

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // ... (handleRequest, handleIndex, handleNote, handleSave functions remain the same)
}

// GitHub Interaction (Replace with your GitHub credentials and repository details)

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';
const GITHUB_OWNER = 'Hiplitehehe';
const GITHUB_REPO = 'Notes';
const GITHUB_PATH = '';

async function listNotes(userAgent) { // Add userAgent parameter
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App', // Include user agent
      },
    });
    // ... (rest of listNotes remains the same)
  } catch (error) {
    // ...
  }
}

async function getNote(noteId, userAgent) { // Add userAgent parameter
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${noteId}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App', // Include user agent
      },
    });
    // ... (rest of getNote remains the same)
  } catch (error) {
    // ...
  }
}

async function saveNote(noteId, content, userAgent) { // Add userAgent parameter.
  try {
    const existingNote = await getNote(noteId, userAgent);
      let sha = undefined;
      if(existingNote){
          const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${noteId}`,{headers:{Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App',}});
          const data = await response.json();
          sha = data.sha;
      }
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${noteId}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App', // Include user agent
      },
      body: JSON.stringify({
        message: `Update note: ${noteId}`,
        content: btoa(content),
        sha: sha,
      }),
    });
    // ... (rest of saveNote remains the same)
  } catch (error) {
    // ...
  }
}

async function handleIndex(isMobile, userAgent) {
    const noteList = await listNotes(userAgent);
    // ... Rest of the function
}

async function handleNote(noteId, isMobile, userAgent) {
    const noteContent = await getNote(noteId, userAgent);
    // ... Rest of the function
}

async function handleSave(request, userAgent) {
    const formData = await request.formData();
    const noteId = formData.get('noteId');
    const content = formData.get('content');

    if (!noteId || !content) {
        return new Response('Missing Note ID or Content', { status: 400 });
    }

    await saveNote(noteId, content, userAgent);

    return Response.redirect(`/note/${noteId}`, 302);
}

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('User-Agent');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    if (path === '/') {
        return handleIndex(isMobile, userAgent);
    } else if (path.startsWith('/note/')) {
        return handleNote(path.substring(6), isMobile, userAgent);
    } else if (path === '/save' && request.method === 'POST') {
        return handleSave(request, userAgent);
    } else {
        return new Response('Not Found', { status: 404 });
    }
}
