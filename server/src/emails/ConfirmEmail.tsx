import React from 'react';
import { Text, Button } from '@react-email/components';
import { Layout } from './Layout';

interface ConfirmEmailProps {
  username: string;
  confirmUrl: string;
}

export function ConfirmEmail({ username, confirmUrl }: ConfirmEmailProps) {
  return (
    <Layout>
      <Text style={{ fontSize: '17px', fontWeight: '700', color: '#1c1917', margin: '0 0 6px' }}>
        Confirm your email address
      </Text>
      <Text style={{ fontSize: '13px', color: '#78716c', lineHeight: '1.6', margin: '0 0 20px' }}>
        Hi {username} — thanks for signing up for RTC Kanban. Tap below to confirm your address and start organizing.
      </Text>
      <Button
        href={confirmUrl}
        style={{ backgroundColor: '#2563eb', color: 'white', padding: '11px 24px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        Confirm email →
      </Button>
    </Layout>
  );
}
