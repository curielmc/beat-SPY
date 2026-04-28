import registered from './registered.js'
import startTomorrow from './start-tomorrow.js'
import started from './started.js'
import digest from './digest.js'
import endTomorrow from './end-tomorrow.js'
import finalized from './finalized.js'
import wonPayout from './won-payout.js'
import ruleChange from './rule-change.js'
import removed from './removed.js'
import rosterInvitation from './roster-invitation.js'

const templates = {
  registered,
  start_tomorrow: startTomorrow,
  started,
  digest,
  end_tomorrow: endTomorrow,
  finalized,
  won_payout: wonPayout,
  rule_change: ruleChange,
  removed,
  roster_invitation: rosterInvitation
}

export default templates
