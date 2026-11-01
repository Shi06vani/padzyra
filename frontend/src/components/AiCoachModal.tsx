import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import {
  PadzyraApi,
  AiSourceCitation,
  AiSourceDetail,
} from '../api/client';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  language?: 'en' | 'hi';
  urgency?: 'normal' | 'self_care' | 'doctor_visit' | 'emergency';
  isEmergency?: boolean;
  redFlags?: string[];
  sources?: AiSourceCitation[];
  followUpQuestion?: string | null;
  followUpOptions?: string[];
  selfCareSteps?: string[];
  whenToSeeDoctor?: string[];
  cycleContextUsed?: boolean;
  disclaimer?: string;
  error?: boolean;
}

export interface AiCoachModalProps {
  visible: boolean;
  onClose: () => void;
  isSubscribed?: boolean;
  onOpenSubscription?: () => void;
}

const QUICK_QUESTIONS_EN = [
  'Why am I experiencing period cramps? 😣',
  'Why is my period late? 🩸',
  'Is my bleeding heavier than usual? 🩸',
  'Why do I feel tired during my period? 😴',
  'What can help with period discomfort? 🌸',
  'When should I speak to a doctor? 🩺',
];

const QUICK_QUESTIONS_HI = [
  'मुझे पीरियड्स में ऐंठन (cramps) क्यों होती है? 😣',
  'मेरा पीरियड लेट क्यों है? 🩸',
  'क्या मेरा ब्लीडिंग सामान्य से अधिक भारी है? 🩸',
  'पीरियड के दौरान इतनी थकान क्यों होती है? 😴',
  'पीरियड के दर्द में क्या आराम दे सकता है? 🌸',
  'मुझे डॉक्टर से कब संपर्क करना चाहिए? 🩺',
];

export const AiCoachModal: React.FC<AiCoachModalProps> = ({
  visible,
  onClose,
  isSubscribed = true,
  onOpenSubscription,
}) => {
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [useCycleHistory, setUseCycleHistory] = useState(false);
  const [showConsentInfo, setShowConsentInfo] = useState(false);
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [selectedSourceDetail, setSelectedSourceDetail] = useState<AiSourceDetail | AiSourceCitation | null>(null);
  const [allSources, setAllSources] = useState<AiSourceDetail[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const scrollViewRef = useRef<any>(null);

  // Initialize consent & language preference on modal open
  useEffect(() => {
    if (visible) {
      PadzyraApi.getAiConsent()
        .then((consent) => {
          if (consent) {
            setUseCycleHistory(Boolean(consent.aiCycleConsent));
            if (consent.aiLanguage === 'hi' || consent.aiLanguage === 'en') {
              setLanguage(consent.aiLanguage);
            }
          }
        })
        .catch(() => {});

      PadzyraApi.getAiSources()
        .then((sources) => {
          if (Array.isArray(sources)) setAllSources(sources);
        })
        .catch(() => {});
    }
  }, [visible]);

  // Set initial welcome message when language changes and conversation is fresh
  useEffect(() => {
    if (messages.length === 0 || (messages.length === 1 && messages[0].id === 'welcome')) {
      const welcomeText =
        language === 'hi'
          ? "नमस्ते! 🌸 मैं पैडज़ीरा का साक्ष्य-आधारित AI साथी हूँ। मैं आपके ऐंठन (cramps), पीरियड में देरी, रक्तस्राव, थकान और सुरक्षित घरेलू उपायों से जुड़े सवालों के उत्तर WHO, NHS और ACOG के क्लिनिकल साक्ष्यों के आधार पर दे सकती हूँ।\n\nकृपया ध्यान दें: मैं केवल शैक्षिक मार्गदर्शन प्रदान करती हूँ, चिकित्सकीय निदान या दवा की खुराक नहीं।"
          : "Hello sister! 🌸 I am your Padzyra Evidence-Based AI Period Companion. I answer questions about cramps, cycle delays, bleeding variations, and safe self-care using reviewed medical sources (WHO, NHS, ACOG).\n\nImportant: I provide educational wellness guidance only and cannot diagnose conditions or prescribe medication dosages.";

      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: welcomeText,
          timestamp: 'Just now',
          language,
          urgency: 'normal',
        },
      ]);
    }
  }, [language, messages.length]);

  const handleToggleConsent = async (val: boolean) => {
    setUseCycleHistory(val);
    try {
      await PadzyraApi.updateAiConsent({ aiCycleConsent: val, aiLanguage: language });
    } catch {
      // ignore
    }
  };

  const handleLanguageSwitch = async (newLang: 'en' | 'hi') => {
    setLanguage(newLang);
    try {
      await PadzyraApi.updateAiConsent({ aiLanguage: newLang });
    } catch {
      // ignore
    }
  };

  const handleStartNewConversation = () => {
    Alert.alert(
      language === 'hi' ? 'नई बातचीत शुरू करें' : 'Start New Conversation',
      language === 'hi'
        ? 'क्या आप वर्तमान चैट को रीसेट करके नई बातचीत शुरू करना चाहती हैं?'
        : 'Do you want to reset the current chat and start a new conversation?',
      [
        { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: language === 'hi' ? 'नई चैट' : 'Start Fresh',
          style: 'destructive',
          onPress: async () => {
            if (conversationId) {
              await PadzyraApi.deleteAiConversation(conversationId).catch(() => {});
            }
            setConversationId(null);
            setMessages([]);
            setInputText('');
            setLastFailedMessage(null);
          },
        },
      ]
    );
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || thinking) return;

    setLastFailedMessage(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setThinking(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const response = await PadzyraApi.askAiCompanion({
        message: text,
        conversationId,
        language,
        useCycleHistory,
      });

      if (response && response.conversationId) {
        setConversationId(response.conversationId);
      }

      const assistantMsg: ChatMessage = {
        id: response.messageId || `c-${Date.now()}`,
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: response.language || language,
        urgency: response.urgency,
        isEmergency: response.isEmergency,
        redFlags: response.redFlags,
        sources: response.sources,
        followUpQuestion: response.followUpQuestion,
        followUpOptions: response.followUpOptions,
        selfCareSteps: response.selfCareSteps,
        whenToSeeDoctor: response.whenToSeeDoctor,
        cycleContextUsed: response.cycleContextUsed,
        disclaimer: response.disclaimer,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setLastFailedMessage(text);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text:
          language === 'hi'
            ? 'नेटवर्क या सर्वर से जुड़ने में समस्या हुई। कृपया पुनः प्रयास (Retry) करें।'
            : 'Unable to reach the AI health companion right now. Please check your connection and tap retry.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setThinking(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };

  const handleOpenSourceUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Unable to open source URL on this device.');
    });
  };

  const quickQuestions = language === 'hi' ? QUICK_QUESTIONS_HI : QUICK_QUESTIONS_EN;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.coachAvatar}>
                <Text style={{ fontSize: 20 }}>🌸</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.coachTitle}>
                    {language === 'hi' ? 'साक्ष्य-आधारित AI साथी' : 'AI Period Companion'}
                  </Text>
                  <View style={styles.evidenceBadge}>
                    <Text style={styles.evidenceBadgeText}>EVIDENCE-BASED</Text>
                  </View>
                </View>
                <Text style={styles.coachSub}>WHO • NHS • ACOG Clinical Sources</Text>
              </View>

              {/* Language Switcher */}
              <View style={styles.langSelector}>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                  onPress={() => handleLanguageSwitch('en')}
                >
                  <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                    EN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'hi' && styles.langBtnActive]}
                  onPress={() => handleLanguageSwitch('hi')}
                >
                  <Text style={[styles.langBtnText, language === 'hi' && styles.langBtnTextActive]}>
                    हिंदी
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="close-ai-companion">
                <Ionicons name="close" size={20} color={colors.plum} />
              </TouchableOpacity>
            </View>

            {/* Privacy & Consent Bar */}
            <View style={styles.privacyBar}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name={useCycleHistory ? 'shield-checkmark' : 'shield-outline'}
                  size={15}
                  color={useCycleHistory ? '#2f7a52' : colors.rose}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.privacyText}>
                  {language === 'hi'
                    ? 'व्यक्तिगत सलाह हेतु चक्र डेटा का उपयोग:'
                    : 'Personalize using cycle history:'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowConsentInfo(true)}
                  style={{ paddingHorizontal: 4 }}
                >
                  <Ionicons name="information-circle-outline" size={16} color={colors.plum} />
                </TouchableOpacity>
              </View>

              <Switch
                value={useCycleHistory}
                onValueChange={handleToggleConsent}
                trackColor={{ false: '#e2d5de', true: '#cdebd9' }}
                thumbColor={useCycleHistory ? '#2f7a52' : '#f4f4f4'}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />

              <TouchableOpacity
                style={styles.sourcesHeaderBtn}
                onPress={() => setShowSourcesModal(true)}
              >
                <Ionicons name="library-outline" size={13} color={colors.plum} style={{ marginRight: 4 }} />
                <Text style={styles.sourcesHeaderBtnText}>
                  {language === 'hi' ? 'स्रोत' : 'Sources'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.newChatBtn}
                onPress={handleStartNewConversation}
                accessibilityLabel="Reset conversation"
              >
                <Ionicons name="refresh-outline" size={14} color={colors.plum} />
              </TouchableOpacity>
            </View>

            {/* Quick Questions Horizontal Scroll */}
            <View style={styles.quickQuestionsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
              >
                {quickQuestions.map((q, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickPill}
                    onPress={() => handleSend(q)}
                    disabled={thinking}
                  >
                    <Text style={styles.quickPillText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Chat Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((m) => {
                const isAssistant = m.sender === 'assistant';
                const isEmergency = Boolean(m.isEmergency || m.urgency === 'emergency');

                return (
                  <View
                    key={m.id}
                    style={[
                      styles.messageBubble,
                      isAssistant ? styles.assistantBubble : styles.userBubble,
                      isEmergency && styles.emergencyBubble,
                      m.error && styles.errorBubble,
                    ]}
                  >
                    {/* Emergency Alert Header Banner */}
                    {isEmergency && (
                      <View style={styles.emergencyBanner}>
                        <Ionicons name="warning" size={18} color="#b3261e" style={{ marginRight: 6 }} />
                        <Text style={styles.emergencyBannerTitle}>
                          {language === 'hi'
                            ? 'आपातकालीन चेतावनी: तत्काल चिकित्सा सहायता लें'
                            : 'EMERGENCY ALERT: URGENT MEDICAL CARE NEEDED'}
                        </Text>
                      </View>
                    )}

                    {/* Main Text Content */}
                    <Text
                      style={[
                        styles.messageText,
                        isAssistant ? styles.assistantText : styles.userText,
                        isEmergency && styles.emergencyText,
                      ]}
                    >
                      {m.text}
                    </Text>

                    {/* Self-Care Steps Checklist */}
                    {isAssistant && m.selfCareSteps && m.selfCareSteps.length > 0 && !isEmergency && (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionHeaderRow}>
                          <Ionicons name="heart-outline" size={14} color="#a0426d" style={{ marginRight: 5 }} />
                          <Text style={styles.sectionTitle}>
                            {language === 'hi' ? 'साक्ष्य-आधारित घरेलू उपाय' : 'Evidence-Backed Self-Care'}
                          </Text>
                        </View>
                        {m.selfCareSteps.map((step, sIdx) => (
                          <View key={sIdx} style={styles.bulletRow}>
                            <Text style={styles.bulletDot}>•</Text>
                            <Text style={styles.bulletText}>{step}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* When to see a doctor checklist */}
                    {isAssistant && m.whenToSeeDoctor && m.whenToSeeDoctor.length > 0 && (
                      <View style={[styles.sectionCard, isEmergency && { backgroundColor: '#fcebe9', borderColor: '#f7c2bc' }]}>
                        <View style={styles.sectionHeaderRow}>
                          <Ionicons
                            name="medkit-outline"
                            size={14}
                            color={isEmergency ? '#b3261e' : '#2b5876'}
                            style={{ marginRight: 5 }}
                          />
                          <Text style={[styles.sectionTitle, isEmergency && { color: '#b3261e' }]}>
                            {language === 'hi'
                              ? isEmergency
                                ? 'आपातकालीन कदम'
                                : 'डॉक्टर से कब मिलें?'
                              : isEmergency
                              ? 'Emergency Next Steps'
                              : 'When to Speak to a Clinician'}
                          </Text>
                        </View>
                        {m.whenToSeeDoctor.map((step, dIdx) => (
                          <View key={dIdx} style={styles.bulletRow}>
                            <Text style={[styles.bulletDot, isEmergency && { color: '#b3261e' }]}>•</Text>
                            <Text style={[styles.bulletText, isEmergency && { color: '#4a1210', fontWeight: '600' }]}>
                              {step}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Tappable Medical Source Citations */}
                    {isAssistant && m.sources && m.sources.length > 0 && (
                      <View style={styles.citationContainer}>
                        <Text style={styles.citationLabel}>
                          {language === 'hi' ? 'समीक्षित चिकित्सा स्रोत:' : 'Reviewed medical sources:'}
                        </Text>
                        <View style={styles.citationPillRow}>
                          {m.sources.map((src, srcIdx) => (
                            <TouchableOpacity
                              key={srcIdx}
                              style={styles.citationPill}
                              onPress={() => setSelectedSourceDetail(src)}
                            >
                              <Ionicons name="document-text-outline" size={11} color="#2b5876" style={{ marginRight: 4 }} />
                              <Text style={styles.citationPillText}>{src.organization || src.title}</Text>
                              <Ionicons name="open-outline" size={10} color="#2b5876" style={{ marginLeft: 3 }} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Interactive Follow-Up Question & Quick Reply Pills */}
                    {isAssistant && m.followUpQuestion && !isEmergency && (
                      <View style={styles.followUpContainer}>
                        <Text style={styles.followUpQuestionText}>💬 {m.followUpQuestion}</Text>
                        {m.followUpOptions && m.followUpOptions.length > 0 && (
                          <View style={styles.followUpOptionsRow}>
                            {m.followUpOptions.map((opt, optIdx) => (
                              <TouchableOpacity
                                key={optIdx}
                                style={styles.followUpOptionBtn}
                                onPress={() => handleSend(opt)}
                                disabled={thinking}
                              >
                                <Text style={styles.followUpOptionText}>{opt}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Medical Educational Disclaimer */}
                    {isAssistant && m.disclaimer && (
                      <Text style={styles.disclaimerText}>{m.disclaimer}</Text>
                    )}

                    {/* Retry button on error */}
                    {m.error && lastFailedMessage && (
                      <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => handleSend(lastFailedMessage)}
                      >
                        <Ionicons name="reload" size={12} color={colors.white} style={{ marginRight: 4 }} />
                        <Text style={styles.retryBtnText}>
                          {language === 'hi' ? 'पुनः प्रयास करें (Retry)' : 'Retry Request'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <Text style={[styles.messageTime, isAssistant ? { color: colors.rose } : { color: '#fbeff6' }]}>
                      {m.timestamp}
                    </Text>
                  </View>
                );
              })}

              {thinking && (
                <View style={[styles.messageBubble, styles.assistantBubble, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <ActivityIndicator size="small" color={colors.plum} />
                  <Text style={styles.assistantText}>
                    {language === 'hi'
                      ? 'क्लिनिकल साक्ष्यों से उत्तर तैयार किया जा रहा है...'
                      : 'Retrieving evidence-based guidance...'}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  language === 'hi'
                    ? 'ऐंठन, देरी या माहवारी स्वास्थ्य संबंधी प्रश्न पूछें...'
                    : 'Ask about cramps, delay, flow, or symptoms...'
                }
                placeholderTextColor={colors.rose}
                style={styles.inputField}
                onSubmitEditing={() => handleSend()}
                editable={!thinking}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || thinking) && { opacity: 0.5 }]}
                disabled={!inputText.trim() || thinking}
                onPress={() => handleSend()}
              >
                <Ionicons name="send" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Sources Catalog Modal */}
      <Modal visible={showSourcesModal} transparent animationType="fade" onRequestClose={() => setShowSourcesModal(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={styles.sourcesModalContent}>
            <View style={styles.infoModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="library" size={18} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.infoModalTitle}>
                  {language === 'hi' ? 'समीक्षित चिकित्सा स्रोत' : 'Reviewed Medical Evidence'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSourcesModal(false)}>
                <Ionicons name="close" size={22} color={colors.plum} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.infoModalBody}>
                {language === 'hi'
                  ? 'पैडज़ीरा केवल विश्व स्तर पर मान्यता प्राप्त और सहकर्मी-समीक्षित क्लिनिकल दिशा-निर्देशों का उपयोग करता है:'
                  : 'Padzyra AI companion strictly grounds all responses in peer-reviewed, authoritative public health sources:'}
              </Text>

              {allSources.map((source) => (
                <View key={source.id} style={styles.sourceCard}>
                  <Text style={styles.sourceCardTitle}>{source.title}</Text>
                  <Text style={styles.sourceCardOrg}>{source.organization}</Text>
                  <Text style={styles.sourceCardSummary}>
                    {language === 'hi' ? source.summaryHi : source.summaryEn}
                  </Text>
                  <TouchableOpacity
                    style={styles.sourceLinkRow}
                    onPress={() => handleOpenSourceUrl(source.url)}
                  >
                    <Ionicons name="link-outline" size={12} color="#1b4965" />
                    <Text style={styles.sourceLinkText}>{source.url}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Single Source Citation Details Modal */}
      <Modal visible={Boolean(selectedSourceDetail)} transparent animationType="fade" onRequestClose={() => setSelectedSourceDetail(null)}>
        <View style={styles.infoModalOverlay}>
          <View style={styles.singleSourceModalContent}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle} numberOfLines={1}>
                {selectedSourceDetail?.organization || 'Medical Source'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedSourceDetail(null)}>
                <Ionicons name="close" size={22} color={colors.plum} />
              </TouchableOpacity>
            </View>

            {selectedSourceDetail && (
              <View style={{ gap: 10, paddingVertical: 8 }}>
                <Text style={styles.sourceCardTitle}>{selectedSourceDetail.title}</Text>
                {'summary' in selectedSourceDetail && selectedSourceDetail.summary ? (
                  <Text style={styles.sourceCardSummary}>{selectedSourceDetail.summary}</Text>
                ) : 'summaryEn' in selectedSourceDetail ? (
                  <Text style={styles.sourceCardSummary}>
                    {language === 'hi' ? selectedSourceDetail.summaryHi : selectedSourceDetail.summaryEn}
                  </Text>
                ) : null}
                {selectedSourceDetail.reviewDate && (
                  <Text style={styles.sourceReviewDate}>
                    {language === 'hi' ? 'समीक्षा तिथि:' : 'Clinical Review Date:'} {selectedSourceDetail.reviewDate}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.openBrowserBtn}
                  onPress={() => {
                    if (selectedSourceDetail.url) handleOpenSourceUrl(selectedSourceDetail.url);
                  }}
                >
                  <Ionicons name="open-outline" size={15} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.openBrowserBtnText}>
                    {language === 'hi' ? 'आधिकारिक स्रोत पेज देखें' : 'View Official Publication'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Consent & Privacy Information Modal */}
      <Modal visible={showConsentInfo} transparent animationType="fade" onRequestClose={() => setShowConsentInfo(false)}>
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalContent}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="shield-checkmark" size={20} color="#2f7a52" style={{ marginRight: 8 }} />
              <Text style={styles.infoModalTitle}>
                {language === 'hi' ? 'गोपनीयता और डेटा सहमति' : 'Cycle Data & Privacy Control'}
              </Text>
              <TouchableOpacity onPress={() => setShowConsentInfo(false)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close" size={22} color={colors.plum} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.infoModalBody}>
                {language === 'hi'
                  ? '• पैडज़ीरा में आपका पीरियड और लक्षण डेटा एन्क्रिप्टेड रहता है।\n• यदि आप टॉगल को चालू रखती हैं, तो एआई साथी केवल वर्तमान चक्र का दिन (जैसे Day 14) और दर्ज ऐंठन/मूड को संदर्भ के रूप में उपयोग करता है।\n• यदि टॉगल बंद है, तो एआई बिना आपके व्यक्तिगत स्वास्थ्य इतिहास के सामान्य साक्ष्य-आधारित मार्गदर्शन प्रदान करता है।\n• आपका डेटा किसी अन्य उपयोगकर्ता के साथ कभी साझा नहीं किया जाता है और न ही किसी विज्ञापन मॉडल को बेचा जाता है।'
                  : '• Your period dates and symptom logs in Padzyra are strongly encrypted.\n• When enabled, the AI Companion uses only minimum required metrics (e.g. current cycle day, logged cramps) to provide relevant observations.\n• When disabled, the AI offers general guidance without accessing your personal cycle history.\n• Your health data is never shared with third-party advertisers or used for public model training.\n• You can revoke access at any time using the switch.'}
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.confirmConsentBtn} onPress={() => setShowConsentInfo(false)}>
              <Text style={styles.confirmConsentBtnText}>
                {language === 'hi' ? 'समझ आ गया' : 'Got it, thank you'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(74, 48, 72, 0.65)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '92%',
    display: 'flex',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  coachAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#faedf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.plum,
  },
  evidenceBadge: {
    backgroundColor: '#e7f6ee',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 6,
  },
  evidenceBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#2f7a52',
    letterSpacing: 0.4,
  },
  coachSub: {
    fontSize: 10.5,
    color: colors.rose,
    marginTop: 1,
  },
  langSelector: {
    flexDirection: 'row',
    backgroundColor: '#faedf4',
    borderRadius: 14,
    padding: 2,
    marginRight: 6,
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  langBtnActive: {
    backgroundColor: colors.plum,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  langBtnTextActive: {
    color: colors.white,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#faedf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fbf5f8',
    borderBottomWidth: 1,
    borderBottomColor: '#f2e1eb',
  },
  privacyText: {
    fontSize: 11,
    color: colors.ink,
    fontWeight: '600',
  },
  sourcesHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faedf4',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
  },
  sourcesHeaderBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.plum,
  },
  newChatBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#faedf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickQuestionsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f7e1ee',
    backgroundColor: colors.white,
  },
  quickPill: {
    backgroundColor: '#faedf4',
    borderWidth: 1,
    borderColor: '#f2d0e3',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.plum,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 14,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fbf3f8',
    borderWidth: 1,
    borderColor: '#f3dbe8',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.plum,
    borderBottomRightRadius: 4,
  },
  emergencyBubble: {
    backgroundColor: '#fef3f2',
    borderColor: '#f97066',
    borderWidth: 1.5,
  },
  errorBubble: {
    backgroundColor: '#fff5f5',
    borderColor: '#feb8b8',
    borderWidth: 1,
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee4e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  emergencyBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b3261e',
    flex: 1,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  assistantText: {
    color: colors.ink,
  },
  userText: {
    color: colors.white,
    fontWeight: '500',
  },
  emergencyText: {
    color: '#381e1d',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ecdbe5',
    padding: 10,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 12,
    color: colors.plum,
    marginRight: 6,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 12,
    color: colors.ink,
    flex: 1,
    lineHeight: 18,
  },
  citationContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0dbe8',
  },
  citationLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.rose,
    marginBottom: 4,
  },
  citationPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  citationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf4f9',
    borderColor: '#c6e2ef',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  citationPillText: {
    fontSize: 10.5,
    color: '#1b4965',
    fontWeight: '700',
  },
  followUpContainer: {
    marginTop: 8,
    backgroundColor: '#fff7fb',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f5d5e5',
  },
  followUpQuestionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
    marginBottom: 6,
  },
  followUpOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  followUpOptionBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.plum,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  followUpOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  disclaimerText: {
    fontSize: 9.5,
    color: colors.rose,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 13,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d92d20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  messageTime: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'right',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#faedf4',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.ink,
    marginRight: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sourcesModalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
  },
  singleSourceModalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
  },
  infoModalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.plum,
  },
  infoModalBody: {
    fontSize: 12.5,
    color: colors.ink,
    lineHeight: 19,
    marginBottom: 10,
  },
  sourceCard: {
    backgroundColor: '#fbf5f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eedce8',
    padding: 10,
    marginBottom: 10,
  },
  sourceCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  sourceCardOrg: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1b4965',
    marginVertical: 2,
  },
  sourceCardSummary: {
    fontSize: 11.5,
    color: colors.ink,
    lineHeight: 16,
    marginTop: 4,
  },
  sourceReviewDate: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.rose,
    marginTop: 4,
  },
  sourceLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  sourceLinkText: {
    fontSize: 10.5,
    color: '#1b4965',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  openBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.plum,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 10,
  },
  openBrowserBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.white,
  },
  confirmConsentBtn: {
    backgroundColor: colors.plum,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmConsentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
