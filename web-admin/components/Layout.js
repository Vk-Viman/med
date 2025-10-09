import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }){
  const router = useRouter();
  const { logout } = useAuth();
  const nav = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/moderation', label: 'Moderation' },
    { href: '/challenges', label: 'Challenges' },
    { href: '/badges', label: 'Badges' },
    { href: '/users', label: 'Users' },
  ];
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <nav className="flex gap-4">
            {nav.map(n=> (
              <Link key={n.href} href={n.href} className={`hover:underline ${router.pathname===n.href? 'font-bold text-blue-700' : ''}`}>{n.label}</Link>
            ))}
          </nav>
          <button onClick={async()=>{ try{ await logout(); router.push('/login'); }catch{} }} className="text-sm text-gray-700 hover:text-black">Logout</button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
