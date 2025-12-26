import { redirect } from 'next/navigation';

// Root page redirects to customer login
export default function HomePage() {
  redirect('/account/login');
}
