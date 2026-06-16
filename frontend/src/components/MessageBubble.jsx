import { useState } from "react";
import { Check, CheckCheck, Pencil, Trash2, SmilePlus, X, Reply, Forward, Pin, Flag, Star } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { formatMessageTime } from "../lib/utils";
import Avatar from "./Avatar";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// highlight @mentions inside message text
const renderText = (text) =>
  text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-sky-400 font-medium">{part}</span>
    ) : (
      part
    )
  );

const MessageBubble = ({ message, isOwn, authUser, selectedUser, users }) => {
  const { editMessage, deleteMessage, reactToMessage, setReplyingTo, setForwarding, pinMessage, reportMessage, starMessage } =
    useChatStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [showPicker, setShowPicker] = useState(false);

  const isDeleted = Boolean(message.deletedAt);
  const mentionsMe = (message.mentions || []).some((id) => id === authUser._id);
  const starredByMe = (message.starredBy || []).some((id) => id === authUser._id);
  // edit/delete only within 10 minutes of sending
  const canModify = isOwn && Date.now() - new Date(message.createdAt).getTime() < 10 * 60 * 1000;
  const isGroup = selectedUser.isGroup;
  // in a group, the other messages can be from any member
  const sender = isGroup && !isOwn ? (users || []).find((u) => u._id === message.senderId) : null;
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

  // group reactions by emoji → { "👍": 2, ... }
  const grouped = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`chat ${isOwn ? "chat-end" : "chat-start"} group`}>
      <div className="chat-image">
        <Avatar
          src={avatar}
          name={isOwn ? authUser.fullName : isGroup ? sender?.fullName : selectedUser.fullName}
          user={isOwn ? authUser : isGroup ? sender : selectedUser}
          size="size-10"
        />
      </div>

      <div className="chat-header mb-1 flex items-center gap-1">
        {isGroup && !isOwn && (
          <span className="text-xs font-medium opacity-70">{sender?.fullName || "Member"}</span>
        )}
        {starredByMe && !isDeleted && <Star className="size-3 text-amber-400 fill-amber-400" title="Starred" />}
        {message.pinnedAt && !isDeleted && <Pin className="size-3 text-amber-500" title="Pinned" />}
        <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
        {message.editedAt && !isDeleted && <span className="text-xs opacity-40">(edited)</span>}
        {isOwn &&
          !isDeleted &&
          (message.readAt ? (
            <CheckCheck className="size-3.5 text-sky-500" title="Seen" />
          ) : message.deliveredAt ? (
            <CheckCheck className="size-3.5 opacity-50" title="Delivered" />
          ) : (
            <Check className="size-3.5 opacity-50" title="Sent" />
          ))}
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
              <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" />
            )}
            {message.audio && (
              <audio controls src={message.audio} className="max-w-[220px] mb-1" />
            )}
            {message.text && <p>{renderText(message.text)}</p>}
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
      {Object.keys(grouped).length > 0 && (
        <div className="chat-footer flex gap-1 mt-1">
          {Object.entries(grouped).map(([emoji, count]) => (
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
    </div>
  );
};

export default MessageBubble;
