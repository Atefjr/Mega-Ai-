// SLICE 1 STUB. No model is called here yet.
// In Slice 2 this endpoint will: (status) assemble an evidence packet
// (news + earnings surprise + estimate revisions + price vs cost/MAs) and ask
// Claude Haiku to classify Intact/Cautious/Broken with a one-line rationale;
// (research) ask Claude Sonnet (with a capped web search) to surface candidate
// tickers with reasons for/against. For now it returns clearly-labelled
// placeholders so the UI flow can be exercised end to end.
import { sendJson } from './_lib.js';

export default async function handler(req, res) {
  const type = (req.query?.type || '').toString();

  if (type === 'status') {
    return sendJson(res, 200, {
      stub: true,
      label: null,
      rationale: 'Thesis status scoring is wired up in Slice 2.',
    });
  }

  if (type === 'research') {
    const thesis = (req.query?.thesis || 'this thesis').toString();
    return sendJson(res, 200, {
      stub: true,
      summary:
        `Placeholder research for "${thesis}". In Slice 2, Claude will research ` +
        `tickers that fit the theme and explain the case for and against each.`,
      candidates: [
        {
          ticker: 'EXMPL',
          reasons_for: 'Placeholder bull case — replaced by AI-generated reasoning in Slice 2.',
          reasons_against: 'Placeholder bear case — replaced by AI-generated reasoning in Slice 2.',
        },
        {
          ticker: 'DEMO',
          reasons_for: 'Placeholder bull case — replaced by AI-generated reasoning in Slice 2.',
          reasons_against: 'Placeholder bear case — replaced by AI-generated reasoning in Slice 2.',
        },
      ],
    });
  }

  return sendJson(res, 400, { error: 'Unknown type. Use type=status or type=research.' });
}
