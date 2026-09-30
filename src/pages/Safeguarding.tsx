import { Link } from 'react-router-dom';

/** The full, authoritative policy lives on the ADMAIS site; this page covers Scala’s Shelf. */
export const POLICY_URL = 'https://admais.xyz/about/safeguarding';

/** Child safeguarding: how Scala’s Shelf keeps children safe, and how to report a concern. */
export function Safeguarding() {
  return (
    <div className="policy-page">
      <header className="library-header">
        <h1>Child safeguarding</h1>
        <Link to="/">← Browse books</Link>
      </header>

      <p>
        Scala’s Shelf is made by ADMAIS (US) and ADMAIS Lao, and follows the{' '}
        <a href={POLICY_URL} target="_blank" rel="noopener noreferrer">ADMAIS Child Safeguarding Policy</a>.
        Every child has the right to be safe, and children never pay to read.
      </p>

      <h2>How Scala’s Shelf keeps children safe</h2>
      <ul>
        <li><strong>No child accounts.</strong> Children read without signing in, and devices can be shared safely.</li>
        <li><strong>No ads and no in-app purchases</strong> for children, ever.</li>
        <li><strong>Every book is checked by an adult educator</strong> before children can see it, including anything made with AI.</li>
        <li><strong>Content standards.</strong> Books are age-appropriate and culturally respectful, show children with dignity, and contain no violence, sexual content, hate or harmful stereotypes.</li>
        <li><strong>Minimal data.</strong> Books you download stay on this phone. Learning results are reported without children’s names.</li>
      </ul>

      <h2>Report a concern</h2>
      <p>
        Email <strong>safeguarding@admais.xyz</strong>. We reply within two working days
        and keep reports confidential. If a child is in immediate danger, contact the local police first.
      </p>

      <p className="hint">
        Read the <a href={POLICY_URL} target="_blank" rel="noopener noreferrer">full policy</a> on admais.xyz.
      </p>
    </div>
  );
}
