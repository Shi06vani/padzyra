import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { PadzyraApi } from '../api/client';
import { SubscriptionModal } from '../components/SubscriptionModal';

interface ThreadReply {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface Thread {
  id: string;
  authorName: string;
  isAnonymous: boolean;
  content: string;
  tag: string;
  feeling?: string;
  likesCount: number;
  hugsCount: number;
  repliesCount: number;
  isVip?: boolean;
  createdAt: string;
  replies?: ThreadReply[];
}

const TOPIC_TAGS = [
  { id: 'all', label: 'All', icon: 'chatbubbles-outline' },
  { id: 'cramps', label: 'Cramps & Pain', icon: 'pulse-outline' },
  { id: 'cravings', label: 'Cravings & Food', icon: 'cafe-outline' },
  { id: 'mood', label: 'PMS & Mood', icon: 'sunny-outline' },
  { id: 'tips', label: 'Hacks & Tips', icon: 'bulb-outline' },
  { id: 'first_period', label: 'First Cycle', icon: 'heart-outline' },
  { id: 'rants', label: 'Flow Talk', icon: 'water-outline' },
];

const FEELING_OPTIONS = [
  'Cramping & Pelvic Tension',
  'Nutrition & Food Cravings',
  'Emotional / PMS Rollercoaster',
  'Low Energy & Fatigue',
  'Bloating & Water Retention',
  'Energized & Productive',
  'Comfort & Relief',
];

const PRESET_ALIASES = [
  'Care Companion',
  'Wellness Seeker',
  'Cycle Ally',
  'Mindful Peer',
  'Quiet Voice',
  'Supportive Member',
];

// Fallback seed threads if network is unavailable
const SEED_THREADS: Thread[] = [
  {
    id: 'seed-1',
    authorName: 'Care Companion',
    isAnonymous: true,
    content: 'Day 2 cramps are quite heavy today. A hot water bag plus warm chamomile tea is really helping soothe the spasms. Sending strength to anyone else navigating their cycle today!',
    tag: 'cramps',
    feeling: 'Cramping & Pelvic Tension',
    likesCount: 24,
    hugsCount: 18,
    repliesCount: 2,
    isVip: false,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    replies: [
      {
        id: 'r-1',
        authorName: 'Wellness Seeker',
        content: 'Stay warm and hydrated! A pinch of dried ginger in warm water works wonders for pelvic blood flow.',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'r-2',
        authorName: 'Mindful Peer',
        content: 'A gentle child pose stretch for 5 minutes also releases lower back and sacral tightness right away.',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'seed-2',
    authorName: 'Mindful Peer',
    isAnonymous: true,
    content: 'High magnesium dark chocolate (70%+) combined with roasted almonds completely stabilized my luteal phase cravings this afternoon. Highly recommend keeping a bar stocked in your pantry.',
    tag: 'cravings',
    feeling: 'Nutrition & Food Cravings',
    likesCount: 42,
    hugsCount: 12,
    repliesCount: 1,
    isVip: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    replies: [
      {
        id: 'r-3',
        authorName: 'Supportive Member',
        content: 'Dark cacao has real clinical backing for smooth muscle relaxation — excellent choice!',
        createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'seed-3',
    authorName: 'Cycle Ally',
    isAnonymous: true,
    content: 'Padzyra discreet emergency delivery arrived in under 15 minutes in an opaque sealed kraft bag today at my workplace. Truly thankful for the thoughtful packaging and discreet code handoff.',
    tag: 'tips',
    feeling: 'Comfort & Relief',
    likesCount: 56,
    hugsCount: 30,
    repliesCount: 0,
    isVip: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    replies: [],
  },
  {
    id: 'seed-4',
    authorName: 'Quiet Voice',
    isAnonymous: true,
    content: 'Luteal phase hormones definitely make sensitivity and empathy peak during days 24 to 28. Remember to give yourself grace and schedule restorative breaks today.',
    tag: 'mood',
    feeling: 'Emotional / PMS Rollercoaster',
    likesCount: 38,
    hugsCount: 27,
    repliesCount: 0,
    isVip: true,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    replies: [],
  },
];

export const ThreadsScreen: React.FC = () => {
  const [threads, setThreads] = useState<Thread[]>(SEED_THREADS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTag, setActiveTag] = useState<string>('all');

  // Composer Modal state
  const [showComposer, setShowComposer] = useState(false);
  const [thoughtText, setThoughtText] = useState('');
  const [selectedTag, setSelectedTag] = useState('cramps');
  const [selectedFeeling, setSelectedFeeling] = useState('😣 Cramping Hard');
  const [selectedAlias, setSelectedAlias] = useState(PRESET_ALIASES[0]);
  const [customAlias, setCustomAlias] = useState('');
  const [posting, setPosting] = useState(false);

  // Replies Modal state
  const [activeThreadForReplies, setActiveThreadForReplies] = useState<Thread | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Subscription Modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);

  // Local likes tracking
  const [likedThreadIds, setLikedThreadIds] = useState<Record<string, boolean>>({});
  const [huggedThreadIds, setHuggedThreadIds] = useState<Record<string, boolean>>({});

  const loadThreads = useCallback(async () => {
    try {
      const data = await PadzyraApi.getThreads(activeTag);
      if (Array.isArray(data) && data.length > 0) {
        setThreads(data);
      }
    } catch {
      // Keep seeded/in-memory data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTag]);

  const loadSubscription = useCallback(async () => {
    try {
      const sub = await PadzyraApi.getCurrentSubscription();
      if (sub && sub.active) {
        setUserSubscription(sub);
      }
    } catch {
      // Continue
    }
  }, []);

  useEffect(() => {
    loadThreads();
    loadSubscription();
  }, [loadThreads, loadSubscription]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadThreads();
  };

  const handlePostThought = async () => {
    if (!thoughtText.trim()) {
      Alert.alert('Empty Thought', 'Please write something before posting.');
      return;
    }

    setPosting(true);
    const authorName = customAlias.trim() || selectedAlias;

    try {
      const created = await PadzyraApi.createThread({
        content: thoughtText.trim(),
        authorName,
        isAnonymous: true,
        tag: selectedTag,
        feeling: selectedFeeling,
      });

      if (created) {
        setThreads((prev) => [created, ...prev]);
      }
    } catch {
      // Fallback local append
      const newLocalThread: Thread = {
        id: `local-${Date.now()}`,
        authorName,
        isAnonymous: true,
        content: thoughtText.trim(),
        tag: selectedTag,
        feeling: selectedFeeling,
        likesCount: 0,
        hugsCount: 0,
        repliesCount: 0,
        isVip: userSubscription?.active && userSubscription?.planId === 'vip_250',
        createdAt: new Date().toISOString(),
        replies: [],
      };
      setThreads((prev) => [newLocalThread, ...prev]);
    } finally {
      setPosting(false);
      setThoughtText('');
      setShowComposer(false);
    }
  };

  const handleLike = async (threadId: string) => {
    const isAlreadyLiked = likedThreadIds[threadId];
    setLikedThreadIds((prev) => ({ ...prev, [threadId]: !isAlreadyLiked }));

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === threadId) {
          const delta = isAlreadyLiked ? -1 : 1;
          return { ...t, likesCount: Math.max(0, t.likesCount + delta) };
        }
        return t;
      })
    );

    if (!isAlreadyLiked) {
      try {
        await PadzyraApi.likeThread(threadId);
      } catch {
        // Fallback
      }
    }
  };

  const handleHug = async (threadId: string) => {
    const isAlreadyHugged = huggedThreadIds[threadId];
    setHuggedThreadIds((prev) => ({ ...prev, [threadId]: !isAlreadyHugged }));

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === threadId) {
          const delta = isAlreadyHugged ? -1 : 1;
          return { ...t, hugsCount: Math.max(0, t.hugsCount + delta) };
        }
        return t;
      })
    );

    if (!isAlreadyHugged) {
      try {
        await PadzyraApi.hugThread(threadId);
      } catch {
        // Fallback
      }
    }
  };

  const handleShare = async (thread: Thread) => {
    try {
      await Share.share({
        message: `"${thread.content}" — ${thread.authorName} on Padzyra Community`,
      });
    } catch {
      // Ignore
    }
  };

  const handleOpenReplies = async (thread: Thread) => {
    setActiveThreadForReplies(thread);
    setReplyText('');
    try {
      const serverReplies = await PadzyraApi.getThreadReplies(thread.id);
      if (Array.isArray(serverReplies) && serverReplies.length > 0) {
        setActiveThreadForReplies((prev) =>
          prev ? { ...prev, replies: serverReplies, repliesCount: serverReplies.length } : null
        );
      }
    } catch {
      // Keep existing replies
    }
  };

  const handleSendReply = async () => {
    if (!activeThreadForReplies || !replyText.trim()) return;

    setSubmittingReply(true);
    const authorName = userSubscription?.active ? 'VIP Member' : 'Community Member';

    try {
      const reply = await PadzyraApi.replyThread(activeThreadForReplies.id, {
        content: replyText.trim(),
        authorName,
      });

      const newReply: ThreadReply = reply || {
        id: `reply-${Date.now()}`,
        authorName,
        content: replyText.trim(),
        createdAt: new Date().toISOString(),
      };

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadForReplies.id) {
            const currentReplies = t.replies || [];
            return {
              ...t,
              repliesCount: t.repliesCount + 1,
              replies: [...currentReplies, newReply],
            };
          }
          return t;
        })
      );

      setActiveThreadForReplies((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          repliesCount: prev.repliesCount + 1,
          replies: [...(prev.replies || []), newReply],
        };
      });

      setReplyText('');
    } catch {
      Alert.alert('Notice', 'Reply posted in safe mode.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return `${Math.floor(diffSec / 86400)}d`;
  };

  const filteredThreads =
    activeTag === 'all'
      ? threads
      : threads.filter((t) => t.tag === activeTag);

  return (
    <View style={styles.container}>
      {/* Clean Top Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.brandTitle}>Community</Text>
          <Text style={styles.brandSubtitle}>Anonymous sisterhood discussions</Text>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.newPostBtn}
            activeOpacity={0.85}
            onPress={() => setShowComposer(true)}
          >
            <Ionicons name="create-outline" size={16} color={colors.white} style={{ marginRight: 4 }} />
            <Text style={styles.newPostBtnText}>New Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Category Tags Filter */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {TOPIC_TAGS.map((tag) => {
            const isActive = activeTag === tag.id;
            return (
              <TouchableOpacity
                key={tag.id}
                onPress={() => setActiveTag(tag.id)}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              >
                <Ionicons
                  name={tag.icon as any}
                  size={14}
                  color={isActive ? colors.white : colors.plum}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                >
                  {tag.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Threads Timeline */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.pink} />
          <Text style={styles.loadingText}>Loading sisterhood thoughts...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.feedScroll}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.plum]}
            />
          }
        >
          {/* VIP Sisterhood Promotion Banner */}
          {!userSubscription?.active && (
            <TouchableOpacity
              style={styles.clubPromoBanner}
              activeOpacity={0.9}
              onPress={() => setShowSubscriptionModal(true)}
            >
              <View style={styles.clubPromoIconCircle}>
                <Ionicons name="sparkles" size={18} color={colors.white} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.promoHeaderRow}>
                  <Text style={styles.clubPromoTitle}>Unlock VIP Sisterhood & AI Coach</Text>
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>From ₹50/mo</Text>
                  </View>
                </View>
                <Text style={styles.clubPromoSub}>
                  Get 24/7 AI Gynec answers, doctor reports & golden community badge.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.plum} />
            </TouchableOpacity>
          )}

          {/* Quick thought share prompt */}
          <TouchableOpacity
            style={styles.quickShareCard}
            activeOpacity={0.85}
            onPress={() => setShowComposer(true)}
          >
            <View style={styles.quickShareAvatar}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.plum} />
            </View>
            <Text style={styles.quickSharePlaceholder}>
              How are you feeling this cycle? Share a thought...
            </Text>
            <Ionicons name="send" size={16} color={colors.plum} />
          </TouchableOpacity>

          {/* Thread Cards (Instagram Threads Aesthetic) */}
          {filteredThreads.map((thread) => {
            const isLiked = Boolean(likedThreadIds[thread.id]);
            const isHugged = Boolean(huggedThreadIds[thread.id]);

            return (
              <View key={thread.id} style={styles.threadCard}>
                {/* Left Column: Avatar + Connector line */}
                <View style={styles.threadLeftCol}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {(thread.authorName || 'M').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.connectorLine} />
                  {thread.repliesCount > 0 && (
                    <View style={styles.repliesMiniDot}>
                      <Text style={styles.repliesMiniCount}>{thread.repliesCount}</Text>
                    </View>
                  )}
                </View>

                {/* Right Column: Content + Actions */}
                <View style={styles.threadRightCol}>
                  {/* Author Header */}
                  <View style={styles.threadHeaderRow}>
                    <View style={styles.authorBadgeRow}>
                      <Text style={styles.authorName}>{thread.authorName}</Text>
                      {thread.isVip && (
                        <View style={styles.vipCrownBadge}>
                          <Ionicons name="star" size={10} color="#b37d00" />
                          <Text style={styles.vipCrownText}>VIP</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.headerMetaRow}>
                      <Text style={styles.timeAgo}>{formatTimeAgo(thread.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Feeling & Topic Badges */}
                  <View style={styles.badgesRow}>
                    {thread.feeling ? (
                      <View style={styles.feelingChip}>
                        <Text style={styles.feelingChipText}>{thread.feeling}</Text>
                      </View>
                    ) : null}
                    <View style={styles.topicChip}>
                      <Text style={styles.topicChipText}>#{thread.tag}</Text>
                    </View>
                  </View>

                  {/* Thread Content Text */}
                  <Text style={styles.threadContentText}>{thread.content}</Text>

                  {/* Action Bar (Heart, Reply, Hug, Share) */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => handleLike(thread.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isLiked ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isLiked ? '#e63946' : colors.rose}
                      />
                      <Text
                        style={[
                          styles.actionCounter,
                          isLiked && { color: '#e63946', fontWeight: '800' },
                        ]}
                      >
                        {thread.likesCount}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => handleOpenReplies(thread)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-outline" size={17} color={colors.rose} />
                      <Text style={styles.actionCounter}>{thread.repliesCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => handleHug(thread.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14 }}>🫂</Text>
                      <Text
                        style={[
                          styles.actionCounter,
                          isHugged && { color: colors.plum, fontWeight: '800' },
                        ]}
                      >
                        {thread.hugsCount}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionItem, { marginLeft: 'auto' }]}
                      onPress={() => handleShare(thread)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-social-outline" size={17} color={colors.rose} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* COMPOSER MODAL (Instagram Threads Style) */}
      <Modal
        visible={showComposer}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowComposer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.composerModal}>
            <View style={styles.composerHeader}>
              <TouchableOpacity onPress={() => setShowComposer(false)}>
                <Text style={styles.composerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.composerTitle}>New Period Thought</Text>
              <TouchableOpacity
                style={[
                  styles.composerPostBtn,
                  (!thoughtText.trim() || posting) && { opacity: 0.5 },
                ]}
                disabled={!thoughtText.trim() || posting}
                onPress={handlePostThought}
              >
                {posting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.composerPostBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18 }}>
              {/* Alias Selection */}
              <Text style={styles.composerSectionLabel}>POSTING AS (ANONYMOUS & SAFE)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {PRESET_ALIASES.map((alias) => {
                  const selected = selectedAlias === alias && !customAlias;
                  return (
                    <TouchableOpacity
                      key={alias}
                      onPress={() => {
                        setSelectedAlias(alias);
                        setCustomAlias('');
                      }}
                      style={[styles.aliasChip, selected && styles.aliasChipActive]}
                    >
                      <Text style={[styles.aliasChipText, selected && styles.aliasChipTextActive]}>
                        {alias}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Main Thought Input */}
              <View style={styles.thoughtInputWrapper}>
                <TextInput
                  value={thoughtText}
                  onChangeText={setThoughtText}
                  placeholder="Share what you are feeling, vent about cramps, crazy cravings, or give words of love to other girls..."
                  placeholderTextColor={colors.rose}
                  style={styles.thoughtTextInput}
                  multiline
                  autoFocus
                  maxLength={500}
                />
                <Text style={styles.charCount}>{thoughtText.length} / 500</Text>
              </View>

              {/* Select Feeling */}
              <Text style={styles.composerSectionLabel}>HOW DOES YOUR BODY FEEL RIGHT NOW?</Text>
              <View style={styles.feelingsGrid}>
                {FEELING_OPTIONS.map((f) => {
                  const active = selectedFeeling === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setSelectedFeeling(f)}
                      style={[styles.feelingSelectBtn, active && styles.feelingSelectBtnActive]}
                    >
                      <Text style={[styles.feelingSelectText, active && styles.feelingSelectTextActive]}>
                        {f}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Select Topic */}
              <Text style={styles.composerSectionLabel}>TOPIC TAG</Text>
              <View style={styles.tagsGrid}>
                {TOPIC_TAGS.filter((t) => t.id !== 'all').map((t) => {
                  const active = selectedTag === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setSelectedTag(t.id)}
                      style={[styles.tagSelectBtn, active && styles.tagSelectBtnActive]}
                    >
                      <Text style={[styles.tagSelectText, active && styles.tagSelectTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REPLIES MODAL */}
      <Modal
        visible={Boolean(activeThreadForReplies)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveThreadForReplies(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.repliesModal}>
            <View style={styles.repliesModalHeader}>
              <Text style={styles.repliesModalTitle}>Thread Discussion</Text>
              <TouchableOpacity
                onPress={() => setActiveThreadForReplies(null)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.plum} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 18 }}>
              {activeThreadForReplies && (
                <View style={styles.replyOriginalBox}>
                  <View style={styles.authorBadgeRow}>
                    <Text style={styles.authorName}>{activeThreadForReplies.authorName}</Text>
                    {activeThreadForReplies.isVip && (
                      <View style={styles.vipCrownBadge}>
                        <Text style={styles.vipCrownText}>VIP ⭐</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.replyOriginalContent}>
                    {activeThreadForReplies.content}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                    <Text style={styles.topicChipText}>#{activeThreadForReplies.tag}</Text>
                    {activeThreadForReplies.feeling && (
                      <Text style={styles.feelingChipText}>• {activeThreadForReplies.feeling}</Text>
                    )}
                  </View>
                </View>
              )}

              <Text style={styles.repliesListHeader}>
                REPLIES ({activeThreadForReplies?.replies?.length || 0})
              </Text>

              {(!activeThreadForReplies?.replies || activeThreadForReplies.replies.length === 0) ? (
                <View style={styles.emptyReplies}>
                  <Text style={styles.emptyRepliesText}>
                    Be the first member to comfort or reply!
                  </Text>
                </View>
              ) : (
                activeThreadForReplies.replies.map((reply) => (
                  <View key={reply.id} style={styles.replyItem}>
                    <View style={styles.replyAvatar}>
                      <Ionicons name="person-outline" size={13} color={colors.plum} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.replyHeaderRow}>
                        <Text style={styles.replyAuthor}>{reply.authorName}</Text>
                        <Text style={styles.replyTime}>{formatTimeAgo(reply.createdAt)}</Text>
                      </View>
                      <Text style={styles.replyContent}>{reply.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Reply Input Bar */}
            <View style={styles.replyInputBar}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Comfort her, share advice or love..."
                placeholderTextColor={colors.rose}
                style={styles.replyInput}
              />
              <TouchableOpacity
                style={[
                  styles.sendReplyBtn,
                  (!replyText.trim() || submittingReply) && { opacity: 0.5 },
                ]}
                disabled={!replyText.trim() || submittingReply}
                onPress={handleSendReply}
              >
                {submittingReply ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="arrow-up" size={18} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Subscription Paywall Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        currentPlanId={userSubscription?.planId}
        onSubscriptionSuccess={(plan) => {
          setUserSubscription({
            active: true,
            planId: plan.id,
            planName: plan.name,
            amount: plan.price,
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.blush,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: colors.blush,
  },
  topBarLeft: {},
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1.5,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: -0.5,
  },
  threadsLogo: {
    fontSize: 20,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vipClubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faeaf2',
    borderWidth: 1,
    borderColor: '#f2cde0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  vipClubText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  newPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plum,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  newPostBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
  categoriesWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#f7e1ee',
    paddingBottom: 10,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1.2,
    borderColor: colors.line,
  },
  categoryChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rose,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.rose,
    fontWeight: '600',
  },
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  clubPromoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff4fa',
    borderWidth: 1.5,
    borderColor: '#f2cade',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  clubPromoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dc97c4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  clubPromoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
  },
  pricePill: {
    backgroundColor: '#f3d5e7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pricePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.plum,
  },
  clubPromoSub: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  quickShareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#f7ddea',
  },
  quickShareAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#faeaf2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  quickSharePlaceholder: {
    fontSize: 13,
    color: colors.rose,
    flex: 1,
    fontWeight: '500',
  },
  threadCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.2,
    borderColor: '#f6dceb',
    shadowColor: '#c98cb0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  threadLeftCol: {
    alignItems: 'center',
    width: 40,
    marginRight: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fbeff6',
    borderWidth: 1.5,
    borderColor: '#f4cde1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.plum,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#f4dce9',
    marginVertical: 6,
  },
  repliesMiniDot: {
    backgroundColor: '#f6e2ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  repliesMiniCount: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.plum,
  },
  threadRightCol: {
    flex: 1,
  },
  threadHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  authorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
  },
  vipCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff4cc',
    borderWidth: 1,
    borderColor: '#ffd666',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    gap: 2,
  },
  vipCrownText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8c6100',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeAgo: {
    fontSize: 11,
    color: colors.rose,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  feelingChip: {
    backgroundColor: '#faedf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  feelingChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  topicChip: {
    backgroundColor: '#f3f1f7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topicChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.rose,
  },
  threadContentText: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#faedf4',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(74, 48, 72, 0.65)',
    justifyContent: 'flex-end',
  },
  composerModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  composerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  composerCancel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.rose,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.plum,
  },
  composerPostBtn: {
    backgroundColor: colors.plum,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  composerPostBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
  composerSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  aliasChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#faedf4',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f2d3e5',
  },
  aliasChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  aliasChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  aliasChipTextActive: {
    color: colors.white,
  },
  thoughtInputWrapper: {
    backgroundColor: '#fffbfe',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 12,
    marginVertical: 10,
  },
  thoughtTextInput: {
    fontSize: 14,
    color: colors.ink,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: colors.rose,
    textAlign: 'right',
    marginTop: 4,
  },
  feelingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  feelingSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1.2,
    borderColor: colors.line,
  },
  feelingSelectBtnActive: {
    backgroundColor: '#faedf4',
    borderColor: colors.plum,
  },
  feelingSelectText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '600',
  },
  feelingSelectTextActive: {
    color: colors.plum,
    fontWeight: '800',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1.2,
    borderColor: colors.line,
  },
  tagSelectBtnActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  tagSelectText: {
    fontSize: 12,
    color: colors.rose,
    fontWeight: '600',
  },
  tagSelectTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  repliesModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
  },
  repliesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  repliesModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.plum,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#faedf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyOriginalBox: {
    backgroundColor: '#fbf3f8',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5dceb',
  },
  replyOriginalContent: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
    marginTop: 6,
  },
  repliesListHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
    marginBottom: 10,
  },
  emptyReplies: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyRepliesText: {
    fontSize: 13,
    color: colors.rose,
  },
  replyItem: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f7e6f1',
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#faedf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  replyTime: {
    fontSize: 10,
    color: colors.rose,
  },
  replyContent: {
    fontSize: 13,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 17,
  },
  replyInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#faedf4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
    marginRight: 10,
  },
  sendReplyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
