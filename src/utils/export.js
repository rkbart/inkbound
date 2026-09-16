export function buildDiaryMarkdown(entries, username) {
  const stamp = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const lines = [
    '# Inkbound Diary',
    '',
    `**Writer:** ${username || 'anonymous'}`,
    `**Exported:** ${stamp}`,
    `**Entries:** ${entries.length}`,
    '',
    '---',
    ''
  ];

  for (const entry of entries) {
    const when = entry.created_at
      ? new Date(entry.created_at).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      : 'Undated';
    lines.push(`## ${when}`, '', `**${entry.content}**`, '');
    lines.push(entry.response
      ? `> ${entry.response.replace(/\n/g, '\n> ')}`
      : '> *Ink absorbed in silence*');
    lines.push('');
  }

  return lines.join('\n');
}

// Builds a Markdown transcript of the diary and triggers a browser download.
// Runs entirely client-side from the entries already in state.
export function exportDiaryMarkdown(entries, username) {
  const blob = new Blob([buildDiaryMarkdown(entries, username)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inkbound-diary-${(username || 'diary').replace(/[^a-z0-9_-]/gi, '_')}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
