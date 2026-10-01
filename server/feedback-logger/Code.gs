/* UB Tools Studio — missed-question logger.
 *
 * A tiny Google Apps Script web app. Every question the Studio couldn't
 * answer is POSTed here as JSON {question, page, at}. The script appends it
 * to a Google Sheet and emails Derek, one email per question.
 *
 * Setup (about 5 minutes, once):
 *  1. Go to https://script.google.com and sign in as Derek.
 *  2. New project, delete the starter code, paste this whole file.
 *  3. Run the `setup` function once from the toolbar (authorizes the script).
 *  4. Deploy > New deployment > type "Web app":
 *       Execute as: Me
 *       Who has access: Anyone
 *     Deploy, and copy the Web app URL.
 *  5. Send that URL to Bro — it goes into FEEDBACK_ENDPOINT in app/app.js,
 *     then the Studio is pushed and auto-logging starts.
 *
 * Notes:
 *  - "Anyone" access only lets the script receive questions; the Sheet and
 *    Derek's inbox stay private to his Google account.
 *  - Free Gmail accounts can send ~100 of these emails a day — plenty.
 *  - To change where the mail goes, edit EMAIL_TO below and redeploy.
 */

const EMAIL_TO = 'discosteed8@gmail.com'
const SHEET_TITLE = 'UB Tools Studio — missed questions'

function logSheet() {
  const props = PropertiesService.getScriptProperties()
  let ss = null
  const id = props.getProperty('SHEET_ID')
  if (id) {
    try { ss = SpreadsheetApp.openById(id) } catch (e) { ss = null }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_TITLE)
    props.setProperty('SHEET_ID', ss.getId())
  }
  let sh = ss.getSheetByName('Questions')
  if (!sh) {
    sh = ss.insertSheet('Questions')
    sh.appendRow(['Time', 'Question', 'Page'])
  }
  return sh
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents)
    const q = String(d.question || '').slice(0, 500).trim()
    if (!q) return ok()
    const page = String(d.page || '').slice(0, 200)
    const now = new Date()
    logSheet().appendRow([now, q, page])
    MailApp.sendEmail(
      EMAIL_TO,
      'UB Tools Studio: a question it did not answer',
      'Question: ' + q + '\n\nPage: ' + page + '\nTime: ' + now + '\n\n(All missed questions are also in the "' + SHEET_TITLE + '" spreadsheet.)'
    )
  } catch (err) {
    // Never break the Studio because logging failed.
  }
  return ok()
}

// Run once after pasting, to authorize the script and create the Sheet.
function setup() {
  logSheet()
}

function ok() {
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT)
}
