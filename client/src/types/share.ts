export type ShareItem = {
  id: string;
  type: "asset" | "album";
  url: string | null;
  targetId: string | null;
  targetLabel: string;
  createdAt?: string;
};
