import "./Poll";
import "./PollParticipation";
import "./GuildMeta";
import "./ChannelMeta";
import "./GuildSettings";
import "./MessageSnapshot";
import "./MessageAttachment";
import "./MessageHistory";
import "./VoiceSession";
import "./DeafSession";
import "./SpamFilterRule";
import "./ChannelRule";
import "./StatsReportMessageState";
import "./Sanction";
import "./Appeal";
import "./FlaggedMessage";
import "./ModerationReport";
import "./MemberEvent";

import { Appeal } from "./Appeal";
import { Sanction } from "./Sanction";

Sanction.hasMany(Appeal, {
  foreignKey: "sanctionID",
  sourceKey: "id",
});

Appeal.belongsTo(Sanction, {
  foreignKey: "sanctionID",
  targetKey: "id",
});
