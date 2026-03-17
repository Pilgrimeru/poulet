export interface PollParticipationAttributes {
  pollId: string;
  userId: string;
  option: number; // option index
}

export interface PollAttributes {
  pollId: string;
  title: string;
  messagePath: string;
  expiration: number; // timestamp
  allowMultipleChoice: boolean;
  options: string; // option descritions
  isClosed?: boolean;
}
