import { redirect } from 'next/navigation';

import { isCollaboratorInviteToken } from '@/lib/app-url';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (isCollaboratorInviteToken(token)) {
    redirect(`/invitacion-colaborador?token=${encodeURIComponent(token!)}`);
  }
  redirect('/signup');
}
