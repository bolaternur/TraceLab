# TraceLab — English user guide

Working version, 28 October 2026. [Русский](USER_GUIDE_RU.md) · [Қазақша](USER_GUIDE_KK.md). See the [requirement matrix](IMPLEMENTATION_MATRIX.md) for exact implementation status. Team evidence is private; educational examples are not research results.

## First sign-in and saving

Open the site and create your own account: enter your name, email and password, verify the address and sign in. Choose I have a team code and enter the code from your lead. The first lead instead chooses Create a team and sets the project, season, timezone and language. Do not create a duplicate of an existing team. Local development uses a protected test mailbox; teams on separate computers need the deployed site with configured email.

Check the displayed team and project before adding evidence. In team mode, wait for server confirmation. “Saved on this device” means only the local queue. If saving fails, keep the form open, resolve the issue and retry.

The signed-in account is the author. Students edit their own explanations. A team lead organizes work but cannot rewrite another student's rationale. Coach access does not authorize writing as a student. The UI and server may deny an action based on role.

## Workspace sections

| Section | Purpose and first action | Saved evidence and links | Empty/error/limits |
| --- | --- | --- | --- |
| Graph | Open or add a record. Move cards, create a directed connection with the form, zoom or fit. A list is available as an alternative. | Shared content and links; layout saves separately. Removing a mistaken link does not delete its records. | A new team is empty. Clear filters if records are hidden. Physical touch gestures still need full testing. |
| History | Browse newest evidence grouped by day. Search text; choose type, author, period and order; open details. | Dates use the team timezone. Query/filter state stays in the page URL. | No results may mean an active filter. Complete multi-season cursor search is not available. |
| Tests | Add actual conditions, criterion, measurement or trial/success counts. Compare like units and conditions. | Result, author, date and links to source/decision. A table accompanies the chart. | Never invent a missing value. Successes cannot exceed trials. Not every incompatible comparison is automatically detected. |
| Decisions | Save a draft choice. Add your own “why” and a real test/source link before closing. | Author explanation and versions; original source remains unchanged. | Closing without rationale is rejected. Author close/reopen is available in Inbox; the complete iteration analysis workflow is unfinished. |
| Study | Enter a real paired measurement with participant code, task, condition, date and unit. CSV batches can be validated/imported. | Research observations are separate from robot test results; a batch imports atomically. | Example numbers do not prove TraceLab's impact. Avoid names or unnecessary personal details. |
| Gallery | Upload your own photo or PDF/CSV. Review, crop or redact sensitive regions before upload if needed. | Private artifact, source, caption and change history. Images are normalized with a thumbnail; documents download as files. | JPEG/PNG/WebP and PDF/CSV are supported; video is not. Retry a failed upload. Permanent deletion/retention and bulk linking are incomplete. |
| Models | Upload a self-contained GLB and choose robot/assembly/part. Open orbit, zoom, reset, wireframe or fullscreen controls. | Each version has its own ID and bytes. A new version keeps the old version referenced by earlier evidence. | STEP/OBJ/STL and external textures are unsupported. Download the file if WebGL is unavailable; the viewer is not a CAD converter. |
| Sources | A team lead configures an exact GitHub repository/project. Copy the one-time secret and configure the webhook only when ready to connect the provider. | Signed push/ping deliveries and commit metadata: SHA, branch, actor label, occurrence/receipt time and link. Delivery failures can be inspected/retried. | Pending is not connected. No live GitHub was activated in this development task. Full Inbox, repository backfill and verified contributor mapping are absent. |
| Inbox | Open new sources, assign an existing iteration or defer; restore deferred items when needed. Create an iteration if none fits. | Original metadata, Inbox/Linked/Deferred states, counts and pagination. The iteration author can close with the change, their own rationale, outcome/next step, or reopen it. | Deferring does not erase the original source. Batch triage, automatic classification and full browser E2E are incomplete; no live GitHub connection. |
| Team dialog | Review members and invitations. A lead can promote/demote student leads, remove/restore access and revoke invitations. | Role/settings changes are audited. Removing access does not erase authored evidence. Team name, default language and timezone persist. | The last lead cannot be removed/demoted. A student cannot assign themselves coach access. Organization, adult roles and complete season archives are outside this control. |

After uploading, check the project and title. A Gallery photo alone does not establish a test result: add the student's observation and a real graph link. Archive hides an item from the normal list; it is not a promise to erase every backup.

## Project menu, invitations and existing data

The project menu provides selection/creation, import, invitation, report and offline capture. A lead can create a limited invitation link; this does not send email automatically. Share it yourself with the intended participant. An expired or consumed link needs a new invitation.

Import an older project from this browser or JSON. Review destination team, name, record/link counts and warnings, then confirm. A separate project is created; the browser original remains intact. Imported author labels are not verified identities. Educational origin stays educational after making an editable copy.

If another participant edited the project, an outdated save does not overwrite the latest version. Your text stays in the form and is saved as a separate author proposal. Open your proposal in version history, compare it with the current record and save an agreed revision. There is no automatic merge; another author's proposal does not become your authored work.

## Account and languages

Account settings at /account save your display name and RU/EN/KK language. They list your active sessions and let you revoke one, other sessions or all sessions. Revoking the current session signs you out. Email change and account deletion are not implemented.

The language switch translates interface labels, not authored evidence. Team timezone controls dates. Switching UI language is not a request to translate or rewrite a student's rationale.

## Offline capture

Open the intended project online at least once, then choose quick offline capture from the project menu. New text records and JPEG/PNG/WebP photos are stored in the account/device IndexedDB queue. Choose a photo or camera, check its project/caption and save it to the queue. When online, send it to the team and wait for confirmation. If the session expired, sign in to the same account.

You can export drafts and each pending photo separately; discarding your queued file requires explicit confirmation. Do not clear browser data before syncing or backing up. Signing out does not delete unsent drafts. Limits: 15 MiB per photo, 60 MiB pending photos across the device, 100 records per account. A queued original may still contain EXIF/GPS: the server strips metadata after upload, not inside the local queue. GLB and edits to existing records remain outside this workflow; real offline device-restart acceptance is unverified.

## Reports and backup

Choose the PDF/HTML report action. Select PDF, HTML or JSON, A4/Letter for PDF, and project evidence, my authored records or handoff scope. Select exact records, review warnings and acknowledge the privacy check. The generated file appears in the result and saved-report history.

History preserves versions. Retrying a failed report uses its original snapshot; creating a new report uses current evidence. You can cancel your own unfinished generation. Closing the dialog does not itself cancel processing.

An engineering report preserves authored text and provenance. Competition mode needs a current reviewed policy. Choosing engineering mode is not permission to submit to a competition. Inspect warnings about missing or reference-only files and follow the actual submission rules.

JSON/PDF does not replace a database-and-files backup. Only a separate database restore has been verified so far; combined object restoration is still pending. A real migration needs a complete backup and restoration check.

## Three practical walkthroughs

### New student: photo → test → decision → history

1. Register, verify and sign in. Accept an invitation or create an empty team/project.
2. Upload your own photo to Gallery, remove unnecessary personal details and caption the observed change.
3. Add a test with actual conditions/results and connect it to the photo record.
4. Save a draft decision, write your own rationale, link the test and close only after review.
5. Find the chain in History/Graph and reload to verify persistence. Leave an absent measurement absent.

### Team lead: invite → gaps → evidence → handoff

1. Create a limited invitation for the correct team and share it with the intended member.
2. Review history and decisions manually for missing rationale/results/confirmed links. A complete automated gaps dashboard is not available.
3. Ask the author to add their explanation instead of rewriting it as the lead.
4. Inspect Sources/Gallery and exact versions; connect real evidence. Activate GitHub only after deliberate webhook configuration.
5. Generate a selected handoff report and write open questions separately. Transfer between organizations and a complete season archive remain unfinished.

### Portfolio: evidence → policy → preview → PDF → backup

1. Select sources/tests/decisions; check authors, dates, versions, photo permissions and educational labels.
2. Review current real competition rules with a responsible person. The software gate does not replace this review.
3. Select exact records/format/scope in the composer, review warnings and remove unnecessary personal data.
4. Generate and open the PDF. Check pages, images, captions and manifest references. If evidence changes, ask the author to correct it and generate a new version.
5. Keep the output and arrange a separate database-plus-files backup. Do not publish private team or minors' evidence without the appropriate permission.

## If something fails

Keep the draft and note the project/action. Check network, sign-in, membership and file limits. Use the retry action for the same operation instead of creating duplicate records manually. Revoked membership blocks server access even if the page remains open.

This guide describes implemented paths and their limits. Full native-language, phone/browser, legal and competition acceptance has not been completed.

## Joining with a team code

Each person registers their own account and verifies their email. The first lead chooses Create a team, then opens Project → Team code → Create team code. The random code belongs to that team, lasts 14 days and accepts up to 50 members. The lead copies its code or link immediately and shares it with intended participants. History does not display the plain code again.

Other participants choose I have a team code during onboarding or Project → Join a team with a code if they already opened another team. Enter 12 characters; case, spaces and hyphens do not matter. They join the same team records and files while retaining their own account and authorship. Codes grant the student member role, without coach or lead permissions.

Team settings shows uses and expiry and lets the lead revoke a code. Revocation blocks new joins and does not remove existing members; manage their access separately. At most five team codes may be active. Existing personal single-use invitations still work. Teams on separate computers need the deployed HTTPS site and working verification email; localhost is accessible only on the current computer.
