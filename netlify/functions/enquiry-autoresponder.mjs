import { sendAutoreply } from '../lib/autoresponder.mjs';

// Runs after Netlify has accepted an enquiry. Spam and honeypot submissions
// never reach this handler. Anything that still looks wrong is ignored, and
// a problem talking to Resend is logged without failing the submission.
export default {
  async formSubmitted(event) {
    if (event && event.spam === true) return;
    const data = event && event.data && typeof event.data === 'object' && !Array.isArray(event.data) ? event.data : {};
    await sendAutoreply({ data, env: process.env, fetchImpl: globalThis.fetch });
  },
};
