'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push('/');
        router.refresh();
      }}
      className="text-ink-muted hover:text-ink"
    >
      Log out
    </button>
  );
}
