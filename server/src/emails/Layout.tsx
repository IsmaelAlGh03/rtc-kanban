import React from 'react';
import { Html, Head, Body, Container, Section, Text } from '@react-email/components';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#fafaf9', margin: '0', padding: '0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <Container style={{ maxWidth: '520px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e7e5e4' }}>
            <Section style={{ padding: '24px 24px 20px' }}>
              <Text style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#2563eb',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '800',
                fontSize: '14px',
                lineHeight: '32px',
                textAlign: 'center',
                display: 'block',
                marginBottom: '16px',
              }}>
                K
              </Text>
              {children}
            </Section>
            <Section style={{ backgroundColor: '#fafaf9', padding: '12px 24px', borderTop: '1px solid #e7e5e4', borderRadius: '0 0 10px 10px' }}>
              <Text style={{ fontSize: '11px', color: '#a8a29e', margin: '0' }}>
                RTC Kanban · If you didn't request this, you can safely ignore this email.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
