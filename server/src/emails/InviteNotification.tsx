import React from 'react';
import { Text, Button } from '@react-email/components';
import { Layout } from './Layout';

interface InviteNotificationProps {
  fromUsername: string;
  boardTitle: string;
  appUrl: string;
}

export function InviteNotification({ fromUsername, boardTitle, appUrl }: InviteNotificationProps) {
  return (
    <Layout>
      <Text style={{ fontSize: '17px', fontWeight: '700', color: '#1c1917', margin: '0 0 6px' }}>
        You've been invited to a board
      </Text>
      <Text style={{ fontSize: '13px', color: '#78716c', lineHeight: '1.6', margin: '0 0 20px' }}>
        <strong>{fromUsername}</strong> has invited you to collaborate on <strong>{boardTitle}</strong>. Open the app to accept.
      </Text>
      <Button
        href={appUrl}
        style={{ backgroundColor: '#2563eb', color: 'white', padding: '11px 24px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        Open RTC Kanban →
      </Button>
    </Layout>
  );
}
