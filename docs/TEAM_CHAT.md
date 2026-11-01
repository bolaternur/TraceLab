# Team chat and graph visibility

The workspace has a separate **Chat / Чат / Чат** tab for each team. It is shared across the team's projects. An authenticated team member can send text, a photo, or a recorded voice message. Chat messages do not become engineering records or graph nodes automatically.

## Sources and Inbox

**Sources / Источники** configures the origin of imported engineering evidence. The current workspace connector accepts supported GitHub events and imports metadata with provenance. Connecting a source is different from sending a chat message.

**Inbox / Входящие** is the review queue for imported evidence. A team member can inspect an item, link it to the engineering history, or ignore it. It is not a personal email inbox.

## Remove a record from the graph

Use the trash icon on a graph node, or **Убрать из графа** in its details. This hides the node and its edges on the graph. The record, files, relations, and history remain intact. Open **Скрытые: N** on the canvas and press **Вернуть** to restore a record. The record's author/importer or team lead can change this shared visibility; the server enforces these permissions.

## Messages and files

- Text: up to 4,000 characters; retrying an uncertain send uses an idempotent request ID.
- Photos: JPEG, PNG, or WebP, up to 15 MiB. The server decodes and normalizes the image and removes embedded metadata.
- Voice messages: supported WebM, Ogg, or MP4 audio containers, up to 6 MiB. The recorder stops at five minutes. Duration is client-reported, not independently decoded by the server; container signatures and byte limits are checked server-side.
- Attachments use private storage and authenticated, non-cacheable download routes. Before posting, only the uploader can read a staged attachment; after posting, current team members can read it.
- Attachments count toward the existing 500 MiB team media limit. Unattached uploads can be discarded; a bounded cleanup also reclaims the uploader's expired, unattached uploads during subsequent uploads.
- Changing the signed-in account invalidates the active composer and call. Mutations also bind the expected account in a request header. Unsent text and selected-file drafts stay in module memory for the same team and account; reloading the page loses them.

Messages are stored on the application server. This implementation does not claim end-to-end encryption. Current team membership is checked for messages, attachments, and call signaling. There is no message edit/delete UI in this first version.

## Group voice room

Press **Join call / Присоединиться** to request microphone access. Up to six accounts can join a team room simultaneously. Controls allow muting and leaving; leaving the workspace section or closing the page releases microphone tracks and peer connections. Do not interpret a successful signaling test as a test of real microphone quality or cross-network audio delivery.

Voice rooms use browser WebRTC audio. The application relays signaling, not recorded call audio. Calls are not recorded by this feature. Voice notes are separate files that the user deliberately records and sends.

### Local testing

Open `http://localhost:3000/workspace?view=chat`, sign in, and select a team. A second team member can use another browser/profile with a different account. Microphone access always requires the browser's permission. With no ICE servers configured, only connections that the peers can establish directly are expected to work.

### Publication and different networks

Use a public HTTPS application URL, a persistent shared database, and private file storage for team testing over the internet. Configure a STUN/TURN service for dependable connectivity across networks. Buying a domain alone does not provide these services.

Server environment variables (blank examples are in `.env.example`):

```dotenv
CHAT_STUN_URLS=stun:YOUR_STUN_HOST:3478
CHAT_TURN_URLS=turn:YOUR_TURN_HOST:3478?transport=udp,turns:YOUR_TURN_HOST:5349?transport=tcp
CHAT_TURN_SHARED_SECRET=YOUR_SERVER_SIDE_SHARED_SECRET
```

Use a TURN server that supports the TURN REST shared-secret mechanism. The server creates temporary HMAC credentials and refreshes them on call heartbeats; the browser updates peer ICE configuration. Keep the shared secret out of client bundles, logs, Git, and all `NEXT_PUBLIC_*` variables. Restart the server after changing environment variables.

Acceptance before a public pilot: join from two real accounts on different networks; verify both directions of audio, mute/unmute, a third participant, leave/rejoin, microphone denial, and network loss. Confirm relay connectivity with the actual deployed TURN service. No external TURN provider is connected by this change.
