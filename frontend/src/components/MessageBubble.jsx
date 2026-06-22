import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { Check, CheckCheck, Clock, AlertCircle, Pencil, Trash2, X, Reply, Forward, Pin, Flag, Star, FileText, Download, MapPin, MessageSquare, MoreVertical, Copy, Video, PhoneOutgoing, PhoneIncoming, PhoneMissed, Timer, Eye, EyeOff, Ghost, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import { formatMessageTime } from "../lib/utils";
import Avatar from "./Avatar";
import Lightbox from "./Lightbox";
import VoiceNote from "./VoiceNote";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// one row in the message action sheet (icon passed as an element to keep it simple)
const ActionItem = ({ icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
      danger ? "text-error hover:bg-error/10" : "hover:bg-base-200"
    }`}
  >
    {icon} {label}
  </button>
);

const MenuDivider = () => <div className="h-px bg-base-300/60 mx-2 my-1" />;

const formatSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const fmtDuration = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

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
    pinMessage, reportMessage, starMessage, votePoll, setSelectedUser, openViewOnce,
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
      openViewOnce: s.openViewOnce,
    }))
  );
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [revealOriginal, setRevealOriginal] = useState(false);
  const pressTimer = useRef(null);
  const longPressFired = useRef(false);

  const isDeleted = Boolean(message.deletedAt);
  const mentionsMe = (message.mentions || []).some((id) => id === authUser._id);
  const starredByMe = (message.starredBy || []).some((id) => id === authUser._id);

  // view-once state — content is never inlined; it only opens in the secure viewer
  const isViewOnce = Boolean(message.viewOnce);
  const voConsumed = !isOwn && Boolean(message.viewOnceConsumed); // recipient already opened it
  const voOpened = isOwn && (Boolean(message.viewOnceOpened) || (message.viewedBy || []).length > 0);
  const voKind = message.viewOnceKind || (message.image ? "photo" : message.audio ? "voice" : message.file ? "file" : "text");
  const voLabel = voKind === "photo" ? "Photo" : voKind === "voice" ? "Voice note" : voKind === "file" ? "File" : "Message";
  // recipient can tap to open exactly once; sender / consumed are static
  const voTappable = isViewOnce && !isOwn && !voConsumed;
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
    setMenuOpen(false);
  };
  const closeMenu = () => setMenuOpen(false);

  // long-press (mobile) / right-click (desktop) opens the action sheet
  const startPress = () => {
    if (isDeleted || editing) return;
    longPressFired.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen(true);
    }, 450);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);
  // swallow the click that fires right after a long-press (so it doesn't also
  // open the image/poll/etc.)
  const onBubbleClickCapture = (e) => {
    if (longPressFired.current) {
      e.stopPropagation();
      e.preventDefault();
      longPressFired.current = false;
    }
  };
  const copyText = () => {
    if (message.text) {
      navigator.clipboard?.writeText(message.text);
      toast.success("Copied");
    }
    closeMenu();
  };

  // open a DM with a shared contact
  const openContactChat = (c) =>
    setSelectedUser({ _id: c.userId, fullName: c.name, username: c.username, profilePic: c.avatar });

  // group reactions by emoji → { "👍": 2, ... }
  const reactionCounts = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  // system notices (e.g. disappearing messages toggled) — centered in timeline
  if (message.system) {
    const on = message.system.on;
    return (
      <div className="flex justify-center my-3">
        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs bg-base-200 text-base-content/70">
          <Timer className="size-3.5 shrink-0" />
          <span>Disappearing messages were turned {on ? "on" : "off"}.</span>
          <span className="opacity-60">· {formatMessageTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  // call events render as a centered system message in the timeline
  if (message.call) {
    const c = message.call;
    const missed = c.status === "missed";
    const rejected = c.status === "rejected";
    const danger = !c.group && (missed || rejected);
    const Icon = c.group ? Users : c.type === "video" ? Video : danger ? PhoneMissed : isOwn ? PhoneOutgoing : PhoneIncoming;
    const label = c.group
      ? isOwn ? "You started a group call" : "Group call"
      : rejected
        ? isOwn ? "Call declined" : "You declined the call"
        : missed
          ? isOwn ? "No answer" : "Missed call"
          : isOwn ? "Outgoing call" : "Incoming call";
    const dur = !danger && !c.group && c.durationSec ? ` · ${fmtDuration(c.durationSec)}` : "";
    return (
      <div className="flex justify-center my-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs ${
            danger ? "bg-error/10 text-error" : "bg-base-200 text-base-content/70"
          }`}
        >
          <Icon className="size-3.5 shrink-0" />
          <span>
            {c.type === "video" ? "Video · " : ""}
            {label}
            {dur}
          </span>
          <span className="opacity-60">· {formatMessageTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat ${isOwn ? "chat-end" : "chat-start"} group`}>
      <div className="chat-image">
        {grouped ? (
          <div className="size-11" aria-hidden />
        ) : (
          <Avatar
            src={avatar}
            name={isOwn ? authUser.fullName : isGroup ? sender?.fullName : selectedUser.fullName}
            user={isOwn ? authUser : isGroup ? sender : selectedUser}
            size="size-11"
          />
        )}
      </div>

      {!grouped && (isGroup && !isOwn ? true : starredByMe || message.pinnedAt) && (
        <div className="chat-header mb-1 flex items-center gap-1">
          {isGroup && !isOwn && (
            <span className="text-xs font-medium opacity-70">{sender?.fullName || "Member"}</span>
          )}
          {starredByMe && !isDeleted && <Star className="size-3 text-amber-400 fill-amber-400" title="Starred" />}
          {message.pinnedAt && !isDeleted && <Pin className="size-3 text-amber-500" title="Pinned" />}
        </div>
      )}

      <div
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onClickCapture={onBubbleClickCapture}
        onContextMenu={(e) => {
          if (isDeleted || editing) return;
          e.preventDefault();
          setMenuOpen(true);
        }}
        className={`chat-bubble rounded-2xl flex flex-col relative ${
          isOwn
            ? "!bg-primary !text-primary-content rounded-br-md shadow-sm"
            : "!bg-base-100 !text-base-content ring-1 ring-base-300/70 rounded-bl-md shadow-card"
        } ${mentionsMe && !isDeleted ? "!ring-2 !ring-primary/50" : ""}`}
      >
        {isDeleted ? (
          message.antiDelete && message.original ? (
            revealOriginal ? (
              <div>
                {message.original.image && (
                  <img src={message.original.image} alt="" className="rounded-lg max-w-[260px] mb-1" />
                )}
                {message.original.text && (
                  <p className="whitespace-pre-wrap break-words">{message.original.text}</p>
                )}
                <p className="text-[11px] italic opacity-60 mt-1 flex items-center gap-1">
                  <Ghost className="size-3" /> recovered — was deleted
                </p>
              </div>
            ) : (
              <button
                onClick={() => setRevealOriginal(true)}
                className="flex items-center gap-1.5 text-sm italic opacity-70 hover:opacity-100"
              >
                <EyeOff className="size-3.5 shrink-0" /> Message deleted ·{" "}
                <span className="underline not-italic">View original</span>
              </button>
            )
          ) : (
            <p className="italic opacity-60">This message was deleted</p>
          )
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
        ) : isViewOnce ? (
          <button
            type="button"
            onClick={voTappable ? () => openViewOnce(message._id) : undefined}
            disabled={!voTappable}
            className={`flex items-center gap-2.5 text-sm py-1 pr-1 rounded-lg ${
              voTappable ? "cursor-pointer" : "cursor-default opacity-80"
            }`}
          >
            <span
              className={`size-9 rounded-full grid place-items-center shrink-0 ${
                isOwn ? "bg-primary-content/20 text-primary-content" : "bg-primary/15 text-primary"
              }`}
            >
              {voConsumed || voOpened ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </span>
            <span className="text-left leading-tight">
              <span className="font-semibold flex items-center gap-1">
                View once
                <span className="text-[10px] font-medium uppercase tracking-wide opacity-60">· {voLabel}</span>
              </span>
              <span className="block text-xs opacity-70">
                {voConsumed
                  ? "Opened"
                  : isOwn
                    ? voOpened
                      ? "Opened"
                      : "Sent · disappears after viewing"
                    : "Tap to view · disappears after"}
              </span>
            </span>
          </button>
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
                  className="sm:max-w-[340px] rounded-md cursor-zoom-in hover:opacity-95"
                />
              </button>
            )}
            {message.audio && (
              <div className="mb-1">
                <VoiceNote src={message.audio} seed={message._id} own={isOwn} />
              </div>
            )}
            {message.file && (
              <a
                href={message.file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg bg-base-200/60 hover:bg-base-200 mb-1 max-w-[320px]"
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
              <div className="min-w-[260px] mb-1">
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
                className="block rounded-lg overflow-hidden border border-base-300/60 mb-1 max-w-[340px] hover:opacity-95"
              >
                <iframe
                  title="Shared location"
                  loading="lazy"
                  className="w-[300px] h-[180px] pointer-events-none block"
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
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200/60 mb-1 min-w-[240px] max-w-[340px]">
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
                className="block mt-1 rounded-lg overflow-hidden border border-base-300/60 max-w-[340px] hover:bg-base-200/50"
              >
                {message.linkPreview.image && (
                  <img src={message.linkPreview.image} alt="" className="w-full h-40 object-cover" />
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

        {/* footer: time + status + the ⋮ actions trigger, on the message's side */}
        {!isDeleted && !editing && (
          <div className={`flex items-center gap-1 mt-1 -mb-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
            {!isOwn && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                aria-label="Message actions"
                title="Message actions"
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="size-4" />
              </button>
            )}
            <span className="text-[11px] opacity-60 flex items-center gap-1 whitespace-nowrap leading-none">
              <time>{formatMessageTime(message.createdAt)}</time>
              {message.editedAt && <span>· edited</span>}
              {isOwn && message.pending && <Clock className="size-3 animate-pulse" title="Sending…" />}
              {isOwn && message.failed && (
                <span className="text-error inline-flex items-center gap-0.5" title="Failed to send">
                  <AlertCircle className="size-3" /> Failed
                </span>
              )}
              {isOwn && !isGroup && !message.pending && !message.failed &&
                (message.readAt ? (
                  <CheckCheck className="size-3.5 text-sky-500" title="Seen" />
                ) : message.deliveredAt ? (
                  <CheckCheck className="size-3.5" title="Delivered" />
                ) : (
                  <Check className="size-3.5" title="Sent" />
                ))}
              {isOwn && isGroup && !message.pending && readers.length > 0 && (
                <span className="inline-flex items-center gap-0.5" title={`Seen by ${readers.map(nameFor).join(", ")}`}>
                  <CheckCheck className="size-3.5 text-sky-500" /> {readers.length}
                </span>
              )}
            </span>
            {isOwn && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                aria-label="Message actions"
                title="Message actions"
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="size-4" />
              </button>
            )}
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

      {/* action sheet — opened by ⋮ (desktop) or long-press (mobile); portalled to
          <body> so it can't be clipped/trapped by any ancestor's stacking context */}
      {menuOpen && createPortal(
        <div
          className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
          onClick={closeMenu}
        >
          <div
            className="w-full sm:w-72 bg-base-100 rounded-t-2xl sm:rounded-2xl border border-base-300/60 shadow-pop overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-around px-2 py-3 border-b border-base-300/60">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => react(e)}
                  aria-label={`React ${e}`}
                  className="text-2xl leading-none hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="p-1.5">
              {/* share / respond */}
              <ActionItem
                icon={<Reply className="size-4 opacity-80" />}
                label="Reply"
                onClick={() => { setReplyingTo(message); closeMenu(); }}
              />
              <ActionItem
                icon={<Forward className="size-4 opacity-80" />}
                label="Forward"
                onClick={() => { setForwarding(message); closeMenu(); }}
              />
              {message.text && (
                <ActionItem icon={<Copy className="size-4 opacity-80" />} label="Copy" onClick={copyText} />
              )}

              {/* organize / edit */}
              <MenuDivider />
              <ActionItem
                icon={<Pin className={`size-4 ${message.pinnedAt ? "text-amber-500" : "opacity-80"}`} />}
                label={message.pinnedAt ? "Unpin" : "Pin"}
                onClick={() => { pinMessage(message._id); closeMenu(); }}
              />
              <ActionItem
                icon={<Star className={`size-4 ${starredByMe ? "text-amber-400 fill-amber-400" : "opacity-80"}`} />}
                label={starredByMe ? "Unstar" : "Star"}
                onClick={() => { starMessage(message._id); closeMenu(); }}
              />
              {canModify && message.text && (
                <ActionItem
                  icon={<Pencil className="size-4 opacity-80" />}
                  label="Edit"
                  onClick={() => { setEditText(message.text || ""); setEditing(true); closeMenu(); }}
                />
              )}

              {/* destructive */}
              {(!isOwn || canModify) && <MenuDivider />}
              {!isOwn && (
                <ActionItem
                  icon={<Flag className="size-4" />}
                  label="Report"
                  danger
                  onClick={() => { report(); closeMenu(); }}
                />
              )}
              {canModify && (
                <ActionItem
                  icon={<Trash2 className="size-4" />}
                  label="Delete"
                  danger
                  onClick={() => { deleteMessage(message._id); closeMenu(); }}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {zoomed && <Lightbox src={message.image} onClose={() => setZoomed(false)} />}
    </div>
  );
};

export default memo(MessageBubble);
