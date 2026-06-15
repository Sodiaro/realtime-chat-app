// One-off, idempotent migration: give every existing message a conversationId
// and create/link the Conversation docs. Safe to re-run.
//   npm run backfill
import mongoose from "mongoose";
import { env } from "../lib/env.js";
import Message from "../models/message.model.js";
import Conversation, { directKey, getOrCreateDirect } from "../models/conversation.model.js";

await mongoose.connect(env.MONGODB_URI);
console.log("connected; backfilling messages without conversationId...");

const cache = new Map<string, mongoose.Types.ObjectId>();
let migrated = 0;

const cursor = Message.find({ conversationId: { $exists: false } }).cursor();
for await (const msg of cursor) {
  const key = directKey(String(msg.senderId), String(msg.receiverId));
  let convId = cache.get(key);
  if (!convId) {
    const conv = await getOrCreateDirect(msg.senderId, msg.receiverId);
    convId = conv._id;
    cache.set(key, convId);
  }
  msg.conversationId = convId;
  await msg.save();
  migrated++;
}

// set each touched conversation's last message
for (const convId of cache.values()) {
  const last = await Message.findOne({ conversationId: convId }).sort({ createdAt: -1 });
  if (last) {
    await Conversation.updateOne(
      { _id: convId },
      { $set: { lastMessage: last._id, lastMessageAt: last.createdAt } }
    );
  }
}

console.log(`done. messages migrated: ${migrated} | conversations touched: ${cache.size}`);
await mongoose.connection.close();
process.exit(0);
