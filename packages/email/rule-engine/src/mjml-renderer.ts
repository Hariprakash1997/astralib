import mjml2html from 'mjml';
import { convert } from 'html-to-text';

const MJML_BASE_OPEN = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="15px" color="#333333" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section padding="20px">
      <mj-column>
        <mj-text>`;

const MJML_BASE_CLOSE = `        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

export function renderMjml(body: string): string {
  if (!body.includes('<mj-') && !body.trim().startsWith('<mjml')) {
    return body;
  }

  const fullMjml = body.trim().startsWith('<mjml')
    ? body
    : `${MJML_BASE_OPEN}${body}${MJML_BASE_CLOSE}`;

  const result = mjml2html(fullMjml, {
    validationLevel: 'soft',
    minify: false,
  });

  if (result.errors?.length) {
    // Log all MJML warnings/errors for debugging
    for (const err of result.errors) {
      console.warn(`MJML warning: ${(err as any).message || JSON.stringify(err)}`);
    }
  }

  return result.html;
}

export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 80,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' },
    ],
  });
}
