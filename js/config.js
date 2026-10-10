/**
 * CHURCH CONNECT — SETTINGS
 * Edit this file to brand the app and connect it to Google Sheets.
 * Nothing here is secret. Never put passwords or API keys in this file.
 */
window.CHURCH_CONNECT_CONFIG = {
  CHURCH_NAME: 'Upon Mount Zion RM',

  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxkSpVdop1RR8ElxWnG0Sfw2nwnmXhIrIjV4mKIePbD-AbOuOB5bk73_gcDsNFRZE5v/exec',

  // Set true (or open the site with ?demo=1) to try the form WITHOUT saving anything.
  // Demo submissions are clearly labelled and are never sent to Google Sheets.
  DEMO_MODE: false,

  // Dropdown choices. Leave BRANCHES empty ([]) to hide the Branch field.
  BRANCHES: ['Headquaters'],
  SERVICES: ['Sunday Service', 'Midweek Service', 'Special Programme', 'Other'],
  AGE_GROUPS: ['Child (0–12)', 'Teenager (13–17)', 'Young adult (18–35)', 'Adult (36–59)', 'Senior (60+)'],
  REFERRAL_SOURCES: [
    'Friend or family member',
    'Invited by a church member',
    'Social media',
    'Outreach or flyer',
    'Online search',
    'Walked in',
    'Other'
  ],
  // Suggestions only: ushers can type any department.
  DEPARTMENTS: ['Choir', 'Ushering', 'Media', 'Children’s Ministry', 'Youth Ministry', 'Protocol', 'Prayer Team', 'Welfare'],

  // How long to wait for Google before showing a retry message.
  REQUEST_TIMEOUT_MS: 20000
};
