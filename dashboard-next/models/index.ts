import { Appeal } from "./Appeal";
import "./AutoResponse";
import "./ChannelMeta";
import "./ChannelRule";
import "./DeafSession";
import "./FlaggedMessage";
import "./GuildMeta";
import "./GuildSettings";
import "./MemberEvent";
import "./MemberInvite";
import "./MessageAttachment";
import "./MessageHistory";
import "./MessageSnapshot";
import "./ModerationReport";
import "./Poll";
import "./PollParticipation";
import { Sanction } from "./Sanction";
import "./SpamFilterRule";
import "./StatsReportMessageState";
import "./VoiceSession";




Sanction.hasMany(Appeal, {
  foreignKey: "sanctionID",
  sourceKey: "id",
});

Appeal.belongsTo(Sanction, {
  foreignKey: "sanctionID",
  targetKey: "id",
});
