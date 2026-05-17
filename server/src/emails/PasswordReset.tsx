import React from 'react';
import { Text, Button } from '@react-email/components';
import { Layout } from './Layout';

interface PasswordResetProps {
  username: string;
  resetUrl: string;
}

export function PasswordReset({ username, resetUrl }: PasswordResetProps) {
  return (
    <Layout>
      <Text style={{ fontSize: '17px', fontWeight: '700', color: '#1c1917', margin: '0 0 6px' }}>
        Reset your password
      </Text>
      <Text style={{ fontSize: '13px', color: '#78716c', lineHeight: '1.6', margin: '0 0 6px' }}>
        Hi {username} — we received a request to reset your password. Click the link below to choose a new one.
      </Text>
      <Text style={{ fontSize: '12px', color: '#a8a29e', margin: '0 0 20px' }}>
        This link expires in 1 hour. If you didn't request a reset, you can ignore this email.
      </Text>
      <Button
        href={resetUrl}
        style={{ backgroundColor: '#2563eb', color: 'white', padding: '11px 24px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        Reset password →
      </Button>
    </Layout>
  );
}
