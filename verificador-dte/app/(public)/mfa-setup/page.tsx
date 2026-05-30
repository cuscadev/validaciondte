'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TotpMultiFactorGenerator, TotpSecret, multiFactor } from 'firebase/auth';
import { auth } from '@/lib/firebase';

function getErrorMessage(err: unknown, fallback: string) {
	return err instanceof Error ? err.message : fallback;
}

export default function MfaSetupPage() {
	const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
	const [enrollmentUri, setEnrollmentUri] = useState('');
	const [verificationCode, setVerificationCode] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	useEffect(() => {
		const setupTotp = async () => {
			try {
				const user = auth.currentUser;
				if (!user) throw new Error('No autenticado');
				const session = await multiFactor(user).getSession();
				const secret = await TotpMultiFactorGenerator.generateSecret(session);
				setTotpSecret(secret);
				setEnrollmentUri(secret.generateQrCodeUrl(user.email || 'usuario', 'Verificador DTE'));
			} catch (err) {
				setError(getErrorMessage(err, 'No se pudo iniciar la configuración TOTP.'));
			}
		};
		setupTotp();
	}, []);

	const handleVerify = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setSuccess('');

		try {
			const user = auth.currentUser;
			if (!user) throw new Error('No autenticado');
			if (!totpSecret) throw new Error('No hay un secreto TOTP activo.');

			const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, verificationCode);
			await multiFactor(user).enroll(assertion, 'TOTP');
			setSuccess('TOTP configurado correctamente');
		} catch (err) {
			setError(getErrorMessage(err, 'No se pudo activar TOTP.'));
		}
	};

	return (
		<div className="flex flex-col items-center justify-center min-h-screen">
			<h2 className="text-2xl font-bold mb-4">Configurar TOTP (Google Authenticator)</h2>
			{enrollmentUri && (
				<div className="mb-4">
					<QRCodeSVG value={enrollmentUri} />
					<p className="text-sm mt-2">Escanea este código QR con tu app de autenticación</p>
				</div>
			)}
			{/* ...rest of the MFA setup page... */}
		</div>
	);
}
