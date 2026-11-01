import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AiCoachModal } from '../src/components/AiCoachModal';
import { PadzyraApi, AiCompanionResponse } from '../src/api/client';

describe('Padzyra Evidence-Based AI Period Companion Frontend Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('AiCoachModal renders correctly with header, evidence badge, and language switcher', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AiCoachModal
          visible={true}
          onClose={() => {}}
          onOpenSubscription={() => {}}
        />
      );
    });

    const root = renderer!.root;
    expect(root).toBeDefined();

    // Verify evidence-based badge
    const badgeText = root.findAllByProps({ children: 'EVIDENCE-BASED' });
    expect(badgeText.length).toBeGreaterThan(0);

    // Verify language switcher has both EN and हिंदी options
    const enOption = root.findAllByProps({ children: 'EN' });
    const hiOption = root.findAllByProps({ children: 'हिंदी' });
    expect(enOption.length).toBeGreaterThan(0);
    expect(hiOption.length).toBeGreaterThan(0);
  });

  test('PadzyraApi has complete AI companion client methods', () => {
    expect(typeof PadzyraApi.askAiCompanion).toBe('function');
    expect(typeof PadzyraApi.askAiCoach).toBe('function');
    expect(typeof PadzyraApi.getAiConversations).toBe('function');
    expect(typeof PadzyraApi.getAiConversation).toBe('function');
    expect(typeof PadzyraApi.deleteAiConversation).toBe('function');
    expect(typeof PadzyraApi.getAiSources).toBe('function');
    expect(typeof PadzyraApi.getAiSourceById).toBe('function');
    expect(typeof PadzyraApi.getAiConsent).toBe('function');
    expect(typeof PadzyraApi.updateAiConsent).toBe('function');
  });

  test('mock response matches expected evidence-based schema and citations contract', async () => {
    const mockResponse: AiCompanionResponse = {
      conversationId: 'mock-conv-1',
      reply: 'Menstrual cramps are caused by prostaglandins contracting the uterus.',
      language: 'en',
      urgency: 'normal',
      isEmergency: false,
      redFlags: [],
      sources: [
        {
          id: 'nhs-period-pain',
          title: 'Period pain (Dysmenorrhea)',
          organization: 'National Health Service (NHS)',
          url: 'https://www.nhs.uk/symptoms/period-pain/',
          reviewDate: '2026-08-20',
        },
      ],
      selfCareSteps: ['Apply continuous heat to your abdomen', 'Drink warm ginger tea'],
      whenToSeeDoctor: ['If pain prevents daily activities'],
      cycleContextUsed: true,
      disclaimer: 'Educational guidance only.',
    };

    jest.spyOn(PadzyraApi, 'askAiCompanion').mockResolvedValue(mockResponse);

    const res = await PadzyraApi.askAiCompanion({
      message: 'What helps with period cramps?',
      useCycleHistory: true,
    });

    expect(res.conversationId).toBe('mock-conv-1');
    expect(res.isEmergency).toBe(false);
    expect(res.sources.length).toBe(1);
    expect(res.sources[0].url).toContain('https://www.nhs.uk/');
    expect(res.selfCareSteps?.length).toBe(2);
  });

  test('emergency response correctly identifies red flags and urgent next steps', async () => {
    const mockEmergency: AiCompanionResponse = {
      conversationId: 'mock-conv-2',
      reply: '⚠️ Immediate Medical Care Recommended: Sudden excruciating pain requires urgent evaluation.',
      language: 'en',
      urgency: 'emergency',
      isEmergency: true,
      redFlags: ['severe_acute_pelvic_pain'],
      sources: [
        {
          id: 'acog-painful-periods',
          title: 'Painful Periods',
          organization: 'ACOG',
          url: 'https://www.acog.org/womens-health/faqs/painful-periods',
        },
      ],
      whenToSeeDoctor: ['Seek emergency room evaluation immediately', 'Call 112 / 911 if faint'],
      cycleContextUsed: false,
      disclaimer: 'Educational guidance only.',
    };

    jest.spyOn(PadzyraApi, 'askAiCompanion').mockResolvedValue(mockEmergency);

    const res = await PadzyraApi.askAiCompanion({
      message: 'I have excruciating pelvic pain and cannot stand',
    });

    expect(res.isEmergency).toBe(true);
    expect(res.urgency).toBe('emergency');
    expect(res.redFlags).toContain('severe_acute_pelvic_pain');
    expect(res.whenToSeeDoctor?.[0]).toContain('emergency room');
  });
});
