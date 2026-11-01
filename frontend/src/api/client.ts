import { Platform } from 'react-native';

const DEFAULT_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3000/api/v1',
  ios: 'http://localhost:3000/api/v1',
  default: 'http://localhost:3000/api/v1',
});

let customBaseUrl = DEFAULT_BASE_URL;
let authToken: string | null = null;
let cookieHeader: string | null = null;

export const ApiConfig = {
  getBaseUrl(): string {
    return customBaseUrl;
  },
  setBaseUrl(url: string) {
    customBaseUrl = url.trim().replace(/\/+$/, '');
  },
  getAuthToken(): string | null {
    return authToken;
  },
  setAuthToken(token: string | null) {
    authToken = token;
  },
  setCookie(cookie: string | null) {
    cookieHeader = cookie;
  },
};

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    status?: number;
    message?: string;
  };
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    'x-padzyra': '1',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  if (options.body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${ApiConfig.getBaseUrl()}${cleanEndpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body && method !== 'GET' ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  // Extract set-cookie if available
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const pzCookie = setCookie.split(';')[0];
    if (pzCookie && pzCookie.includes('pz=')) {
      ApiConfig.setCookie(pzCookie);
    }
  }

  if (response.status === 204) {
    return null as T;
  }

  const json: ApiResponse<T> = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = json;
    throw err;
  }

  return (json.data !== undefined ? json.data : (json as any)) as T;
}

export interface TripChecklistItem {
  id: string;
  name: string;
  category: 'essentials' | 'comfort' | 'medication' | 'custom';
  packed: boolean;
  quantity?: number;
  custom?: boolean;
  description?: string;
}

export interface TripItem {
  id: string;
  start: string;
  end: string;
  name?: string | null;
  destination?: string | null;
  activities?: string[];
  checklist?: TripChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

export const PadzyraApi = {
  // Auth
  async requestOtp(email: string, purpose: string = 'login') {
    return apiRequest('/auth/otp', {
      method: 'POST',
      body: { email, purpose },
    });
  },

  async verifyOtp(email: string, code: string, role: 'girl' | 'shop' = 'girl') {
    const result = await apiRequest<{ id: string; role: 'girl' | 'shop'; token?: string }>('/auth/verify', {
      method: 'POST',
      body: { email, code, role },
    });
    if (result.token) {
      ApiConfig.setAuthToken(result.token);
    }
    return result;
  },

  // Phone OTP & Firebase Auth
  async requestPhoneOtp(phone: string, purpose: string = 'login') {
    return apiRequest('/auth/phone/otp', {
      method: 'POST',
      body: { phone, purpose },
    });
  },

  async verifyPhoneOtp(phone: string, code: string, role: 'girl' | 'shop' = 'girl') {
    const result = await apiRequest<{ id: string; role: 'girl' | 'shop'; token?: string }>('/auth/phone/verify', {
      method: 'POST',
      body: { phone, code, role },
    });
    if (result.token) {
      ApiConfig.setAuthToken(result.token);
    }
    return result;
  },

  async loginWithFirebasePhone(idToken: string, role: 'girl' | 'shop' = 'girl') {
    const result = await apiRequest<{ id: string; role: 'girl' | 'shop'; token?: string }>('/auth/firebase-phone', {
      method: 'POST',
      body: { idToken, role },
    });
    if (result.token) {
      ApiConfig.setAuthToken(result.token);
    }
    return result;
  },

  // Firebase Push Notifications (FCM)
  async saveFcmToken(token: string, platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android') {
    return apiRequest('/push/fcm', {
      method: 'POST',
      body: { token, platform },
    });
  },

  async removeFcmToken(token?: string) {
    return apiRequest('/push/fcm', {
      method: 'DELETE',
      body: token ? { token } : undefined,
    });
  },

  async getAuthStatus() {
    return apiRequest<{
      authenticated: boolean;
      role?: 'girl' | 'shop';
      email?: string;
      pinSet?: boolean;
      pinUnlocked?: boolean;
    }>('/auth/status');
  },

  async unlockPin(pin: string) {
    return apiRequest<{ until: string }>('/auth/pin', {
      method: 'POST',
      body: { pin },
    });
  },

  async lock() {
    return apiRequest('/auth/lock', { method: 'POST' });
  },

  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      ApiConfig.setAuthToken(null);
      ApiConfig.setCookie(null);
    }
  },

  // Account / User
  async getMe() {
    return apiRequest<{
      id: string;
      email: string;
      role: 'girl' | 'shop';
      pin: boolean;
      padSize?: string;
      price?: number;
      discreet?: boolean;
      cycleLength?: number;
      periodLength?: number;
      leaveHome?: string;
      lunch?: string;
      quietStart?: string;
      quietEnd?: string;
      heat?: string;
    }>('/me');
  },

  async updateMe(body: {
    pin?: string;
    current?: string;
    padSize?: string;
    price?: number;
    discreet?: boolean;
    cycleLength?: number;
    periodLength?: number;
    leaveHome?: string;
    lunch?: string;
    quietStart?: string | null;
    quietEnd?: string | null;
    heat?: string | null;
  }) {
    return apiRequest('/me', {
      method: 'PATCH',
      body,
    });
  },

  async getExpense() {
    return apiRequest<{
      used: number;
      bought: number;
      amount: string | number;
    }>('/expense');
  },

  // Dashboard & Cycles
  async getDashboard() {
    return apiRequest<{
      day?: number;
      of?: number;
      until?: string;
      inDays?: number;
      focus?: string;
      move?: string;
    }>('/dashboard');
  },

  async getCycles() {
    return apiRequest<Array<{
      id: string;
      startedAt: string;
      endedAt: string | null;
      periodDays?: number;
      cycleDays?: number;
    }>>('/cycles');
  },

  async startCycle(startedAt?: string) {
    return apiRequest('/cycles/start', {
      method: 'POST',
      body: startedAt ? { startedAt } : {},
    });
  },

  async endCycle(endedAt?: string) {
    return apiRequest('/cycles/end', {
      method: 'POST',
      body: endedAt ? { endedAt } : {},
    });
  },

  // Supplies
  async getSupplies() {
    return apiRequest<Array<{
      place: 'bag' | 'home';
      kind: 'day' | 'night';
      qty: number;
    }>>('/supplies');
  },

  async updateSupplies(place: 'bag' | 'home', kind: 'day' | 'night', qty: number) {
    return apiRequest('/supplies', {
      method: 'PATCH',
      body: { place, kind, qty },
    });
  },

  async useSupply(place: 'bag' | 'home' = 'bag', kind: 'day' | 'night' = 'day', count: number = 1) {
    return apiRequest('/supplies/use', {
      method: 'POST',
      body: { place, kind, count },
    });
  },

  // Checklist
  async getChecklist() {
    return apiRequest<string[]>('/checklist');
  },

  // Daily Feelings
  async getDayFeelings(dateIso: string) {
    return apiRequest<{
      date: string;
      cramps?: 'none' | 'mild' | 'strong';
      mood?: 'calm' | 'okay' | 'low' | 'irritable';
    }>(`/days/${dateIso}`);
  },

  async saveDayFeelings(dateIso: string, data: { cramps?: string; mood?: string }) {
    return apiRequest(`/days/${dateIso}`, {
      method: 'PUT',
      body: data,
    });
  },

  // Emergency / Shops / Orders
  async getNearbyShops(lat: number = 12.9716, lng: number = 77.5946) {
    return apiRequest<Array<{
      id: string;
      name: string;
      code: string;
      address: string;
      phone: string;
      distanceMeters?: number;
      opensAt?: string;
      closesAt?: string;
    }>>(`/shops/nearby?lat=${lat}&lng=${lng}`);
  },

  async getSavedShops() {
    return apiRequest<Array<{
      id: string;
      name: string;
      code: string;
      address: string;
      phone: string;
    }>>('/shops/saved');
  },

  async getOrders() {
    return apiRequest<Array<{
      id: string;
      orderNumber: string;
      shop?: string | {
        id?: string;
        name: string;
        address?: string;
        phone?: string;
        lat?: number;
        lng?: number;
      };
      status: 'pending' | 'accepted' | 'ready' | 'picked_up' | 'picked-up' | 'cancelled';
      kind: string;
      size?: string;
      qty: number;
      createdAt?: string;
      address?: string;
    }>>('/orders');
  },

  async createOrder(
    shopId: string,
    qty: number = 2,
    options?: {
      kind?: string;
      size?: string;
      address?: string;
      phone?: string;
    }
  ) {
    return apiRequest<{
      id: string;
      orderNumber: string;
      status: string;
      shopId: string;
      qty: number;
      kind?: string;
      size?: string;
    }>('/orders', {
      method: 'POST',
      body: { shopId, qty, ...(options || {}) },
    });
  },

  // Period Essentials Catalog (Chocolates, Hot Water Bags, Cups, Tampons, Relief, Kits)
  async getEssentialsCatalog(category?: string) {
    const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
    return apiRequest<{
      items: Array<{
        id: string;
        category: string;
        name: string;
        tagline: string;
        description: string;
        price: number;
        emoji: string;
        badge: string;
        badgeColor: string;
        unit: string;
        sizes?: string[];
        inStock: boolean;
      }>;
      categories: Array<{ id: string; label: string }>;
      total: number;
    }>(`/catalog/essentials${query}`);
  },

  async getEssentialItemById(id: string) {
    return apiRequest<{
      id: string;
      category: string;
      name: string;
      tagline: string;
      description: string;
      price: number;
      emoji: string;
      badge: string;
      badgeColor: string;
      unit: string;
      sizes?: string[];
      inStock: boolean;
    }>(`/catalog/essentials/${id}`);
  },

  async markOrderPickedUp(orderId: string) {
    return apiRequest(`/orders/${orderId}/picked-up`, {
      method: 'POST',
    });
  },

  // Shop Role Specific
  async getShopMe() {
    return apiRequest<{
      id: string;
      name: string;
      code: string;
      address: string;
      phone: string;
      opensAt?: string;
      closesAt?: string;
    }>('/shops/me');
  },

  async createShop(body: {
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
    area?: string;
    opensAt?: string;
    closesAt?: string;
  }) {
    return apiRequest('/shops', {
      method: 'POST',
      body,
    });
  },

  async getShopOrders() {
    return apiRequest<Array<{
      id: string;
      orderNumber: string;
      status: 'pending' | 'accepted' | 'ready' | 'cancelled';
      kind: string;
      size: string;
      qty: number;
      phone?: string;
      address?: string;
    }>>('/shops/orders');
  },

  async updateShopOrderStatus(
    orderId: string,
    status: 'accepted' | 'ready' | 'cancelled'
  ) {
    return apiRequest(`/shops/orders/${orderId}`, {
      method: 'PATCH',
      body: { status },
    });
  },

  async deleteCycle(cycleId: string) {
    return apiRequest(`/cycles/${cycleId}`, {
      method: 'DELETE',
    });
  },

  async createCycle(body: { start: string; end?: string; flow?: string; note?: string }) {
    return apiRequest<{
      id: string;
      start: string;
      end?: string | null;
      flow?: string | null;
      note?: string | null;
    }>('/cycles', {
      method: 'POST',
      body,
    });
  },

  // Trips / Period Travel Planner
  async getTrips() {
    return apiRequest<TripItem[]>('/trips');
  },

  async getTrip(id: string) {
    return apiRequest<TripItem>(`/trips/${id}`);
  },

  async addTrip(data: {
    start: string;
    end: string;
    name?: string | null;
    destination?: string | null;
    activities?: string[];
    checklist?: TripChecklistItem[];
  }) {
    return apiRequest<TripItem>('/trips', {
      method: 'POST',
      body: data,
    });
  },

  async updateTrip(
    id: string,
    updates: {
      start?: string;
      end?: string;
      name?: string | null;
      destination?: string | null;
      activities?: string[];
      checklist?: TripChecklistItem[];
    }
  ) {
    return apiRequest<TripItem>(`/trips/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  },

  async deleteTrip(id: string) {
    return apiRequest(`/trips/${id}`, {
      method: 'DELETE',
    });
  },

  // Supplies History & Pickup
  async getSuppliesHistory(limit: number = 50) {
    return apiRequest<Array<{
      id: string;
      usedOn: string;
      place: 'bag' | 'home';
      kind: 'day' | 'night';
      qty: number;
      reason: string;
      createdAt: string;
    }>>(`/supplies/history?limit=${limit}`);
  },

  async pickupSupplies(kind: 'day' | 'night', qty: number) {
    return apiRequest('/supplies/pickup', {
      method: 'POST',
      body: { kind, qty },
    });
  },

  // Saved Shops & Search
  async searchShops(options: { lat?: number; lng?: number; area?: string }) {
    return apiRequest<Array<{
      id: string;
      name: string;
      code: string;
      address: string;
      phone: string;
      distanceMeters?: number;
      opensAt?: string;
      closesAt?: string;
      saved?: boolean;
    }>>('/shops/nearby', {
      method: 'POST',
      body: options,
    });
  },

  async saveShopByCode(code: string) {
    return apiRequest<{ id: string; name: string }>('/shops/saved', {
      method: 'POST',
      body: { code },
    });
  },

  async removeSavedShop(shopId: string) {
    return apiRequest(`/shops/saved/${shopId}`, {
      method: 'DELETE',
    });
  },

  // Account Export & Deletion
  async exportData() {
    return apiRequest<any>('/me/export');
  },

  async deleteAccount(code: string) {
    return apiRequest('/me', {
      method: 'DELETE',
      body: { code },
    });
  },

  async logoutAll(code: string) {
    return apiRequest('/auth/logout-all', {
      method: 'POST',
      body: { code },
    });
  },

  // Orders Tracking & Actions
  async cancelOrder(orderId: string) {
    return apiRequest(`/orders/${orderId}/cancel`, {
      method: 'POST',
    });
  },

  async getOrder(orderId: string) {
    return apiRequest<{
      id: string;
      orderNumber: string;
      status: 'pending' | 'accepted' | 'ready' | 'picked-up' | 'cancelled';
      kind: string;
      size: string;
      qty: number;
      phone?: string;
      address?: string;
      createdAt: string;
      shop?: {
        id: string;
        name: string;
        address: string;
        phone: string;
      };
    }>(`/orders/${orderId}`);
  },

  // Notifications & Reminders
  async getTodayAlert() {
    return apiRequest<{
      type: string;
      title?: string;
      text?: string;
      action?: string;
    }>('/notifications/today');
  },

  async dismissAlert() {
    return apiRequest('/notifications/done', {
      method: 'POST',
    });
  },

  async getNotificationHistory() {
    return apiRequest<Array<{
      id: string;
      kind: string;
      day: string;
      usedAt?: string;
      expiresAt?: string;
      createdAt: string;
    }>>('/notifications/history');
  },

  async sendReminderNotification(options?: { kind?: string; title?: string; body?: string }) {
    return apiRequest<{
      alertId: string;
      title: string;
      body: string;
      kind: string;
      fcmResult?: any;
    }>('/notifications/reminder', {
      method: 'POST',
      body: options || {},
    });
  },

  async getFcmStatus() {
    return apiRequest<{
      firebaseInitialized: boolean;
      tokensCount: number;
      tokens: Array<{ id: string; platform: string; registeredAt: string }>;
    }>('/notifications/fcm/status');
  },

  // Daily Feeling Logs History
  async getDays(from?: string, to?: string) {
    const params = [from ? `from=${from}` : '', to ? `to=${to}` : ''].filter(Boolean).join('&');
    return apiRequest<Array<{
      date: string;
      cramps?: string;
      mood?: string;
      updatedAt?: string;
    }>>(`/days${params ? `?${params}` : ''}`);
  },

  async deleteDay(date: string) {
    return apiRequest(`/days/${date}`, {
      method: 'DELETE',
    });
  },

  // Threads / Period Thoughts
  async getThreads(tag?: string) {
    const query = tag && tag !== 'all' ? `?tag=${encodeURIComponent(tag)}` : '';
    return apiRequest<Array<{
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
      replies?: Array<{
        id: string;
        authorName: string;
        content: string;
        createdAt: string;
      }>;
    }>>(`/threads${query}`);
  },

  async createThread(body: {
    content: string;
    authorName?: string;
    isAnonymous?: boolean;
    tag?: string;
    feeling?: string;
  }) {
    return apiRequest('/threads', {
      method: 'POST',
      body,
    });
  },

  async likeThread(threadId: string) {
    return apiRequest<{ likesCount: number }>(`/threads/${threadId}/like`, {
      method: 'POST',
    });
  },

  async hugThread(threadId: string) {
    return apiRequest<{ hugsCount: number }>(`/threads/${threadId}/hug`, {
      method: 'POST',
    });
  },

  async getThreadReplies(threadId: string) {
    return apiRequest<Array<{
      id: string;
      authorName: string;
      content: string;
      createdAt: string;
    }>>(`/threads/${threadId}/replies`);
  },

  async replyThread(threadId: string, body: {
    content: string;
    authorName?: string;
    isAnonymous?: boolean;
  }) {
    return apiRequest(`/threads/${threadId}/replies`, {
      method: 'POST',
      body,
    });
  },

  // Subscriptions & Monetization
  async getSubscriptionPlans() {
    return apiRequest<Array<{
      id: string;
      name: string;
      price: number;
      currency: string;
      period: string;
      popular?: boolean;
      badge: string;
      tagline: string;
      color: string;
      features: string[];
    }>>('/subscriptions/plans');
  },

  async getCurrentSubscription() {
    return apiRequest<{
      active: boolean;
      subscriptionId?: string;
      planId?: string | null;
      planName?: string;
      amount?: number;
      expiresAt?: string;
      startDate?: string;
      plan?: any;
    }>('/subscriptions/current');
  },

  async subscribeToPlan(planId: string, paymentMethod: string = 'upi', transactionId?: string) {
    return apiRequest<{
      success: boolean;
      message: string;
      subscription: any;
      plan: any;
    }>('/subscriptions/subscribe', {
      method: 'POST',
      body: { planId, paymentMethod, transactionId },
    });
  },

  async cancelSubscription() {
    return apiRequest<{ success: boolean; message: string }>('/subscriptions/cancel', {
      method: 'POST',
    });
  },

  async createSubscriptionOrder(planId: string) {
    return apiRequest<{
      orderId: string;
      planId: string;
      planName: string;
      amount: number;
      amountPaise: number;
      currency: string;
      keyId: string;
    }>('/subscriptions/create-order', {
      method: 'POST',
      body: { planId },
    });
  },

  async verifySubscriptionPayment(body: {
    planId: string;
    paymentMethod?: string;
    transactionId?: string;
    orderId?: string;
  }) {
    return apiRequest<{
      success: boolean;
      message: string;
      subscription: any;
      plan: any;
    }>('/subscriptions/verify-payment', {
      method: 'POST',
      body,
    });
  },

  async getDoctorReport() {
    return apiRequest<{
      reportId: string;
      generatedAt: string;
      user: {
        alias: string;
        cycleLength: number;
        periodLength: number;
        padPreference: string;
      };
      metrics: {
        averageCycleDays: number;
        averageFlowDays: number;
        cycleRegularity: string;
        primarySymptomsReported: string[];
        recommendedConsultationFocus: string;
      };
      membershipStatus: {
        active: boolean;
        tier: string;
        verifiedDoctorBadge: boolean;
      };
      doctorNotes: string;
    }>('/subscriptions/report');
  },

  // AI Gynec & Period Coach
  async askAiCoach(message: string) {
    return apiRequest<{
      reply: string;
      title?: string;
      quickTips?: string[];
      category?: string;
      timestamp: string;
      disclaimer?: string;
    }>('/coach/chat', {
      method: 'POST',
      body: { message },
    });
  },

  // --- EMERGENCY PERIOD MODE ---
  async getNearbyToilets(lat: number, lng: number, radius = 3, limit = 20) {
    return apiRequest<{
      coordinates: { lat: number; lng: number };
      radiusKm: number;
      count: number;
      data: ToiletFacility[];
    }>(`/emergency/toilets/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`);
  },

  async searchToilets(query: string, limit = 20) {
    return apiRequest<{
      query: string;
      geocodedLocation?: string;
      count: number;
      data: ToiletFacility[];
    }>(`/emergency/toilets/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  },

  async getEmergencyProductCategories() {
    return apiRequest<{
      id: string;
      name: string;
      emoji: string;
      description: string;
    }[]>('/emergency/products/categories');
  },

  async getNearbyEmergencyProducts(
    lat?: number,
    lng?: number,
    area?: string,
    category?: string,
    radius = 10
  ) {
    const params = new URLSearchParams();
    if (lat != null && lng != null) {
      params.append('lat', String(lat));
      params.append('lng', String(lng));
    }
    if (area) params.append('area', area);
    if (category) params.append('category', category);
    if (radius) params.append('radius', String(radius));

    return apiRequest<{
      category: string;
      count: number;
      data: EmergencyProductShop[];
    }>(`/emergency/products/nearby?${params.toString()}`);
  },

  async getEmergencyShopDetails(shopId: string) {
    return apiRequest<EmergencyProductShop & { products: any[] }>(`/emergency/shops/${shopId}`);
  },

  async getEmergencyDeliveryAvailability(lat?: number, lng?: number, address?: string) {
    const params = new URLSearchParams();
    if (lat != null && lng != null) {
      params.append('lat', String(lat));
      params.append('lng', String(lng));
    }
    if (address) params.append('address', address);

    return apiRequest<EmergencyDeliveryAvailability>(`/emergency/delivery/availability?${params.toString()}`);
  },

  async getEmergencyDeliveryProducts() {
    return apiRequest<EmergencyDeliveryProduct[]>('/emergency/delivery/products');
  },

  async createEmergencyDeliveryOrder(body: {
    shopId: string;
    items: { id: string; qty: number }[];
    address: string;
    phone?: string;
    notes?: string;
    idempotencyKey?: string;
  }) {
    return apiRequest<EmergencyOrder>('/emergency/delivery/orders', {
      method: 'POST',
      body,
    });
  },

  async getEmergencyOrder(orderId: string) {
    return apiRequest<EmergencyOrder>(`/emergency/delivery/orders/${orderId}`);
  },

  async cancelEmergencyOrder(orderId: string, reason?: string) {
    return apiRequest<{
      id: string;
      orderNumber: string;
      status: string;
      message: string;
    }>(`/emergency/delivery/orders/${orderId}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  },

  // Evidence-Based AI Period Companion
  async askAiCompanion(params: {
    message: string;
    conversationId?: string | null;
    language?: 'en' | 'hi';
    useCycleHistory?: boolean;
    followUpAnswers?: Record<string, any>;
  }) {
    return apiRequest<AiCompanionResponse>('/ai-companion/chat', {
      method: 'POST',
      body: params,
    });
  },

  async getAiConversations() {
    return apiRequest<AiConversationSummary[]>('/ai-companion/conversations');
  },

  async getAiConversation(conversationId: string) {
    return apiRequest<AiConversationDetail>(`/ai-companion/conversations/${conversationId}`);
  },

  async deleteAiConversation(conversationId: string) {
    return apiRequest(`/ai-companion/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  },

  async getAiSources() {
    return apiRequest<AiSourceDetail[]>('/ai-companion/sources');
  },

  async getAiSourceById(sourceId: string) {
    return apiRequest<AiSourceDetail>(`/ai-companion/sources/${sourceId}`);
  },

  async getAiConsent() {
    return apiRequest<AiConsentSettings>('/ai-companion/consent');
  },

  async updateAiConsent(updates: Partial<AiConsentSettings>) {
    return apiRequest<AiConsentSettings>('/ai-companion/consent', {
      method: 'PATCH',
      body: updates,
    });
  },
};

export interface AiSourceCitation {
  id: string;
  title: string;
  organization: string;
  url: string;
  reviewDate?: string;
  topic?: string;
  summary?: string;
}

export interface AiCompanionResponse {
  conversationId: string;
  messageId?: string;
  reply: string;
  language: 'en' | 'hi';
  urgency: 'normal' | 'self_care' | 'doctor_visit' | 'emergency';
  isEmergency: boolean;
  redFlags: string[];
  sources: AiSourceCitation[];
  followUpQuestion?: string | null;
  followUpOptions?: string[];
  selfCareSteps?: string[];
  whenToSeeDoctor?: string[];
  cycleContextUsed: boolean;
  disclaimer: string;
  category?: string;
  quickTips?: string[];
  timestamp?: string;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  language: string;
  useCycleHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: Array<{
    id: string;
    sender: 'user' | 'assistant';
    content: string;
    urgency: string;
    redFlags: string[];
    sources: AiSourceCitation[];
    followUpQuestion?: string | null;
    followUpOptions?: string[];
    selfCareSteps?: string[];
    whenToSeeDoctor?: string[];
    createdAt: string;
  }>;
}

export interface AiSourceDetail {
  id: string;
  title: string;
  organization: string;
  url: string;
  topic: string;
  reviewStatus: string;
  reviewDate: string;
  summaryEn: string;
  summaryHi: string;
  keyPoints?: string[];
  emergencyFlags?: string[];
}

export interface AiConsentSettings {
  aiCycleConsent: boolean;
  aiLanguage: 'en' | 'hi';
}

export interface ToiletFacility {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  facilities: {
    wheelchair: boolean | null;
    fee: string | boolean | null;
    changingTable: boolean | null;
    gender: string | null;
    sanitaryDisposal: boolean | null;
  };
  openingHours: string | null;
  source: string;
  verified: boolean;
  lastUpdated?: string;
}

export interface EmergencyProductShop {
  id: string;
  name: string;
  address: string;
  area?: string;
  lat: number;
  lng: number;
  phone: string;
  distanceKm?: number;
  isPartner: boolean;
  hasDelivery: boolean;
  openingHours: string;
  isOpen: boolean;
  closingSoon?: boolean;
  supportedCategories: string[];
  availableProducts: {
    id: string;
    name: string;
    price: number;
    unit: string;
    category: string;
    emoji: string;
    inStock: boolean;
  }[];
}

export interface EmergencyDeliveryAvailability {
  available: boolean;
  message: string;
  servingShop?: {
    id: string;
    name: string;
    address: string;
    phone: string;
    distanceKm: number;
  } | null;
  deliveryFee: number;
  freeDeliveryThreshold?: number;
  estimatedMinutes?: number | null;
}

export interface EmergencyDeliveryProduct {
  id: string;
  name: string;
  category: string;
  tagline?: string;
  price: number;
  unit: string;
  emoji: string;
  badge?: string;
  inStock: boolean;
}

export interface EmergencyOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'accepted' | 'ready' | 'picked_up' | 'cancelled';
  items: {
    id: string;
    name: string;
    price: number;
    qty: number;
    unit?: string;
    category?: string;
    emoji?: string;
    lineTotal?: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  address: string;
  phone?: string;
  notes?: string;
  estimatedMinutes?: number;
  timeline: { step: string; time?: string; done: boolean }[];
  shop?: {
    id: string;
    name: string;
    address: string;
    phone: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}



