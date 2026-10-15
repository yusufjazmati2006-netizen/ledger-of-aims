import { Link } from 'react-router';
import { EmptyState } from '../design/Card';

export function NotFound() {
  return (
    <EmptyState icon="info" title="Nothing here yet" className="mt-10">
      This section isn&apos;t part of the ledger yet.{' '}
      <Link className="font-medium text-ink underline underline-offset-2" to="/">
        Return to Today
      </Link>
      .
    </EmptyState>
  );
}
