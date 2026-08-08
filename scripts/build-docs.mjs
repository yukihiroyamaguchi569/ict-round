// docs/*.md を dist/docs/<slug>/index.html として公開用に変換する。
// 公開対象は下記 DOCS のみ。docs/ には内部資料も混在するため全件変換はしない。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DOCS = [
  {
    slug: 'technical-spec',
    source: 'docs/technical-spec.md',
    title: '技術仕様書',
    description: 'ICTラウンドアプリ「めぐる君」の技術仕様書。データの保存先、外部通信先、アクセス解析の送信項目を記載しています。',
  },
  {
    slug: 'user-guide',
    source: 'docs/user-guide.md',
    title: '取扱説明書',
    description: 'ICTラウンドアプリ「めぐる君」の取扱説明書。操作手順と注意事項を記載しています。',
  },
  {
    slug: 'privacy-policy',
    source: 'docs/privacy-policy.md',
    title: 'プライバシーポリシー',
    description: 'ICTラウンドアプリ「めぐる君」のプライバシーポリシー。',
  },
];

const GA4_ID = process.env.VITE_GA4_MEASUREMENT_ID;

// 審査資料として参照されるページのため、外部CDN・外部フォントは読み込まない。
const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0 1.25rem 4rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif;
    line-height: 1.85;
    color: #1f2933;
    background: #fff;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 48rem; margin: 0 auto; }
  nav.doc-nav {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1rem 0;
    font-size: .875rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  nav.doc-nav a { color: #0c6b8a; }
  .print-button {
    display: inline-flex;
    align-items: center;
    gap: .35em;
    padding: .45em .9em;
    border: 1px solid #0c6b8a;
    border-radius: 999px;
    background: #fff;
    color: #0c6b8a;
    font-size: .8rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
  }
  .print-button:hover { background: #eef4f7; }
  h1, h2, h3, h4 { line-height: 1.4; font-weight: 700; }
  h1 { font-size: 1.75rem; margin: 1.5rem 0 1rem; padding-bottom: .75rem; border-bottom: 3px solid #0c6b8a; }
  h2 { font-size: 1.3rem; margin: 2.5rem 0 .75rem; padding-left: .6rem; border-left: 5px solid #0c6b8a; }
  h3 { font-size: 1.1rem; margin: 2rem 0 .5rem; color: #0c6b8a; }
  h4 { font-size: 1rem; margin: 1.5rem 0 .5rem; }
  p, ul, ol { margin: .75rem 0; }
  li { margin: .3rem 0; }
  a { color: #0c6b8a; }
  hr { border: none; border-top: 1px solid #dde3e8; margin: 2.5rem 0; }
  code {
    background: #f1f5f7;
    padding: .12em .4em;
    border-radius: 3px;
    font-size: .9em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-word;
  }
  pre {
    background: #f1f5f7;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    margin: 1rem 0;
    padding: .5rem 1rem;
    border-left: 4px solid #b8c4cc;
    background: #f8fafb;
    color: #4a5560;
  }
  /* 表は幅が広くなるため、本文ではなく表自身を横スクロールさせる */
  .table-scroll { overflow-x: auto; margin: 1rem 0; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { border: 1px solid #dde3e8; padding: .5rem .7rem; text-align: left; vertical-align: top; }
  th { background: #eef4f7; font-weight: 700; white-space: nowrap; }
  footer.doc-footer {
    max-width: 48rem;
    margin: 4rem auto 0;
    padding-top: 1.5rem;
    border-top: 1px solid #dde3e8;
    font-size: .8rem;
    color: #6b7680;
  }
  @media print {
    body { padding: 0; font-size: 10.5pt; }
    nav.doc-nav, footer.doc-footer { display: none; }
    h2, h3 { break-after: avoid; }
    table, pre, blockquote { break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
`;

function gtagSnippet() {
  if (!GA4_ID) return '';
  return `  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA4_ID}');
  </script>
`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function render(doc, markdown) {
  // marked は table を素で出力するため、横スクロール用の器で包む
  const content = marked
    .parse(markdown, { async: false })
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, '</table></div>');

  const title = `${doc.title} | ICTラウンドアプリ「めぐる君」`;

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(doc.description)}">
  <link rel="canonical" href="https://ict-round.conect.llc/docs/${doc.slug}/">
  <link rel="icon" type="image/png" href="/meguru.png">
${gtagSnippet()}  <style>${STYLE}</style>
</head>
<body>
  <nav class="doc-nav">
    <a href="/about/">&larr; めぐる君について</a>
    <button type="button" class="print-button" onclick="window.print()">🖨 PDFとして保存</button>
  </nav>
  <main>
${content}
  </main>
  <footer class="doc-footer">
    <p>&copy; 2026 コネクト合同会社 &mdash; <a href="/">アプリを開く</a> / <a href="/docs/privacy-policy/">プライバシーポリシー</a> / <a href="/docs/technical-spec/">技術仕様書</a> / <a href="/docs/user-guide/">取扱説明書</a></p>
  </footer>
</body>
</html>
`;
}

for (const doc of DOCS) {
  const markdown = await readFile(join(ROOT, doc.source), 'utf8');
  const outDir = join(ROOT, 'dist', 'docs', doc.slug);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), render(doc, markdown));
  console.log(`docs: ${doc.source} -> dist/docs/${doc.slug}/index.html`);
}
