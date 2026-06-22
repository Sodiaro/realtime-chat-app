// Hand-maintained OpenAPI spec. Keep in sync when routes change.
const ID = { type: "string", example: "665f1c2a9b1e4a0012abcd34" };
const json = (schema) => ({ "application/json": { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (name) => ({ type: "array", items: ref(name) });
const ok = (desc, schema) => ({ description: desc, ...(schema ? { content: json(schema) } : {}) });
const auth = [{ cookieAuth: [] }];

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "DevChat API",
    version: "1.0.0",
    description:
      "Real-time messaging API. Auth is a JWT in an httpOnly `jwt` cookie, set on signup/login. " +
      "Most realtime behaviour (delivery, typing, presence, read/delivered receipts, edits) happens over Socket.IO. " +
      "WebRTC voice/video calls are signalled over Socket.IO too (events: call:offer/answer/ice/end/reject) — not REST.",
  },
  servers: [{ url: "/", description: "current host" }],
  tags: [
    { name: "Auth" },
    { name: "Account" },
    { name: "Users" },
    { name: "Messages" },
    { name: "Scheduled" },
    { name: "Conversations" },
    { name: "Moderation" },
    { name: "Push" },
    { name: "Calls" },
    { name: "Status" },
    { name: "Communities" },
    { name: "System" },
  ],
  components: {
    securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "jwt" } },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: ID,
          fullName: { type: "string", example: "Jane Doe" },
          email: { type: "string", format: "email" },
          username: { type: "string", example: "jane_99", nullable: true },
          profilePic: { type: "string" },
          bio: { type: "string", nullable: true },
          status: { type: "string", nullable: true },
          lastSeen: { type: "string", format: "date-time", nullable: true },
          isAdmin: { type: "boolean" },
          privacy: {
            type: "object",
            properties: {
              lastSeen: { type: "string", enum: ["everyone", "contacts", "nobody"] },
              readReceipts: { type: "boolean" },
              profilePhoto: { type: "string", enum: ["everyone", "contacts", "nobody"] },
            },
          },
          ghostMode: { type: "boolean", description: "hides read/edit/delete/last-seen/status-view activity (publicly flagged)" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Reaction: {
        type: "object",
        properties: { userId: ID, emoji: { type: "string", example: "👍" } },
      },
      Message: {
        type: "object",
        properties: {
          _id: ID,
          conversationId: ID,
          senderId: ID,
          receiverId: { ...ID, nullable: true, description: "absent for group messages" },
          text: { type: "string", nullable: true },
          image: { type: "string", nullable: true },
          audio: { type: "string", nullable: true, description: "mp3 url" },
          file: {
            type: "object",
            nullable: true,
            properties: { url: { type: "string" }, name: { type: "string" }, size: { type: "integer" }, type: { type: "string" } },
          },
          linkPreview: {
            type: "object",
            nullable: true,
            properties: { url: { type: "string" }, title: { type: "string" }, description: { type: "string" }, image: { type: "string" } },
          },
          poll: {
            type: "object",
            nullable: true,
            properties: {
              question: { type: "string" },
              multiple: { type: "boolean" },
              options: { type: "array", items: { type: "object", properties: { text: { type: "string" }, votes: { type: "array", items: ID } } } },
            },
          },
          location: {
            type: "object",
            nullable: true,
            properties: { lat: { type: "number" }, lng: { type: "number" }, label: { type: "string" } },
          },
          contact: {
            type: "object",
            nullable: true,
            properties: { userId: { ...ID, nullable: true }, name: { type: "string" }, username: { type: "string" }, avatar: { type: "string" } },
          },
          call: {
            type: "object",
            nullable: true,
            description: "call event rendered as a centered system message",
            properties: {
              type: { type: "string", enum: ["audio", "video"] },
              status: { type: "string", enum: ["answered", "missed", "rejected"] },
              durationSec: { type: "integer" },
            },
          },
          system: {
            type: "object",
            nullable: true,
            description: "system notice rendered centered in the timeline",
            properties: {
              type: { type: "string", enum: ["disappearing"] },
              on: { type: "boolean" },
            },
          },
          mentions: { type: "array", items: ID },
          replyTo: { oneOf: [ID, ref("Message")], nullable: true },
          forwardedFrom: { ...ID, nullable: true },
          reactions: arrayOf("Reaction"),
          starredBy: { type: "array", items: ID },
          expiresAt: { type: "string", format: "date-time", nullable: true, description: "disappearing messages" },
          viewOnce: { type: "boolean", description: "content can be opened only once per recipient" },
          viewedBy: { type: "array", items: ID, description: "recipients who consumed a view-once message" },
          deliveredAt: { type: "string", format: "date-time", nullable: true },
          readAt: { type: "string", format: "date-time", nullable: true },
          readBy: { type: "array", items: ID, description: "group read receipts" },
          editedAt: { type: "string", format: "date-time", nullable: true },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          pinnedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      MessagePage: {
        type: "object",
        properties: {
          messages: arrayOf("Message"),
          nextCursor: { type: "string", format: "date-time", nullable: true },
        },
      },
      Conversation: {
        type: "object",
        properties: {
          _id: ID,
          isGroup: { type: "boolean" },
          name: { type: "string", nullable: true },
          avatar: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          participants: arrayOf("User"),
          admins: { type: "array", items: ID },
          onlyAdminsCanMessage: { type: "boolean" },
          lastMessage: ref("Message"),
          lastMessageAt: { type: "string", format: "date-time", nullable: true },
          unread: { type: "integer" },
          isMuted: { type: "boolean" },
          isArchived: { type: "boolean" },
          isPinned: { type: "boolean" },
          isAdmin: { type: "boolean" },
          disappearMinutes: { type: "integer", description: "0 = off" },
        },
      },
      ScheduledMessage: {
        type: "object",
        properties: {
          _id: ID,
          senderId: ID,
          conversationId: ID,
          receiverId: { ...ID, nullable: true, description: "set for DMs, null for groups" },
          text: { type: "string", nullable: true },
          image: { type: "string", nullable: true },
          file: {
            type: "object",
            nullable: true,
            properties: { url: { type: "string" }, name: { type: "string" }, size: { type: "integer" }, type: { type: "string" } },
          },
          scheduledAt: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["pending", "sent", "canceled"] },
          sentMessageId: { ...ID, nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Report: {
        type: "object",
        properties: {
          _id: ID,
          reporterId: ref("User"),
          messageId: ref("Message"),
          reason: { type: "string" },
          status: { type: "string", enum: ["open", "resolved", "dismissed"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Call: {
        type: "object",
        properties: {
          _id: ID,
          callerId: ref("User"),
          calleeId: ref("User"),
          type: { type: "string", enum: ["audio", "video"] },
          status: { type: "string", enum: ["answered", "missed", "rejected"] },
          durationSec: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Status: {
        type: "object",
        properties: {
          _id: ID,
          userId: ID,
          type: { type: "string", enum: ["text", "image"] },
          text: { type: "string", nullable: true },
          image: { type: "string", nullable: true },
          bgColor: { type: "string", nullable: true },
          views: {
            type: "array",
            description: "Who viewed this status (owner-only; empty on others' statuses)",
            items: {
              type: "object",
              properties: {
                user: ref("User"),
                viewedAt: { type: "string", format: "date-time" },
              },
            },
          },
          expiresAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Session: {
        type: "object",
        properties: {
          _id: ID,
          userAgent: { type: "string" },
          ip: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          lastSeenAt: { type: "string", format: "date-time" },
          current: { type: "boolean", description: "true for the device making this request" },
        },
      },
      Error: { type: "object", properties: { message: { type: "string" } } },
    },
  },
  paths: {
    // ---------- Auth ----------
    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create an account (sets jwt cookie)",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["fullName", "email", "password"],
            properties: {
              fullName: { type: "string" },
              email: { type: "string", format: "email" },
              password: { type: "string", minLength: 6 },
              username: { type: "string", description: "3-20 chars: a-z, 0-9, _" },
            },
          }),
        },
        responses: {
          201: ok("Created", ref("User")),
          400: ok("Validation error / email exists", ref("Error")),
          409: ok("Username taken", ref("Error")),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in (sets jwt cookie)",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["email", "password"],
            properties: { email: { type: "string" }, password: { type: "string" } },
          }),
        },
        responses: { 200: ok("Logged in", ref("User")), 400: ok("Invalid credentials", ref("Error")), 429: ok("Rate limited") },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request a password-reset code (by email or username; generic response)",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["email"],
            properties: { email: { type: "string", description: "email OR username — code is sent to the account's email" } },
          }),
        },
        responses: { 200: ok("Code sent if the account exists (delivered only by email)"), 429: ok("Rate limited") },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with the emailed code (signs out all sessions)",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["email", "otp", "newPassword"],
            properties: { email: { type: "string", description: "email OR username" }, otp: { type: "string" }, newPassword: { type: "string", minLength: 6 } },
          }),
        },
        responses: { 200: ok("Password reset"), 400: ok("Invalid or expired code", ref("Error")), 429: ok("Rate limited") },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "Log out (clears cookie)", responses: { 200: ok("Logged out") } },
    },
    "/api/auth/check": {
      get: {
        tags: ["Auth"],
        summary: "Current authenticated user",
        security: auth,
        responses: { 200: ok("Current user", ref("User")), 401: ok("Not authenticated") },
      },
    },
    "/api/auth/check-username": {
      get: {
        tags: ["Auth"],
        summary: "Check username availability (public)",
        parameters: [{ name: "username", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("Availability", {
            type: "object",
            properties: { available: { type: "boolean" }, reason: { type: "string" } },
          }),
        },
      },
    },
    // ---------- Account ----------
    "/api/auth/update-profile": {
      put: {
        tags: ["Account"],
        summary: "Update profile (pic / username / bio / status)",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              profilePic: { type: "string", description: "base64 data URL" },
              username: { type: "string" },
              bio: { type: "string", maxLength: 200 },
              status: { type: "string", maxLength: 80 },
            },
          }),
        },
        responses: {
          200: ok("Updated user", ref("User")),
          409: ok("Username taken", ref("Error")),
          502: ok("Image upload failed", ref("Error")),
        },
      },
    },
    "/api/auth/privacy": {
      post: {
        tags: ["Account"],
        summary: "Update privacy settings (last seen / read receipts / profile photo / ghost mode)",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              lastSeen: { type: "string", enum: ["everyone", "contacts", "nobody"] },
              readReceipts: { type: "boolean" },
              profilePhoto: { type: "string", enum: ["everyone", "contacts", "nobody"] },
              ghostMode: { type: "boolean" },
            },
          }),
        },
        responses: { 200: ok("Updated user", ref("User")), 400: ok("Invalid / nothing to update", ref("Error")) },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Account"],
        summary: "Change password (also logs out other devices)",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["currentPassword", "newPassword"],
            properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 6 } },
          }),
        },
        responses: { 200: ok("Changed"), 400: ok("Wrong current password", ref("Error")) },
      },
    },
    "/api/auth/logout-all": {
      post: {
        tags: ["Account"],
        summary: "Log out of all other devices (bumps tokenVersion)",
        security: auth,
        responses: { 200: ok("Done") },
      },
    },
    "/api/auth/sessions": {
      get: {
        tags: ["Account"],
        summary: "List active device sessions",
        security: auth,
        responses: { 200: ok("Active sessions, newest activity first", arrayOf("Session")) },
      },
    },
    "/api/auth/sessions/{id}": {
      delete: {
        tags: ["Account"],
        summary: "Revoke a device session (logs that device out)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Revoked", { type: "object", properties: { revoked: { type: "boolean" } } }) },
      },
    },
    "/api/auth/me": {
      delete: {
        tags: ["Account"],
        summary: "Delete account (and the user's messages/DMs)",
        security: auth,
        responses: { 200: ok("Deleted") },
      },
    },
    "/api/auth/block/{id}": {
      post: {
        tags: ["Account"],
        summary: "Block / unblock a user (toggle)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("Updated block list", {
            type: "object",
            properties: { blockedUsers: { type: "array", items: ID } },
          }),
        },
      },
    },
    // ---------- Users ----------
    "/api/messages/users": {
      get: {
        tags: ["Users"],
        summary: "Your contacts (people you've messaged)",
        security: auth,
        responses: { 200: ok("Contacts", arrayOf("User")) },
      },
    },
    "/api/messages/users/search": {
      get: {
        tags: ["Users"],
        summary: "Search any user by username or name",
        security: auth,
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Matches", arrayOf("User")) },
      },
    },
    // ---------- Messages ----------
    "/api/messages/conversations": {
      get: {
        tags: ["Conversations"],
        summary: "Your conversations (groups + DMs) with unread/mute/archive state",
        security: auth,
        responses: { 200: ok("Conversations", arrayOf("Conversation")) },
      },
    },
    "/api/messages/search": {
      get: {
        tags: ["Messages"],
        summary: "Search messages (optionally within one DM)",
        security: auth,
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "with", in: "query", required: false, schema: { type: "string" }, description: "peer user id" },
        ],
        responses: { 200: ok("Matches", arrayOf("Message")) },
      },
    },
    "/api/messages/starred": {
      get: {
        tags: ["Messages"],
        summary: "Your starred messages",
        security: auth,
        responses: { 200: ok("Starred", arrayOf("Message")) },
      },
    },
    "/api/messages/{id}": {
      get: {
        tags: ["Messages"],
        summary: "DM history with a user (cursor paginated)",
        security: auth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "peer user id" },
          { name: "cursor", in: "query", required: false, schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 30, maximum: 100 } },
        ],
        responses: { 200: ok("A page of messages", ref("MessagePage")), 401: ok("Not authenticated") },
      },
    },
    "/api/messages/send/{id}": {
      post: {
        tags: ["Messages"],
        summary: "Send a DM (also delivered live over Socket.IO)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "receiver id" }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              text: { type: "string" },
              image: { type: "string", description: "base64 data URL" },
              audio: { type: "string", description: "base64 data URL (transcoded to mp3)" },
              file: { type: "object", properties: { data: { type: "string" }, name: { type: "string" }, size: { type: "integer" }, type: { type: "string" } } },
              poll: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } }, multiple: { type: "boolean" } } },
              location: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, label: { type: "string" } } },
              contact: { type: "object", properties: { userId: { type: "string" }, name: { type: "string" }, username: { type: "string" }, avatar: { type: "string" } } },
              replyTo: { type: "string", description: "message id being replied to" },
              viewOnce: { type: "boolean", description: "content can be opened only once" },
            },
          }),
        },
        responses: {
          201: ok("Created message", ref("Message")),
          400: ok("Empty message", ref("Error")),
          403: ok("Blocked", ref("Error")),
        },
      },
    },
    "/api/messages/{messageId}": {
      patch: {
        tags: ["Messages"],
        summary: "Edit a message (sender only, within 10 minutes)",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["text"], properties: { text: { type: "string" } } }) },
        responses: { 200: ok("Updated", ref("Message")), 403: ok("Not owner / window expired", ref("Error")) },
      },
      delete: {
        tags: ["Messages"],
        summary: "Delete a message (sender only, within 10 minutes; soft delete)",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Soft-deleted", ref("Message")), 403: ok("Not owner / window expired", ref("Error")) },
      },
    },
    "/api/messages/{messageId}/react": {
      post: {
        tags: ["Messages"],
        summary: "Toggle an emoji reaction",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["emoji"], properties: { emoji: { type: "string" } } }) },
        responses: { 200: ok("Updated", ref("Message")) },
      },
    },
    "/api/messages/{messageId}/pin": {
      post: {
        tags: ["Messages"],
        summary: "Toggle pin on a message",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Updated", ref("Message")) },
      },
    },
    "/api/messages/{messageId}/star": {
      post: {
        tags: ["Messages"],
        summary: "Toggle star (bookmark) on a message",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Star state", { type: "object", properties: { starred: { type: "boolean" } } }) },
      },
    },
    "/api/messages/{messageId}/view": {
      post: {
        tags: ["Messages"],
        summary: "Open a view-once message — returns its content once, then marks it consumed",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("Content", {
            type: "object",
            properties: {
              text: { type: "string", nullable: true },
              image: { type: "string", nullable: true },
              audio: { type: "string", nullable: true },
              file: { type: "object", nullable: true },
            },
          }),
          410: ok("Already viewed", ref("Error")),
        },
      },
    },
    "/api/messages/{messageId}/forward": {
      post: {
        tags: ["Messages"],
        summary: "Forward a message to a direct chat (to) or a group (conversationId)",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            description: "Provide exactly one of `to` or `conversationId`",
            properties: {
              to: { type: "string", description: "recipient user id (direct chat)" },
              conversationId: { type: "string", description: "target group/conversation id" },
            },
          }),
        },
        responses: { 201: ok("Forwarded message", ref("Message")) },
      },
    },
    "/api/messages/{messageId}/report": {
      post: {
        tags: ["Moderation"],
        summary: "Report a message",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["reason"], properties: { reason: { type: "string" } } }) },
        responses: { 201: ok("Reported") },
      },
    },
    // ---------- Conversations / groups ----------
    "/api/messages/group": {
      post: {
        tags: ["Conversations"],
        summary: "Create a group",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["name", "members"],
            properties: { name: { type: "string" }, members: { type: "array", items: ID } },
          }),
        },
        responses: { 201: ok("Created group", ref("Conversation")), 409: ok("Duplicate group name") },
      },
    },
    "/api/messages/conversation/{conversationId}/shared": {
      get: {
        tags: ["Conversations"],
        summary: "Shared media / files / links across a conversation's history",
        security: auth,
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "type", in: "query", required: false, schema: { type: "string", enum: ["media", "files", "links"], default: "media" } },
        ],
        responses: { 200: ok("Matching messages (newest first)", arrayOf("Message")), 403: ok("Not a participant") },
      },
    },
    "/api/messages/conversation/{conversationId}": {
      get: {
        tags: ["Conversations"],
        summary: "Conversation messages (group or DM, cursor paginated)",
        security: auth,
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "cursor", in: "query", required: false, schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 30 } },
        ],
        responses: { 200: ok("A page of messages", ref("MessagePage")), 403: ok("Not a participant") },
      },
      post: {
        tags: ["Conversations"],
        summary: "Send a message to a conversation (group)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              text: { type: "string" },
              image: { type: "string" },
              audio: { type: "string" },
              replyTo: { type: "string" },
              viewOnce: { type: "boolean" },
            },
          }),
        },
        responses: { 201: ok("Created message", ref("Message")), 403: ok("Not a participant") },
      },
      patch: {
        tags: ["Conversations"],
        summary: "Update group name / description / photo / posting permission (admins only)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string", maxLength: 500 },
              avatar: { type: "string", description: "base64 data URL" },
              onlyAdminsCanMessage: { type: "boolean" },
            },
          }),
        },
        responses: { 200: ok("Updated group", ref("Conversation")), 403: ok("Admins only"), 409: ok("Duplicate group name") },
      },
    },
    "/api/messages/conversation/{conversationId}/admin": {
      post: {
        tags: ["Conversations"],
        summary: "Promote/demote a member to admin (admins only)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({ type: "object", required: ["userId", "makeAdmin"], properties: { userId: { type: "string" }, makeAdmin: { type: "boolean" } } }),
        },
        responses: { 200: ok("Updated group", ref("Conversation")), 400: ok("Needs at least one admin"), 403: ok("Admins only") },
      },
    },
    "/api/messages/conversation/{conversationId}/invite": {
      post: {
        tags: ["Conversations"],
        summary: "Create (or rotate with ?rotate=1) the group invite link (admins only)",
        security: auth,
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "rotate", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: { 200: ok("Invite code", { type: "object", properties: { inviteCode: { type: "string" } } }), 403: ok("Admins only") },
      },
      delete: {
        tags: ["Conversations"],
        summary: "Disable the group invite link (admins only)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Revoked"), 403: ok("Admins only") },
      },
    },
    "/api/messages/invite/{code}": {
      get: {
        tags: ["Conversations"],
        summary: "Preview a group from an invite code",
        security: auth,
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: ok("Group preview", { type: "object", properties: { _id: ID, name: { type: "string" }, avatar: { type: "string", nullable: true }, description: { type: "string", nullable: true }, memberCount: { type: "integer" }, isMember: { type: "boolean" } } }),
          404: ok("Invalid or expired invite"),
        },
      },
    },
    "/api/messages/invite/{code}/join": {
      post: {
        tags: ["Conversations"],
        summary: "Join a group via an invite code",
        security: auth,
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Joined group", ref("Conversation")), 404: ok("Invalid or expired invite") },
      },
    },
    "/api/messages/conversation/{conversationId}/mute": {
      post: {
        tags: ["Conversations"],
        summary: "Toggle mute for the current user",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Mute state", { type: "object", properties: { isMuted: { type: "boolean" } } }) },
      },
    },
    "/api/messages/conversation/{conversationId}/archive": {
      post: {
        tags: ["Conversations"],
        summary: "Toggle archive for the current user",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Archive state", { type: "object", properties: { isArchived: { type: "boolean" } } }) },
      },
    },
    "/api/messages/conversation/{conversationId}/pin": {
      post: {
        tags: ["Conversations"],
        summary: "Toggle pin-to-top for the current user",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Pin state", { type: "object", properties: { isPinned: { type: "boolean" } } }) },
      },
    },
    "/api/messages/conversation/{conversationId}/disappearing": {
      post: {
        tags: ["Conversations"],
        summary: "Set disappearing-messages timer (0 = off)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["minutes"],
            properties: { minutes: { type: "integer", description: "minutes until messages expire; 0 disables" } },
          }),
        },
        responses: { 200: ok("Updated", { type: "object", properties: { disappearMinutes: { type: "integer" } } }) },
      },
    },
    "/api/messages/scheduled": {
      get: {
        tags: ["Scheduled"],
        summary: "List the current user's pending scheduled messages",
        security: auth,
        responses: { 200: ok("Pending scheduled messages", arrayOf("ScheduledMessage")) },
      },
      post: {
        tags: ["Scheduled"],
        summary: "Schedule a message for future delivery",
        description: "Provide either `to` (a user id, for DMs) or `conversationId` (for groups), plus a future `scheduledAt`.",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["scheduledAt"],
            properties: {
              to: { type: "string", description: "recipient user id (DM)" },
              conversationId: { type: "string", description: "target group conversation id" },
              text: { type: "string" },
              image: { type: "string", description: "base64 data url" },
              file: { type: "object", properties: { data: { type: "string" }, name: { type: "string" }, size: { type: "integer" }, type: { type: "string" } } },
              scheduledAt: { type: "string", format: "date-time", description: "must be in the future" },
            },
          }),
        },
        responses: { 201: ok("Scheduled", ref("ScheduledMessage")), 400: ok("Invalid time or empty message") },
      },
    },
    "/api/messages/scheduled/{id}": {
      delete: {
        tags: ["Scheduled"],
        summary: "Cancel a pending scheduled message",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Canceled", { type: "object", properties: { canceled: { type: "boolean" } } }), 404: ok("Not found or already sent") },
      },
    },
    "/api/messages/conversation/{conversationId}/members": {
      post: {
        tags: ["Conversations"],
        summary: "Add members to a group (admins only)",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["members"], properties: { members: { type: "array", items: ID } } }) },
        responses: { 200: ok("Updated group", ref("Conversation")), 403: ok("Admins only") },
      },
    },
    "/api/messages/conversation/{conversationId}/members/{userId}": {
      delete: {
        tags: ["Conversations"],
        summary: "Remove a member (admins only)",
        security: auth,
        parameters: [
          { name: "conversationId", in: "path", required: true, schema: { type: "string" } },
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: ok("Removed"), 403: ok("Admins only") },
      },
    },
    "/api/messages/conversation/{conversationId}/leave": {
      post: {
        tags: ["Conversations"],
        summary: "Leave a group",
        security: auth,
        parameters: [{ name: "conversationId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Left") },
      },
    },
    // ---------- Moderation (admin) ----------
    "/api/admin/reports": {
      get: {
        tags: ["Moderation"],
        summary: "List reports (admin only)",
        security: auth,
        parameters: [{ name: "status", in: "query", required: false, schema: { type: "string", enum: ["open", "resolved", "dismissed", "all"] } }],
        responses: { 200: ok("Reports", arrayOf("Report")), 403: ok("Admin only") },
      },
    },
    "/api/admin/reports/{reportId}": {
      patch: {
        tags: ["Moderation"],
        summary: "Resolve or dismiss a report (admin only)",
        security: auth,
        parameters: [{ name: "reportId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["resolved", "dismissed"] } } }) },
        responses: { 200: ok("Updated report", ref("Report")), 403: ok("Admin only") },
      },
    },
    "/api/messages/{messageId}/vote": {
      post: {
        tags: ["Messages"],
        summary: "Vote on a poll option (toggles your vote)",
        security: auth,
        parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json({ type: "object", required: ["optionIndex"], properties: { optionIndex: { type: "integer" } } }) },
        responses: { 200: ok("Updated message", ref("Message")), 404: ok("Poll not found", ref("Error")) },
      },
    },
    // ---------- Calls ----------
    "/api/calls": {
      get: {
        tags: ["Calls"],
        summary: "Your call history (as caller or callee)",
        security: auth,
        responses: { 200: ok("Calls", arrayOf("Call")) },
      },
      post: {
        tags: ["Calls"],
        summary: "Log a completed call (caller records it)",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["calleeId", "type"],
            properties: {
              calleeId: { type: "string" },
              type: { type: "string", enum: ["audio", "video"] },
              status: { type: "string", enum: ["answered", "missed", "rejected"] },
              durationSec: { type: "integer" },
            },
          }),
        },
        responses: { 201: ok("Logged", ref("Call")) },
      },
    },
    // ---------- Status / Stories ----------
    "/api/status": {
      get: {
        tags: ["Status"],
        summary: "Active statuses from you + your contacts, grouped by user",
        security: auth,
        responses: {
          200: ok("Status groups", {
            type: "array",
            items: { type: "object", properties: { user: ref("User"), statuses: arrayOf("Status"), hasUnviewed: { type: "boolean" } } },
          }),
        },
      },
      post: {
        tags: ["Status"],
        summary: "Post a status (auto-expires after 24h)",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["type"],
            properties: {
              type: { type: "string", enum: ["text", "image"] },
              text: { type: "string" },
              image: { type: "string", description: "base64 data URL" },
              bgColor: { type: "string" },
            },
          }),
        },
        responses: { 201: ok("Created", ref("Status")) },
      },
    },
    "/api/status/{id}/view": {
      post: {
        tags: ["Status"],
        summary: "Mark a status as viewed",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Viewed") },
      },
    },
    "/api/status/{id}": {
      delete: {
        tags: ["Status"],
        summary: "Delete your own status",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Deleted") },
      },
    },
    // ---------- Communities ----------
    "/api/communities": {
      get: {
        tags: ["Communities"],
        summary: "List communities I belong to (with group + member counts)",
        security: auth,
        responses: { 200: ok("My communities") },
      },
      post: {
        tags: ["Communities"],
        summary: "Create a community + its announcement channel",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" }, description: { type: "string" } },
          }),
        },
        responses: { 201: ok("Created community + announcement channel"), 409: ok("Name already taken") },
      },
    },
    "/api/communities/{id}": {
      get: {
        tags: ["Communities"],
        summary: "Community detail: announcement, groups (with my membership), members (members only)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Community detail"), 403: ok("Join to view") },
      },
      patch: {
        tags: ["Communities"],
        summary: "Edit community name / description / avatar (admins only)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string", maxLength: 500 },
              avatar: { type: "string", description: "base64 data URL" },
            },
          }),
        },
        responses: { 200: ok("Updated community"), 403: ok("Admins only"), 409: ok("Duplicate name") },
      },
    },
    "/api/communities/{id}/groups": {
      post: {
        tags: ["Communities"],
        summary: "Create a group inside the community (admins only)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" }, members: { type: "array", items: ID } },
          }),
        },
        responses: { 201: ok("Created group", ref("Conversation")), 403: ok("Admins only"), 409: ok("Duplicate group name in this community") },
      },
    },
    "/api/communities/{id}/groups/{groupId}": {
      patch: {
        tags: ["Communities"],
        summary: "Edit a community group's description (admins only)",
        security: auth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "groupId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: json({ type: "object", properties: { description: { type: "string", maxLength: 500 } } }),
        },
        responses: { 200: ok("Updated group", ref("Conversation")), 403: ok("Admins only") },
      },
    },
    "/api/communities/{id}/join": {
      post: {
        tags: ["Communities"],
        summary: "Join the community (and its announcement channel)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Joined community") },
      },
    },
    "/api/communities/{id}/leave": {
      post: {
        tags: ["Communities"],
        summary: "Leave the community (removes you from its conversations)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Left community") },
      },
    },
    "/api/communities/{id}/groups/{groupId}/join": {
      post: {
        tags: ["Communities"],
        summary: "Join one specific group within the community",
        security: auth,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "groupId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: ok("Joined group", ref("Conversation")), 403: ok("Join the community first") },
      },
    },
    "/api/communities/{id}/role": {
      post: {
        tags: ["Communities"],
        summary: "Set a member's role: admin / moderator / member (admins only)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["userId", "role"],
            properties: { userId: ID, role: { type: "string", enum: ["admin", "moderator", "member"] } },
          }),
        },
        responses: { 200: ok("Updated roles"), 403: ok("Admins only"), 400: ok("Invalid role / last admin") },
      },
    },
    "/api/communities/{id}/invite": {
      post: {
        tags: ["Communities"],
        summary: "Create (or fetch) the community invite link (admins only)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Invite code", { type: "object", properties: { inviteCode: { type: "string" } } }), 403: ok("Admins only") },
      },
      delete: {
        tags: ["Communities"],
        summary: "Disable the community invite link (admins only)",
        security: auth,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Revoked"), 403: ok("Admins only") },
      },
    },
    "/api/communities/invite/{code}": {
      get: {
        tags: ["Communities"],
        summary: "Preview a community from an invite code",
        security: auth,
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Community preview"), 404: ok("Invalid or expired invite") },
      },
    },
    "/api/communities/invite/{code}/join": {
      post: {
        tags: ["Communities"],
        summary: "Join a community via an invite code",
        security: auth,
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: ok("Joined community"), 404: ok("Invalid or expired invite") },
      },
    },
    // ---------- Push ----------
    "/api/push/public-key": {
      get: {
        tags: ["Push"],
        summary: "VAPID public key for web-push subscription (null if push disabled)",
        responses: { 200: ok("Key", { type: "object", properties: { key: { type: "string", nullable: true } } }) },
      },
    },
    "/api/push/subscribe": {
      post: {
        tags: ["Push"],
        summary: "Register this device's push subscription",
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["subscription"],
            properties: {
              subscription: {
                type: "object",
                description: "browser PushSubscription JSON",
                properties: {
                  endpoint: { type: "string" },
                  keys: { type: "object", properties: { p256dh: { type: "string" }, auth: { type: "string" } } },
                },
              },
            },
          }),
        },
        responses: { 201: ok("Subscribed"), 400: ok("Invalid subscription", ref("Error")) },
      },
    },
    "/api/push/unsubscribe": {
      post: {
        tags: ["Push"],
        summary: "Remove a push subscription",
        security: auth,
        requestBody: {
          required: true,
          content: json({ type: "object", properties: { endpoint: { type: "string" } } }),
        },
        responses: { 200: ok("Unsubscribed") },
      },
    },
    // ---------- System ----------
    "/health": { get: { tags: ["System"], summary: "Liveness probe", responses: { 200: ok("ok") } } },
    "/ready": { get: { tags: ["System"], summary: "Readiness probe (checks DB)", responses: { 200: ok("ready"), 503: ok("not ready") } } },
    "/metrics": { get: { tags: ["System"], summary: "Prometheus metrics", responses: { 200: ok("Prometheus text format") } } },
  },
};
