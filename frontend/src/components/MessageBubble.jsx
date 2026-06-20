import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Check, CheckCheck, Clock, AlertCircle, Pencil, Trash2, SmilePlus, X, Reply, Forward, Pin, Flag, Star, FileText, Download, MapPin, MessageSquare } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { formatMessageTime } from "../lib/utils";
import Avatar from "./Avatar";
import Lightbox from "./Lightbox";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const formatSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// highlight @mentions inside message text
const renderText = (text) =>
  text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-sky-400 font-medium">{part}</span>
    ) : (
      part
    )
  );

const MessageBubble = ({ message, isOwn, authUser, selectedUser, users, grouped = false }) => {
  // select stable action refs only, so memo() isn't defeated by whole-store subscription
  const {
    editMessage, deleteMessage, reactToMessage, setReplyingTo, setForwarding,
    pinMessage, reportMessage, starMessage, votePoll, setSelectedUser,
  } = useChatStore(
    useShallow((s) => ({
      editMessage: s.editMessage,
      deleteMessage: s.deleteMessage,
      reactToMessage: s.reactToMessage,
      setReplyingTo: s.setReplyingTo,
      setForwarding: s.setForwarding,
      pinMessage: s.pinMessage,
      reportMessage: s.reportMessage,
      starMessage: s.starMessage,
      votePoll: s.votePoll,
      setSelectedUser: s.setSelectedUser,
    }))
  );
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [showPicker, setShowPicker] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const isDeleted = Boolean(message.deletedAt);
  const mentionsMe = (message.mentions || []).some((id) => id === authUser._id);
  const starredByMe = (message.starredBy || []).some((id) => id === authUser._id);
  // edit/delete only within 10 minutes of sending
  const canModify = isOwn && Date.now() - new Date(message.createdAt).getTime() < 10 * 60 * 1000;
  const isGroup = selectedUser.isGroup;
  // in a group, the other messages can be from any member
  const sender = isGroup && !isOwn ? (users || []).find((u) => u._id === message.senderId) : null;

  // group read receipts: who (besides me) has read my own message
  const nameFor = (id) => {
    const p = (selectedUser.participants || []).find((x) => (x?._id || x) === id);
    return p?.fullName || (users || []).find((u) => u._id === id)?.fullName || "Member";
  };
  const readers = isOwn && isGroup ? (message.readBy || []).filter((id) => id !== authUser._id) : [];
  const avatar = isOwn
    ? authUser.profilePic
    : isGroup
      ? sender?.profilePic
      : selectedUser.profilePic;

  const report = () => {
    const reason = window.prompt("Why are you reporting this message?");
    if (reason && reason.trim()) reportMessage(message._id, reason.trim());
  };

  const submitEdit = async () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.text) await editMessage(message._id, trimmed);
    setEditing(false);
  };

  const react = (emoji) => {
    reactToMessage(message._id, emoji);
    setShowPicker(false);
  };

  // open a DM with a shared contact
  const openContactChat = (c) =>
    setSelectedUser({ _id: c.userId, fullName: c.name, username: c.username, profilePic: c.avatar });

  // group reactions by emoji → { "👍": 2, ... }
  const reactionCounts = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`chat ${isOwn ? "chat-end" : "chat-start"} group`}>
      <div className="chat-image">
        {grouped ? (
          <div className="size-10" aria-hidden />
        ) : (
          <Avatar
            src={avatar}
            name={isOwn ? authUser.fullName : isGroup ? sender?.fullName : selectedUser.fullName}
            user={isOwn ? authUser : isGroup ? sender : selectedUser}
            size="size-10"
          />
        )}
      </div>

      <div className={`chat-header mb-1 flex items-center gap-1 ${grouped ? "hidden" : ""}`}>
        {isGroup && !isOwn && (
          <span className="text-xs font-medium opacity-70">{sender?.fullName || "Member"}</span>
        )}
        {starredByMe && !isDeleted && <Star className="size-3 text-amber-400 fill-amber-400" title="Starred" />}
        {message.pinnedAt && !isDeleted && <Pin className="size-3 text-amber-500" title="Pinned" />}
        <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
        {message.editedAt && !isDeleted && <span className="text-xs opacity-40">(edited)</span>}
        {isOwn && message.pending && (
          <Clock className="size-3 opacity-50 animate-pulse" title="Sending…" />
        )}
        {isOwn && message.failed && (
          <span className="text-error inline-flex items-center gap-0.5 text-[11px]" title="Failed to send">
            <AlertCircle className="size-3" /> Failed
          </span>
        )}
        {isOwn &&
          !isGroup &&
          !isDeleted &&
          !message.pending &&
          !message.failed &&
          (message.readAt ? (
            <CheckCheck className="size-3.5 text-sky-500" title="Seen" />
          ) : message.deliveredAt ? (
            <CheckCheck className="size-3.5 opacity-50" title="Delivered" />
          ) : (
            <Check className="size-3.5 opacity-50" title="Sent" />
          ))}
        {isOwn && isGroup && !isDeleted && !message.pending && readers.length > 0 && (
          <span className="text-xs opacity-50 flex items-center gap-0.5" title={`Seen by ${readers.map(nameFor).join(", ")}`}>
            <CheckCheck className="size-3.5 text-sky-500" /> {readers.length}
          </span>
        )}
      </div>

      <div
        className={`chat-bubble rounded-2xl flex flex-col relative !text-base-content ${
          isOwn ? "!bg-base-200" : "!bg-base-100 ring-1 ring-base-300/60 shadow-sm"
        } ${mentionsMe && !isDeleted ? "!ring-2 !ring-primary/50" : ""}`}
      >
        {isDeleted ? (
          <p className="italic opacity-60">This message was deleted</p>
        ) : editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input input-xs input-bordered text-base-content"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button onClick={submitEdit} className="text-xs underline">save</button>
            <button onClick={() => setEditing(false)}><X className="size-3.5" /></button>
          </div>
        ) : (
          <>
            {message.forwardedFrom && (
              <p className="text-xs italic opacity-60 mb-1 flex items-center gap-1">
                <Forward className="size-3" /> Forwarded
              </p>
            )}
            {message.replyTo && (
              <div className="mb-1 border-l-2 border-base-content/30 pl-2 text-xs opacity-70">
                {message.replyTo.deletedAt
                  ? "deleted message"
                  : message.replyTo.text || "📷 Photo"}
              </div>
            )}
            {message.image && (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                className="block mb-2"
                title="View image"
              >
                <img
                  src={message.image}
                  alt="Attachment"
                  className="sm:max-w-[200px] rounded-md cursor-zoom-in hover:opacity-95"
                />
              </button>
            )}
            {message.audio && (
              <audio controls src={message.audio} className="max-w-[220px] mb-1" />
            )}
            {message.file && (
              <a
                href={message.file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg bg-base-200/60 hover:bg-base-200 mb-1 max-w-[240px]"
              >
                <div className="size-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{message.file.name}</div>
                  <div className="text-xs opacity-60">{formatSize(message.file.size)}</div>
                </div>
                <Download className="size-4 opacity-60 shrink-0" />
              </a>
            )}
            {message.poll && (
              <div className="min-w-[220px] mb-1">
                <p className="font-medium mb-2">{message.poll.question}</p>
                {message.poll.options.map((o, i) => {
                  const total = message.poll.options.reduce((s, x) => s + x.votes.length, 0);
                  const mine = o.votes.some((v) => v === authUser._id);
                  const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
                  return (
                    <button
                      key={i}
                      onClick={() => votePoll(message._id, i)}
                      className="block w-full text-left mb-1.5 relative rounded-lg overflow-hidden border border-base-300/60"
                    >
                      <div className="absolute inset-0 bg-primary/15" style={{ width: `${pct}%` }} />
                      <div className="relative flex justify-between gap-2 px-2 py-1.5 text-sm">
                        <span className={mine ? "font-medium" : ""}>
                          {mine ? "● " : ""}
                          {o.text}
                        </span>
                        <span className="opacity-60">{o.votes.length}</span>
                      </div>
                    </button>
                  );
                })}
                <p className="text-xs opacity-50">
                  {message.poll.options.reduce((s, x) => s + x.votes.length, 0)} votes
                  {message.poll.multiple ? " · multiple choice" : ""}
                </p>
              </div>
            )}
            {message.location && (
              <a
                href={`https://www.google.com/maps?q=${message.location.lat},${message.location.lng}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg overflow-hidden border border-base-300/60 mb-1 max-w-[260px] hover:opacity-95"
              >
                <iframe
                  title="Shared location"
                  loading="lazy"
                  className="w-[260px] h-[140px] pointer-events-none block"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    message.location.lng - 0.01
                  }%2C${message.location.lat - 0.01}%2C${message.location.lng + 0.01}%2C${
                    message.location.lat + 0.01
                  }&layer=mapnik&marker=${message.location.lat}%2C${message.location.lng}`}
                />
                <div className="px-2 py-1.5 flex items-center gap-1.5 text-sm">
                  <MapPin className="size-4 text-primary shrink-0" />
                  <span className="truncate">{message.location.label || "Shared location"}</span>
                </div>
              </a>
            )}
            {message.contact && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200/60 mb-1 min-w-[200px] max-w-[260px]">
                <Avatar
                  user={{ profilePic: message.contact.avatar, fullName: message.contact.name }}
                  size="size-10"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{message.contact.name}</div>
                  {message.contact.username && (
                    <div className="text-xs opacity-60 truncate">@{message.contact.username}</div>
                  )}
                </div>
                {message.contact.userId && message.contact.userId !== authUser._id && (
                  <button
                    onClick={() => openContactChat(message.contact)}
                    className="btn btn-xs btn-primary gap-1"
                    title="Message"
                  >
                    <MessageSquare className="size-3" />
                  </button>
                )}
              </div>
            )}
            {message.text && <p>{renderText(message.text)}</p>}
            {message.linkPreview && (
              <a
                href={message.linkPreview.url}
                target="_blank"
                rel="noreferrer"
                className="block mt-1 rounded-lg overflow-hidden border border-base-300/60 max-w-[260px] hover:bg-base-200/50"
              >
                {message.linkPreview.image && (
                  <img src={message.linkPreview.image} alt="" className="w-full h-28 object-cover" />
                )}
                <div className="p-2">
                  {message.linkPreview.title && (
                    <div className="text-sm font-medium line-clamp-1">{message.linkPreview.title}</div>
                  )}
                  {message.linkPreview.description && (
                    <div className="text-xs opacity-60 line-clamp-2">{message.linkPreview.description}</div>
                  )}
                </div>
              </a>
            )}
          </>
        )}

        {/* hover actions */}
        {!isDeleted && !editing && (
          <div
            className={`absolute -top-3 ${isOwn ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"}
              opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}
          >
            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setShowPicker((v) => !v)} title="React">
              <SmilePlus className="size-4" />
            </button>
            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setReplyingTo(message)} title="Reply">
              <Reply className="size-4" />
            </button>
            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setForwarding(message)} title="Forward">
              <Forward className="size-4" />
            </button>
            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => pinMessage(message._id)} title={message.pinnedAt ? "Unpin" : "Pin"}>
              <Pin className={`size-4 ${message.pinnedAt ? "text-amber-500" : ""}`} />
            </button>
            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => starMessage(message._id)} title={starredByMe ? "Unstar" : "Star"}>
              <Star className={`size-4 ${starredByMe ? "text-amber-400 fill-amber-400" : ""}`} />
            </button>
            {!isOwn && (
              <button className="btn btn-ghost btn-xs btn-circle" onClick={report} title="Report">
                <Flag className="size-4" />
              </button>
            )}
            {canModify && (
              <>
                <button className="btn btn-ghost btn-xs btn-circle" onClick={() => { setEditText(message.text || ""); setEditing(true); }} title="Edit">
                  <Pencil className="size-4" />
                </button>
                <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => deleteMessage(message._id)} title="Delete">
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        )}

        {/* emoji picker */}
        {showPicker && (
          <div className="absolute -bottom-9 z-10 flex gap-1 bg-base-100 border border-base-300 rounded-full px-2 py-1 shadow">
            {EMOJIS.map((e) => (
              <button key={e} className="hover:scale-125 transition-transform" onClick={() => react(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* reaction chips */}
      {Object.keys(reactionCounts).length > 0 && (
        <div className="chat-footer flex gap-1 mt-1">
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              className="text-xs bg-base-200 hover:bg-base-300 rounded-full px-2 py-0.5"
            >
              {emoji} {count}
            </button>
          ))}
        </div>
      )}

      {zoomed && <Lightbox src={message.image} onClose={() => setZoomed(false)} />}
    </div>
  );
};

export default memo(MessageBubble);
