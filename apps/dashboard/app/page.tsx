import { Button } from '@docufy/ui';

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Docufy Dashboard</h1>
      <p>Welcome to the admin dashboard.</p>
      <Button variant="primary" style={{ marginTop: 12 }}>
        Primary Button
      </Button>
    </main>
  );
}
