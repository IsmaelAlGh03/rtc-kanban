import React from 'react';
import { Text, Button } from '@react-email/components';
import { Layout } from './Layout';

interface AssignedNotificationProps {
  fromUsername: string;
  boardTitle: string;
  cardTitle: string;
  deepLink: string;
}

export function AssignedNotification({ fromUsername, boardTitle, cardTitle, deepLink }: AssignedNotificationProps) {
  return (
    <Layout>
      <Text style={{ fontSize: '17px', fontWeight: '700', color: '#1c1917', margin: '0 0 6px' }}>
        You've been assigned to a card
      </Text>
      <Text style={{ fontSize: '13px', color: '#78716c', lineHeight: '1.6', margin: '0 0 20px' }}>
        <strong>{fromUsername}</strong> assigned you to <strong>{cardTitle}</strong> on <strong>{boardTitle}</strong>.
      </Text>
      <Button
        href={deepLink}
        style={{ backgroundColor: '#2563eb', color: 'white', padding: '11px 24px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        View card →
      </Button>
    </Layout>
  );
}
