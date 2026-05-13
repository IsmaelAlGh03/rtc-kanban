export interface IComment {
  _id: string;
  username: string;
  text: string;
  timestamp: Date;
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
  _id?: string;
  title: string;
  description?: string;
  color?: string;
  owner: string;
  members: string[];
  pendingInvites: string[];
  inviteToken?: string;
  columns: IColumn[];
  createdAt: Date;
  updatedAt: Date;
}
