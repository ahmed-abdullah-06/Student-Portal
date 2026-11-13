import { Link } from 'react-router-dom';

const content = {
  privacy: {
    title: 'Privacy policy',
    sections: [
      ['Information we process', 'Novastra processes account, academic, attendance, payment, and support information needed to operate university services.'],
      ['How we use information', 'Information is used for education administration, authentication, communications, support, security monitoring, and legal compliance.'],
      ['Your choices', 'You may request access, correction, export, or deletion where permitted by university retention rules. Contact your university administrator for a request.'],
      ['Security and retention', 'We use access controls, encryption in transit, audit logs, and retention schedules. Payment card details are handled by the configured payment provider.'],
    ],
  },
  terms: {
    title: 'Terms of service',
    sections: [
      ['Acceptable use', 'Use the portal only for authorized university activity. Do not share credentials, bypass access controls, upload malicious files, or interfere with availability.'],
      ['Academic records', 'Portal information is an operational record. Official transcripts and financial receipts remain subject to university verification and policy.'],
      ['Account responsibility', 'Keep credentials and second-factor devices secure and report suspected compromise immediately.'],
      ['Availability', 'The university may schedule maintenance and may suspend access to protect users, data, or system integrity.'],
    ],
  },
};

export default function Legal({ type }) {
  const page = content[type];
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <Link to="/login" className="text-sm text-brand-700 hover:underline">Back to sign in</Link>
        <h1 className="mt-6 text-3xl font-bold text-slate-900">{page.title}</h1>
        <p className="mt-2 text-sm text-slate-500">Novastra Student Portal · Effective October 2026</p>
        <div className="mt-8 space-y-6">
          {page.sections.map(([heading, text]) => <section key={heading}><h2 className="text-lg font-semibold text-slate-800">{heading}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></section>)}
        </div>
      </article>
    </main>
  );
}
