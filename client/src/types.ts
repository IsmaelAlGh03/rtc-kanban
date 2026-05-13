export interface IComment {
  _id: string;
  username: string;
  text: string;
  timestamp: string;
  mentions: string[];
}

export interface ICard {
  _id: string;
  title: string;
  description?: string;
  order: number;
  addedBy: string;
  assignedTo?: string;
  urgency: 'low' | 'medium' | 'high';
  comments: IComment[];
}

export interface IColumn {
  _id: string;
  title: string;
  order: number;
  cards: ICard[];
}

export interface IBoard {
  _id: string;
  title: string;
  description?: string;
  color?: string;
  owner: string;
  members: string[];
  pendingInvites: string[];
  inviteToken?: string;
  columns: IColumn[];
  createdAt: string;
  updatedAt: string;
}

export interface INotification {
  _id: string;
  userId: string;
  type: 'invite' | 'invite_accepted' | 'invite_rejected' | 'assigned' | 'mentioned';
  boardId: string;
  boardTitle: string;
  fromUsername: string;
  cardId?: string;
  cardTitle?: string;
  columnId?: string;
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  username: string;
  text: string;
  timestamp: string;
}
