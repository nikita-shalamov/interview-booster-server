import type { ParsedResumeWithDiffs, ParsedResume } from './types/resume.types';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildResumeHtml(
  content: ParsedResumeWithDiffs | ParsedResume,
): string {
  const { contacts, sections } = content;

  const contactParts: string[] = [];
  if (contacts.email)
    contactParts.push(
      `<a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a>`,
    );
  if (contacts.telegram)
    contactParts.push(
      `<a href="https://t.me/${esc(contacts.telegram.replace('@', ''))}">${esc(contacts.telegram)}</a>`,
    );
  if (contacts.github && contacts.github !== 'GitHub')
    contactParts.push(
      `<a href="${esc(contacts.github)}">${esc(contacts.github)}</a>`,
    );
  else if (contacts.github)
    contactParts.push(`<span>${esc(contacts.github)}</span>`);
  if (contacts.linkedin && contacts.linkedin !== 'LinkedIn')
    contactParts.push(
      `<a href="${esc(contacts.linkedin)}">${esc(contacts.linkedin)}</a>`,
    );
  else if (contacts.linkedin)
    contactParts.push(`<span>${esc(contacts.linkedin)}</span>`);
  if (contacts.phone) contactParts.push(`<span>${esc(contacts.phone)}</span>`);

  const sectionsHtml = sections
    .map((section) => {
      const itemsHtml = section.items
        .map((item) => {
          if (item.kind === 'text') {
            const diffItem = item;
            const text = diffItem.diff?.improved ?? item.content;
            return `<p class="summary-text">${esc(text)}</p>`;
          }

          if (item.kind === 'experience') {
            const diffItem = item;
            const bullets =
              'bullets' in diffItem && Array.isArray(diffItem.bullets)
                ? diffItem.bullets.map((b) => {
                    const text =
                      typeof b === 'string' ? b : (b.diff?.improved ?? b.text);
                    return `<li>${esc(text)}</li>`;
                  })
                : [];

            return `
              <div class="subheading">
                <div class="subheading-row">
                  <span class="company">${esc(item.company)}</span>
                  <span class="period">${esc(item.period)}</span>
                </div>
                <div class="subheading-row">
                  <span class="role">${esc(item.role)}</span>
                  ${item.location ? `<span class="location">${esc(item.location)}</span>` : ''}
                </div>
              </div>
              ${bullets.length ? `<ul>${bullets.join('')}</ul>` : ''}
            `;
          }

          if (item.kind === 'education') {
            return `
              <div class="subheading">
                <div class="subheading-row">
                  <span class="company">${esc(item.institution)}</span>
                  <span class="period">${item.period ? esc(item.period) : ''}</span>
                </div>
                <div class="subheading-row">
                  <span class="role">${[item.degree, item.field].filter(Boolean).map(esc).join(', ')}</span>
                  ${item.location ? `<span class="location">${esc(item.location)}</span>` : ''}
                </div>
              </div>
            `;
          }

          if (item.kind === 'skills') {
            const label = item.category
              ? `<strong>${esc(item.category)}:</strong> `
              : '';
            return `<p class="skills-line">${label}${item.items.map(esc).join(', ')}</p>`;
          }

          return '';
        })
        .join('');

      return `
        <section>
          <h2>${esc(section.title)}</h2>
          ${itemsHtml}
        </section>
      `;
    })
    .join('');

  const title = [contacts.name].filter(Boolean).map(esc).join(' ');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 11pt;
    color: #000;
    padding: 0.5in 0.5in;
    line-height: 1.35;
  }

  header {
    text-align: center;
    margin-bottom: 10px;
  }

  header h1 {
    font-size: 18pt;
    font-variant: small-caps;
    font-weight: 700;
    letter-spacing: 0.03em;
    margin-bottom: 4px;
  }

  .contacts {
    font-size: 10pt;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0 6px;
  }

  .contacts a, .contacts span {
    color: #1a0dab;
    text-decoration: none;
  }

  .contacts .sep { color: #000; }

  section { margin-bottom: 10px; }

  h2 {
    font-size: 12pt;
    font-variant: small-caps;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin-bottom: 6px;
  }

  .summary-text { font-size: 10pt; }

  .subheading { margin-bottom: 2px; margin-top: 4px; }

  .subheading-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .company { font-weight: 700; font-size: 11pt; }
  .period { font-size: 10pt; }
  .role { font-style: italic; font-size: 10pt; }
  .location { font-style: italic; font-size: 10pt; }

  ul {
    padding-left: 16px;
    margin-top: 2px;
    margin-bottom: 4px;
  }

  li {
    font-size: 10pt;
    margin-bottom: 1px;
  }

  .skills-line {
    font-size: 10pt;
    margin-bottom: 2px;
  }

  a { color: #1a0dab; text-decoration: none; }
</style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="contacts">
      ${contactParts
        .map((p, i) =>
          i < contactParts.length - 1 ? `${p}<span class="sep"> | </span>` : p,
        )
        .join('')}
    </div>
  </header>
  ${sectionsHtml}
</body>
</html>`;
}
