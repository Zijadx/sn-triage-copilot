/**
 * scripts/seed-incidents.js
 * Creates 15 realistic resolved incidents in ServiceNow for demo purposes.
 * Run once: node scripts/seed-incidents.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const client = axios.create({
  baseURL: `${process.env.SN_INSTANCE_URL}/api/now`,
  auth: { username: process.env.SN_USERNAME, password: process.env.SN_PASSWORD },
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  timeout: 15000,
});

const incidents = [
  {
    short_description: 'User cannot log in after Windows update - profile service error',
    description: 'Multiple users on 3rd floor unable to log in after last night Windows update. Error: The user profile service failed the sign-in.',
    close_notes: 'Booted into Safe Mode, created new local admin account, renamed corrupted profile folder in C:\\Users with .bak extension. Copied documents from old profile. Rolled back KB5034441 update on affected machines.',
    category: 'Software', priority: '2',
  },
  {
    short_description: 'VPN connection fails with error 691 after password reset',
    description: 'User reset their Active Directory password but VPN client now returns error 691 - Access Denied.',
    close_notes: 'Cleared Windows Credential Manager entries for VPN, had user re-enter new credentials. Flushed DNS and reset TCP/IP stack. Connected successfully after fix.',
    category: 'Network', priority: '2',
  },
  {
    short_description: 'Outlook keeps crashing on startup after Office update',
    description: 'Outlook 365 crashes immediately on launch. Started after automatic Office update this morning.',
    close_notes: 'Ran Outlook in safe mode to confirm add-in conflict. Identified Zoom Outlook Plugin v5.12 as culprit. Updated Zoom plugin to v5.14. Rebuilt Outlook profile as secondary fix.',
    category: 'Software', priority: '3',
  },
  {
    short_description: 'Printer offline - unable to print from any workstation on floor 2',
    description: 'HP LaserJet Pro M404n on 2nd floor showing offline to all users. Last print job was 2 hours ago.',
    close_notes: 'IP conflict with newly provisioned laptop assigned same IP. Updated DHCP reservation. Cleared print spooler service. Printer back online within 5 minutes.',
    category: 'Hardware', priority: '2',
  },
  {
    short_description: 'User account locked out after multiple failed login attempts',
    description: 'User account locked. Claims they entered correct password. Needs immediate access for client meeting.',
    close_notes: 'Unlocked account in Active Directory. Found old password saved on mobile device causing repeated failed auth attempts. Cleared mobile device account, re-added with new credentials.',
    category: 'Security', priority: '1',
  },
  {
    short_description: 'Blue screen DRIVER_IRQL_NOT_LESS_OR_EQUAL after docking station update',
    description: 'Laptop crashes with BSOD every 2 hours after docking station firmware update.',
    close_notes: 'Analyzed minidump - identified Realtek USB driver as crashing module. Rolled back dock firmware from v1.4 to v1.2. No BSOD in 48hr monitoring period.',
    category: 'Hardware', priority: '2',
  },
  {
    short_description: 'SharePoint site access denied for entire marketing team',
    description: 'Entire marketing team cannot access their SharePoint site. Getting Access Denied since this morning.',
    close_notes: 'Site collection admin removed during overnight permissions audit script. Re-added admin to Site Collection Administrators. Corrected broken permissions inheritance.',
    category: 'Software', priority: '2',
  },
  {
    short_description: 'Email stuck in outbox - all users unable to send since 9am',
    description: 'All users reporting emails stuck in Outbox. Incoming mail working fine.',
    close_notes: 'Exchange transport service stalled due to disk queue backup. Cleared old log files (freed 40GB), restarted MSExchangeTransport service. All queued messages delivered within 15 minutes.',
    category: 'Email', priority: '1',
  },
  {
    short_description: 'Laptop battery not charging when connected to docking station',
    description: 'Laptop shows plugged in but not charging on Dell WD19 dock. Charges fine with direct AC adapter.',
    close_notes: 'Dell WD19 dock firmware outdated (v1.0.10). Updated to v1.0.18. Also updated Dell Power Manager driver. Battery charging resumed immediately.',
    category: 'Hardware', priority: '3',
  },
  {
    short_description: 'MFA authenticator app lost after phone replacement - locked out of M365',
    description: 'User got a new phone and cannot access Microsoft Authenticator codes. Locked out of all Microsoft 365 services.',
    close_notes: 'Verified identity via manager and employee ID. Bypassed MFA temporarily in Azure AD. User re-registered new device via aka.ms/mfasetup. Re-enabled MFA enforcement.',
    category: 'Security', priority: '2',
  },
  {
    short_description: 'Slow internet affecting entire office - external sites only',
    description: 'All users reporting slow internet. Internal network fast. External internet slow. Video calls dropping.',
    close_notes: 'ISP upstream packet loss 40% via MTR trace. Failed over to backup LTE via Meraki. ISP resolved fiber issue within 3 hours. Total external downtime 47 minutes.',
    category: 'Network', priority: '1',
  },
  {
    short_description: 'New hire laptop software installation failing via SCCM',
    description: 'New employee onboarding blocked. Adobe Creative Cloud, Slack, Zoom failing to install via SCCM.',
    close_notes: 'SCCM client not reporting to management point - missing firewall rule for new subnet. Added rule for SCCM ports TCP 80, 443, 8530, 10123. All software deployed within 20 minutes.',
    category: 'Software', priority: '2',
  },
  {
    short_description: 'External monitor flickering and going black after desk move',
    description: 'Monitor connected via DisplayPort flickers and goes black intermittently after desk move.',
    close_notes: 'DisplayPort cable damaged during move (kink near connector). Replaced with new certified DP 1.4 cable. Updated Intel display driver. Issue fully resolved.',
    category: 'Hardware', priority: '3',
  },
  {
    short_description: 'Cannot connect to database server port 1433 after firewall maintenance',
    description: 'Dev team unable to connect to production database server since firewall maintenance window last night.',
    close_notes: 'Firewall maintenance reset custom rule for dev VLAN to SQL on port 1433. Re-added ACL rule in Palo Alto for dev subnet to DB server. Connections restored. Updated firewall runbook.',
    category: 'Network', priority: '2',
  },
  {
    short_description: 'Microsoft Teams video calls choppy and dropping for remote workers',
    description: 'Remote employees reporting Teams video calls choppy, audio cuts out, calls drop after 10-15 minutes.',
    close_notes: 'QoS policies for Teams traffic missing on updated VPN concentrator config. Added DSCP marking for Teams media traffic UDP 3478-3481. Enabled split tunneling for Teams endpoints. Call quality restored within 1 hour.',
    category: 'Network', priority: '2',
  },
];

async function createIncident(data) {
  const response = await client.post('/table/incident', {
    short_description: data.short_description,
    description: data.description,
    close_notes: data.close_notes,
    category: data.category,
    priority: data.priority,
    state: '7',
    close_code: 'Solved',
    caller_id: 'admin',
  });
  return response.data.result;
}

async function main() {
  console.log(`Connecting to ${process.env.SN_INSTANCE_URL}...`);
  console.log(`Creating ${incidents.length} demo incidents...\n`);
  for (let i = 0; i < incidents.length; i++) {
    try {
      const result = await createIncident(incidents[i]);
      console.log(`[${i+1}/${incidents.length}] ${result.number} - ${incidents[i].short_description.slice(0,55)}`);
    } catch (err) {
      console.error(`[${i+1}/${incidents.length}] FAILED: ${err.response?.data?.error?.message || err.message}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('\nDone. Restart the API to re-seed RAG corpus with new incidents.');
}

main();
