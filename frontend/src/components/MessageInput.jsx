import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useDraftStore } from "../store/useDraftStore";
import { usePrefsStore } from "../store/usePrefsStore";
import { Image, Send, X, Reply, Mic, Pause, Play, Trash2, Paperclip, BarChart3, FileText, Clock, Plus, MapPin, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import PollModal from "./PollModal";
import ScheduleModal from "./ScheduleModal";
import ContactPickerModal from "./ContactPickerModal";

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showPoll, setShowPoll] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const canceledRef = useRef(false);
  const timerRef = useRef(null);
  const { sendMessage, emitTyping, emitRecording, selectedUser, replyingTo, setReplyingTo } =
    useChatStore();
  const { authUser } = useAuthStore();
  const { getDraft, setDraft, clearDraft } = useDraftStore();
  const { enterToSend } = usePrefsStore();
  const chatId = selectedUser?._id;

  // grow the textarea with its content, capped at ~6 lines
  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  // load this chat's saved draft when switching conversations
  useEffect(() => {
    setText(getDraft(chatId));
  }, [chatId, getDraft]);

  // keep the textarea height in sync with its content (draft load, send-clear, etc.)
  useEffect(() => {
    autoGrow(textareaRef.current);
  }, [text, chatId]);

  // DMs can be blocked; groups can't
  const isBlocked =
    !selectedUser?.isGroup && authUser?.blockedUsers?.some((id) => id === selectedUser?._id);

  // in an admins-only group, non-admins can't post
  const isGroupAdmin = (selectedUser?.admins || []).some(
    (id) => (id?._id || id) === authUser?._id
  );
  const adminsOnlyLocked =
    selectedUser?.isGroup && selectedUser?.onlyAdminsCanMessage && !isGroupAdmin;

  const startTimer = () => {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      canceledRef.current = false;
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        if (!canceledRef.current && chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => sendMessage({ audio: reader.result, replyTo: replyingTo?._id });
          reader.readAsDataURL(blob);
        }
        setSeconds(0);
        setPaused(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      startTimer();
      emitRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const togglePause = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (mr.state === "recording") {
      mr.pause();
      setPaused(true);
      stopTimer();
    } else if (mr.state === "paused") {
      mr.resume();
      setPaused(false);
      startTimer();
    }
  };

  const finishRecording = () => {
    canceledRef.current = false;
    mediaRecorderRef.current?.stop();
    setRecording(false);
    emitRecording(false);
  };

  const cancelRecording = () => {
    canceledRef.current = true;
    mediaRecorderRef.current?.stop();
    setRecording(false);
    emitRecording(false);
  };

  // emit "typing" on keystroke, auto-clear after a short idle gap
  const handleTextChange = (e) => {
    setText(e.target.value);
    autoGrow(e.target);
    setDraft(chatId, e.target.value); // persist unsent text per chat
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1500);
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTyping(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDocChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () =>
      setFilePreview({ data: reader.result, name: file.name, size: file.size, type: file.type });
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview && !filePreview) return;
    try {
      stopTyping();
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
        file: filePreview,
        replyTo: replyingTo?._id,
      });
      setText("");
      clearDraft(chatId);
      setImagePreview(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Enter sends; Shift+Enter inserts a newline (ignored mid-IME-composition)
  const onComposerKeyDown = (e) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    // enterToSend: Enter sends, Shift+Enter = newline.
    // off: Enter = newline, Ctrl/Cmd+Enter sends.
    const send = enterToSend ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (send) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // clear the composer after a message has been queued for later delivery
  const afterScheduled = () => {
    setText("");
    clearDraft(chatId);
    setImagePreview(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const openSchedule = () => {
    if (!text.trim() && !imagePreview && !filePreview) {
      toast.error("Write a message to schedule first");
      return;
    }
    setShowSchedule(true);
  };

  // share the device's current location as a map message
  const shareLocation = () => {
    document.activeElement?.blur(); // close the attach menu
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't supported on this device");
      return;
    }
    const id = toast.loading("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        toast.dismiss(id);
        await sendMessage({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      },
      () => {
        toast.dismiss(id);
        toast.error("Couldn't get your location. Check permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const shareContact = async (u) => {
    setShowContact(false);
    await sendMessage({
      contact: { userId: u._id, name: u.fullName, username: u.username, avatar: u.profilePic },
    });
  };

  if (isBlocked) {
    return (
      <div className="p-4 w-full text-center text-sm text-base-content/60">
        You blocked this user. Unblock them from the chat header to send messages.
      </div>
    );
  }

  if (adminsOnlyLocked) {
    return (
      <div className="p-4 w-full text-center text-sm text-base-content/60">
        Only admins can send messages in this group.
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 w-full border-t border-base-300/60 bg-base-100">
      {replyingTo && !recording && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-base-200 px-3 py-2">
          <Reply className="size-4 shrink-0 opacity-60" />
          <div className="flex-1 min-w-0">
            <p className="text-xs opacity-60">Replying to</p>
            <p className="text-sm truncate">{replyingTo.text || "📷 Photo"}</p>
          </div>
          <button type="button" onClick={() => setReplyingTo(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {imagePreview && !recording && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {filePreview && !recording && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-base-200 px-3 py-2 max-w-xs">
          <FileText className="size-5 text-primary shrink-0" />
          <span className="text-sm truncate flex-1">{filePreview.name}</span>
          <button type="button" onClick={() => setFilePreview(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-2 rounded-lg bg-base-200 px-3 py-2">
          <span className={`size-2.5 rounded-full bg-red-500 ${paused ? "" : "animate-pulse"}`} />
          <span className="text-sm tabular-nums">{fmt(seconds)}</span>
          <span className="text-sm opacity-60">{paused ? "Paused" : "Recording…"}</span>
          <div className="flex-1" />
          <button type="button" onClick={cancelRecording} className="btn btn-ghost btn-sm btn-circle" title="Cancel">
            <Trash2 className="size-4" />
          </button>
          <button type="button" onClick={togglePause} className="btn btn-ghost btn-sm btn-circle" title={paused ? "Resume" : "Pause"}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
          <button type="button" onClick={finishRecording} className="btn btn-primary btn-sm btn-circle" title="Send">
            <Send size={20} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 flex items-end gap-1 bg-base-200/70 rounded-2xl pl-4 pr-1.5 py-1 ring-1 ring-base-300/50 focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
            <textarea
              ref={textareaRef}
              rows={1}
              aria-label="Message"
              className="flex-1 bg-transparent outline-none text-base py-2.5 min-w-0 resize-none leading-6 max-h-[160px] overflow-y-auto"
              placeholder="Type a message…"
              value={text}
              onChange={handleTextChange}
              onKeyDown={onComposerKeyDown}
              onBlur={stopTyping}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />
            <input type="file" className="hidden" ref={docInputRef} onChange={handleDocChange} />

            <div className="dropdown dropdown-top">
              <button
                type="button"
                tabIndex={0}
                className="btn btn-ghost btn-sm btn-circle text-base-content/50"
                title="Attach"
              >
                <Plus size={20} />
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box shadow w-44 mb-2 z-50"
              >
                <li>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    <Image className="size-4" /> Photo
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => docInputRef.current?.click()}>
                    <Paperclip className="size-4" /> Document
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setShowPoll(true)}>
                    <BarChart3 className="size-4" /> Poll
                  </button>
                </li>
                <li>
                  <button type="button" onClick={shareLocation}>
                    <MapPin className="size-4" /> Location
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setShowContact(true)}>
                    <UserRound className="size-4" /> Contact
                  </button>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle text-base-content/50"
              onClick={openSchedule}
              title="Schedule message"
            >
              <Clock size={20} />
            </button>
            <button
              type="button"
              onClick={startRecording}
              className="btn btn-ghost btn-sm btn-circle text-base-content/50"
              title="Record voice note"
            >
              <Mic size={20} />
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-circle"
            disabled={!text.trim() && !imagePreview && !filePreview}
          >
            <Send size={22} />
          </button>
        </form>
      )}

      {showPoll && <PollModal onClose={() => setShowPoll(false)} />}
      {showSchedule && (
        <ScheduleModal
          text={text.trim()}
          image={imagePreview}
          file={filePreview}
          onClose={() => setShowSchedule(false)}
          onScheduled={afterScheduled}
        />
      )}
      {showContact && (
        <ContactPickerModal onClose={() => setShowContact(false)} onPick={shareContact} />
      )}
    </div>
  );
};
export default MessageInput;
