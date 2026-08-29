import { Link } from 'react-router-dom';
import { EmptyState } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <EmptyState
      icon="⌕"
      title="Halaman tidak ditemukan"
      description="Rute yang kamu buka tidak ada."
      action={
        <Link to="/">
          <Button variant="primary">Ke Home</Button>
        </Link>
      }
    />
  );
}
