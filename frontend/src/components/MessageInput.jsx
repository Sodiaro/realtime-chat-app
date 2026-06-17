import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Reply, Mic, Pause, Play, Trash2, Paperclip, BarChart3, FileText } from "lucide-react";
import toast from "react-hot-toast";
import PollModal from "./PollModal";

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showPoll, setShowPoll] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const canceledRef = useRef(false);
  const timerRef = useRef(null);
  const { sendMessage, emitTyping, emitRecording, selectedUser, replyingTo, setReplyingTo } =
    useChatStore();
  const { authUser } = useAuthStore();

  // DMs can be blocked; groups can't
  const isBlocked =
    !selectedUser?.isGroup && authUser?.blockedUsers?.some((id) => id === selectedUser?._id);

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
      setImagePreview(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  if (isBlocked) {
    return (
      <div className="p-4 w-full text-center text-sm text-base-content/60">
        You blocked this user. Unblock them from the chat header to send messages.
      </div>
    );
  }

  return (
    <div className="p-4 w-full">
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
            <Send size={18} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1 bg-base-200 rounded-full pl-4 pr-1.5 py-1">
            <input
              type="text"
              className="flex-1 bg-transparent outline-none text-sm py-2 min-w-0"
              placeholder="Write your message…"
              value={text}
              onChange={handleTextChange}
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
            <button
              type="button"
              className={`btn btn-ghost btn-sm btn-circle ${imagePreview ? "text-primary" : "text-base-content/50"}`}
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
            >
              <Image size={18} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle text-base-content/50"
              onClick={() => docInputRef.current?.click()}
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle text-base-content/50"
              onClick={() => setShowPoll(true)}
              title="Create poll"
            >
              <BarChart3 size={18} />
            </button>
            <button
              type="button"
              onClick={startRecording}
              className="btn btn-ghost btn-sm btn-circle text-base-content/50"
              title="Record voice note"
            >
              <Mic size={18} />
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-circle"
            disabled={!text.trim() && !imagePreview && !filePreview}
          >
            <Send size={20} />
          </button>
        </form>
      )}

      {showPoll && <PollModal onClose={() => setShowPoll(false)} />}
    </div>
  );
};
export default MessageInput;
