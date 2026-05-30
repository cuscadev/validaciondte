'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, Toaster } from 'sonner';
import {
	MultiFactorError,
	MultiFactorResolver,
	TotpMultiFactorGenerator,
	getMultiFactorResolver,
	signInWithEmailAndPassword,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';

function isMultiFactorError(err: unknown): err is MultiFactorError {
	return typeof err === 'object' && err !== null && 'code' in err && err.code === 'auth/multi-factor-auth-required';
}

function getErrorMessage(err: unknown, fallback: string) {
	return err instanceof Error ? err.message : fallback;
}

export default function MfaLoginPage() {
	const { t } = useTranslation();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [mfaRequired, setMfaRequired] = useState(false);
	const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
	const [totpCode, setTotpCode] = useState('');
	const [error, setError] = useState('');
	const router = useRouter();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setMfaRequired(false);
		try {
			await signInWithEmailAndPassword(auth, email, password);
			router.push('/');
		} catch (err) {
			if (isMultiFactorError(err)) {
				setResolver(getMultiFactorResolver(auth, err));
				setMfaRequired(true);
			} else {
				const msg = getErrorMessage(err, t('mfa_login_error_login'));
				setError(msg);
				toast.error(msg);
			}
		}
	};

	const handleTotp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (!resolver) {
			const msg = t('mfa_login_error_no_mfa');
			setError(msg);
			toast.error(msg);
			return;
		}
		// ...rest of the TOTP logic...
	};

	return (
		<main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
			<div className="w-full fixed top-0 left-0 z-30">
				{/* ...rest of the MFA login page... */}
			</div>
		</main>
	);
}
