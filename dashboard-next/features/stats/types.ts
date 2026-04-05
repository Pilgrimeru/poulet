import type { ChannelValue, MemberOverview, StatsOverview, UserValue } from "@/lib/api-stats";

export type Precision = "day" | "hour-timeline" | "hour";

export type ActivitySeriesKey = "total" | "uniqueUsers" | "uniqueChannels";
export type MemberSeriesKey = "total" | "joined" | "left";

export type ActivityTooltipEntry = {
  dataKey?: string | number;
  color?: string;
  value?: number;
};

export type StatsData = {
  msgOverview: StatsOverview;
  msgByChannel: ChannelValue[];
  msgByUser: UserValue[];
  voiceOverview: StatsOverview;
  voiceByChannel: ChannelValue[];
  voiceByUser: UserValue[];
  memberOverview: MemberOverview;
};

export type ChartDatum = {
  name: string;
  value: number;
};
