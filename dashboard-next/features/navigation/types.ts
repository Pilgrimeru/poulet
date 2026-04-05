export type SessionPayload = {
  user: {
    id: string;
    username: string;
    globalName: string | null;
    avatar: string;
  };
};

export type NavigationItem = {
  href: string;
  label: string;
  title: string;
  icon: React.ReactNode;
  group?: "main" | "bottom";
};
