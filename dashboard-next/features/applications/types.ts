"use client";

export type QuestionType = "open_text" | "single_choice" | "multiple_choice";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  minValues?: number;
  maxValues?: number;
  placeholder?: string;
}

export type SubmissionStatus = "pending" | "accepted" | "rejected";

export interface ApplicationFormItem {
  id: string;
  guildID: string;
  name: string;
  description: string;
  questions: Question[];
  acceptRoleIDs: string[];
  removeRoleIDs: string[];
  rejectRoleIDs: string[];
  welcomeChannelID: string | null;
  welcomeMessageID: string | null;
  submissionChannelID: string | null;
  cooldownMs: number;
  sessionTimeoutMs: number;
  isActive: boolean;
  createdAt: number;
}

export interface ApplicationSubmissionItem {
  id: string;
  formID: string;
  guildID: string;
  userID: string;
  answers: Record<string, string | string[]>;
  status: SubmissionStatus;
  reviewerNotes: string | null;
  reviewedAt: number | null;
  reviewedByUserID: string | null;
  rolesApplied: boolean;
  createdAt: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parentName?: string | null;
}

export type ApplicationTab = "forms" | "submissions";
