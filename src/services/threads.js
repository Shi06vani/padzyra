const { Thread, ThreadReply, Subscription } = require('../models');

// Initial seed threads for rich community experience if DB is fresh
const INITIAL_SEED_THREADS = [
  {
    id: 'seed-thread-1',
    authorName: 'Cozy Butterfly 🦋',
    isAnonymous: true,
    content: 'Day 2 cramps are no joke today 😭 Hot water bottle + peppermint tea is literally keeping me alive right now. Sending warmth to all my sisters going through it today! ☕❤️',
    tag: 'cramps',
    feeling: '😣 Cramping Hard',
    likesCount: 24,
    hugsCount: 18,
    repliesCount: 3,
    isVip: false,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    replies: [
      {
        id: 'reply-1',
        authorName: 'Lavender Girl 🌸',
        content: 'Stay cozy girl! Adding a dash of ginger powder in warm water helps me so much.',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'reply-2',
        authorName: 'Warm Blanket ☕',
        content: 'Also try the child pose stretch for 5 mins, it eases lower back cramps instantly!',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'seed-thread-2',
    authorName: 'Choco Craver 🍫',
    isAnonymous: true,
    content: 'Anyone else get the most bizarre cravings during PMS? I just dipped potato chips in Nutella and it felt like Michelin star dining 🤤 No regrets whatsoever!',
    tag: 'cravings',
    feeling: '🍫 Craving Chocolate',
    likesCount: 42,
    hugsCount: 12,
    repliesCount: 5,
    isVip: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    replies: [
      {
        id: 'reply-3',
        authorName: 'Snack Queen 🥨',
        content: 'Omg sweet and salty combo is top tier during period week!! 😋',
        createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'seed-thread-3',
    authorName: 'Anonymous Sis 🌸',
    isAnonymous: true,
    content: 'PSA for all girls: Padzyra discreet emergency delivery literally saved me at college today. Reached in 12 mins in a completely discreet paper bag! Blessed to have this app.',
    tag: 'tips',
    feeling: '🧘 Sweet Relief',
    likesCount: 56,
    hugsCount: 30,
    repliesCount: 2,
    isVip: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    replies: [],
  },
  {
    id: 'seed-thread-4',
    authorName: 'Moonlight Flow 🌙',
    isAnonymous: true,
    content: 'Crying because a puppy in a reel didn’t get a treat... Yup, luteal phase emotional rollercoaster has officially begun 😭 Love to everyone whose emotions feel heightened this week.',
    tag: 'mood',
    feeling: '😭 Emotional Day',
    likesCount: 38,
    hugsCount: 27,
    repliesCount: 4,
    isVip: false,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    replies: [],
  },
];

let inMemoryThreads = JSON.parse(JSON.stringify(INITIAL_SEED_THREADS));

async function listThreads({ tag, limit = 50, offset = 0 } = {}) {
  try {
    if (Thread) {
      const where = {};
      if (tag && tag !== 'all') {
        where.tag = tag;
      }
      const threads = await Thread.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: ThreadReply ? [{ model: ThreadReply, as: 'ThreadReplies' }] : [],
      });
      if (threads && threads.length > 0) {
        return threads.map((t) => formatThread(t));
      }
    }
  } catch (err) {
    // Fallback to in-memory
  }

  let list = inMemoryThreads;
  if (tag && tag !== 'all') {
    list = list.filter((t) => t.tag === tag);
  }
  return list.slice(offset, offset + limit);
}

function formatThread(t) {
  const plain = t.get ? t.get({ plain: true }) : t;
  return {
    id: plain.id,
    authorName: plain.authorName,
    isAnonymous: plain.isAnonymous,
    content: plain.content,
    tag: plain.tag,
    feeling: plain.feeling,
    likesCount: plain.likesCount || 0,
    hugsCount: plain.hugsCount || 0,
    repliesCount: plain.ThreadReplies ? plain.ThreadReplies.length : (plain.repliesCount || 0),
    isVip: Boolean(plain.isVip),
    createdAt: plain.createdAt,
    replies: plain.ThreadReplies || plain.replies || [],
  };
}

async function createThread(user, { content, authorName, isAnonymous = true, tag = 'general', feeling = '😣 Cramping' }) {
  if (!content || !content.trim()) {
    const err = new Error('Content is required');
    err.status = 400;
    throw err;
  }

  const name = authorName && authorName.trim()
    ? authorName.trim()
    : (isAnonymous ? 'Anonymous Sis 🌸' : (user?.email ? user.email.split('@')[0] : 'Sister 🌸'));

  // Check if user has active VIP subscription
  let isVip = false;
  try {
    if (user && Subscription) {
      const sub = await Subscription.findOne({
        where: { userId: user.id, status: 'active', planId: 'vip_250' },
      });
      if (sub && new Date(sub.expiresAt) > new Date()) {
        isVip = true;
      }
    }
  } catch {
    // ignore
  }

  try {
    if (Thread) {
      const newThread = await Thread.create({
        userId: user?.id,
        authorName: name,
        isAnonymous,
        content: content.trim(),
        tag,
        feeling,
        likesCount: 0,
        hugsCount: 0,
        repliesCount: 0,
        isVip,
      });
      return formatThread(newThread);
    }
  } catch (err) {
    // In-memory fallback
  }

  const memoryItem = {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorName: name,
    isAnonymous,
    content: content.trim(),
    tag,
    feeling,
    likesCount: 0,
    hugsCount: 0,
    repliesCount: 0,
    isVip,
    createdAt: new Date().toISOString(),
    replies: [],
  };
  inMemoryThreads.unshift(memoryItem);
  return memoryItem;
}

async function toggleLike(threadId) {
  try {
    if (Thread) {
      const item = await Thread.findByPk(threadId);
      if (item) {
        item.likesCount = (item.likesCount || 0) + 1;
        await item.save();
        return { likesCount: item.likesCount };
      }
    }
  } catch {
    // fallback
  }

  const found = inMemoryThreads.find((t) => t.id === threadId);
  if (found) {
    found.likesCount = (found.likesCount || 0) + 1;
    return { likesCount: found.likesCount };
  }
  return { likesCount: 1 };
}

async function addHug(threadId) {
  try {
    if (Thread) {
      const item = await Thread.findByPk(threadId);
      if (item) {
        item.hugsCount = (item.hugsCount || 0) + 1;
        await item.save();
        return { hugsCount: item.hugsCount };
      }
    }
  } catch {
    // fallback
  }

  const found = inMemoryThreads.find((t) => t.id === threadId);
  if (found) {
    found.hugsCount = (found.hugsCount || 0) + 1;
    return { hugsCount: found.hugsCount };
  }
  return { hugsCount: 1 };
}

async function listReplies(threadId) {
  try {
    if (ThreadReply) {
      const replies = await ThreadReply.findAll({
        where: { threadId },
        order: [['createdAt', 'ASC']],
      });
      if (replies && replies.length > 0) {
        return replies;
      }
    }
  } catch {
    // fallback
  }

  const found = inMemoryThreads.find((t) => t.id === threadId);
  return found ? (found.replies || []) : [];
}

async function addReply(threadId, user, { content, authorName, isAnonymous = true }) {
  if (!content || !content.trim()) {
    const err = new Error('Reply content is required');
    err.status = 400;
    throw err;
  }

  const name = authorName && authorName.trim()
    ? authorName.trim()
    : (isAnonymous ? 'Sister 🌸' : (user?.email ? user.email.split('@')[0] : 'Sister 🌸'));

  try {
    if (ThreadReply && Thread) {
      const reply = await ThreadReply.create({
        threadId,
        userId: user?.id,
        authorName: name,
        isAnonymous,
        content: content.trim(),
      });
      const t = await Thread.findByPk(threadId);
      if (t) {
        t.repliesCount = (t.repliesCount || 0) + 1;
        await t.save();
      }
      return reply;
    }
  } catch {
    // fallback
  }

  const found = inMemoryThreads.find((t) => t.id === threadId);
  const newReply = {
    id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorName: name,
    isAnonymous,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  if (found) {
    if (!found.replies) found.replies = [];
    found.replies.push(newReply);
    found.repliesCount = found.replies.length;
  }
  return newReply;
}

module.exports = {
  listThreads,
  createThread,
  toggleLike,
  addHug,
  listReplies,
  addReply,
};
