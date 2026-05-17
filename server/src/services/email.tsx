import React from 'react';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { RESEND_API_KEY, APP_URL } from '../config';
import { ConfirmEmail } from '../emails/ConfirmEmail';
import { PasswordReset } from '../emails/PasswordReset';
import { InviteNotification } from '../emails/InviteNotification';
import { MentionNotification } from '../emails/MentionNotification';
import { AssignedNotification } from '../emails/AssignedNotification';

const FROM = 'onboarding@resend.dev';

async function sendEmail(to: string, subject: string, element: React.ReactElement): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const resend = new Resend(RESEND_API_KEY);
    const html = await render(element);
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('sendEmail failed:', err);
  }
}

export async function sendConfirmationEmail(to: string, username: string, token: string): Promise<void> {
  await sendEmail(
    to,
    'Confirm your email — RTC Kanban',
    <ConfirmEmail username={username} confirmUrl={`${APP_URL}/verify-email?token=${token}`} />
  );
}

export async function sendPasswordResetEmail(to: string, username: string, token: string): Promise<void> {
  await sendEmail(
    to,
    'Reset your password — RTC Kanban',
    <PasswordReset username={username} resetUrl={`${APP_URL}/reset-password?token=${token}`} />
  );
}

export async function sendInviteEmail(to: string, fromUsername: string, boardTitle: string): Promise<void> {
  await sendEmail(
    to,
    `${fromUsername} invited you to ${boardTitle}`,
    <InviteNotification fromUsername={fromUsername} boardTitle={boardTitle} appUrl={APP_URL} />
  );
}

export async function sendMentionEmail(
  to: string,
  fromUsername: string,
  boardTitle: string,
  cardTitle: string,
  commentExcerpt: string,
  boardId: string,
  cardId: string,
  columnId: string
): Promise<void> {
  const deepLink = `${APP_URL}?boardId=${boardId}&cardId=${cardId}&columnId=${columnId}`;
  await sendEmail(
    to,
    `${fromUsername} mentioned you in ${boardTitle}`,
    <MentionNotification
      fromUsername={fromUsername}
      boardTitle={boardTitle}
      cardTitle={cardTitle}
      commentExcerpt={commentExcerpt}
      deepLink={deepLink}
    />
  );
}

export async function sendAssignmentEmail(
  to: string,
  fromUsername: string,
  boardTitle: string,
  cardTitle: string,
  boardId: string,
  cardId: string,
  columnId: string
): Promise<void> {
  const deepLink = `${APP_URL}?boardId=${boardId}&cardId=${cardId}&columnId=${columnId}`;
  await sendEmail(
    to,
    `${fromUsername} assigned you to ${cardTitle}`,
    <AssignedNotification
      fromUsername={fromUsername}
      boardTitle={boardTitle}
      cardTitle={cardTitle}
      deepLink={deepLink}
    />
  );
}
