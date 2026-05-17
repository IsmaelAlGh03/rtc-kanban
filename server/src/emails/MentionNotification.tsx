import React from 'react';
import { Text, Button } from '@react-email/components';
import { Layout } from './Layout';

interface MentionNotificationProps {
  fromUsername: string;
  boardTitle: string;
  cardTitle: string;
  commentExcerpt: string;
  deepLink: string;
}

export function MentionNotification({ fromUsername, boardTitle, cardTitle, commentExcerpt, deepLink }: MentionNotificationProps) {
  return (
    <Layout>
      <Text style={{ fontSize: '17px', fontWeight: '700', color: '#1c1917', margin: '0 0 6px' }}>
        {fromUsername} mentioned you
      </Text>
      <Text style={{ fontSize: '13px', color: '#78716c', lineHeight: '1.6', margin: '0 0 8px' }}>
        <strong>{fromUsername}</strong> mentioned you on card <strong>{cardTitle}</strong> in <strong>{boardTitle}</strong>:
      </Text>
      <Text style={{ fontSize: '13px', color: '#44403c', backgroundColor: '#f5f5f4', padding: '10px 14px', borderRadius: '6px', borderLeft: '3px solid #d6d3d1', margin: '0 0 20px', lineHeight: '1.5' }}>
        "{commentExcerpt}"
      </Text>
      <Button
        href={deepLink}
        style={{ backgroundColor: '#2563eb', color: 'white', padding: '11px 24px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        View comment →
      </Button>
    </Layout>
  );
}
