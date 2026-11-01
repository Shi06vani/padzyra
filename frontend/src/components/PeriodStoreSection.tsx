import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from './Card';
import { PadzyraApi } from '../api/client';

export interface EssentialItem {
  id: string;
  category: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  icon?: string;
  emoji?: string;
  imageUrl?: string;
  badge: string;
  badgeColor: string;
  unit: string;
  sizes?: string[];
  inStock: boolean;
}

export const DEFAULT_ESSENTIALS: EssentialItem[] = [
  // Dark Chocolates & PMS Treats
  {
    id: 'prod-dark-choco-70',
    category: 'chocolate',
    name: '70% Dark Belgian Chocolate Bar',
    tagline: 'High magnesium for natural cramp relief',
    description: 'Rich in polyphenols, flavonoids, and magnesium that reduce prostaglandin levels to ease uterine spasms and elevate dopamine during PMS.',
    price: 90,
    icon: 'nutrition-outline',
    imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=400&q=80',
    badge: 'Magnesium Rich',
    badgeColor: '#5c3d2e',
    unit: '80g Bar',
    inStock: true,
  },
  {
    id: 'prod-pms-almond-bar',
    category: 'chocolate',
    name: 'Roasted Almond & Sea Salt Cacao Bar',
    tagline: 'Satisfies intense sweet & salty cravings',
    description: 'Perfect balance of organic cacao and crunchy almonds. Replenishes healthy fats and curbs luteal phase hunger spikes.',
    price: 75,
    icon: 'cube-outline',
    imageUrl: 'https://images.unsplash.com/photo-1548741487-18d16a1a083c?auto=format&fit=crop&w=400&q=80',
    badge: 'PMS Craving Fix',
    badgeColor: '#8d5b4c',
    unit: '60g Bar',
    inStock: true,
  },

  // Hot Water Bag & Heat Therapy
  {
    id: 'prod-hot-water-bottle',
    category: 'heat',
    name: 'Plush Velvet Hot Water Bag',
    tagline: 'Instant soothing warmth for abdominal cramps',
    description: '2-Litre high-grade leakproof rubber with an ultra-soft washable velvet fleece cover. Keeps heat for up to 6 hours to relax pelvic muscles.',
    price: 199,
    icon: 'flame-outline',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
    badge: 'Top Cramp Reliever',
    badgeColor: '#b71c1c',
    unit: '2 Litre Bag + Cover',
    inStock: true,
  },
  {
    id: 'prod-heating-patches',
    category: 'heat',
    name: 'Herbal Self-Heating Cramp Patches',
    tagline: 'Discreet 8-hour heat under clothes',
    description: 'Air-activated warming patches with ginger, eucalyptus and wormwood. Stick directly to panties for invisible on-the-go relief at work or college.',
    price: 149,
    icon: 'thermometer-outline',
    imageUrl: 'https://images.unsplash.com/photo-1512290900672-1f55a1534f37?auto=format&fit=crop&w=400&q=80',
    badge: '8-Hr Portable Heat',
    badgeColor: '#d84315',
    unit: 'Pack of 3 Patches',
    inStock: true,
  },

  // Menstrual Cups & Tampons
  {
    id: 'prod-menstrual-cup',
    category: 'cup',
    name: 'Medical-Grade Silicone Menstrual Cup',
    tagline: '100% leakproof, zero rash, 12-hr freedom',
    description: 'Ultra-soft, BPA-free US FDA approved medical silicone. Reusable for up to 5 years. Available in Small (teens/light flow), Medium (regular), and Large (heavy flow).',
    price: 299,
    icon: 'water-outline',
    imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
    badge: '5-Year Reusable',
    badgeColor: '#880e4f',
    unit: '1 Cup + Breathable Pouch',
    sizes: ['Small', 'Medium', 'Large'],
    inStock: true,
  },
  {
    id: 'prod-cup-sterilizer',
    category: 'cup',
    name: 'Menstrual Cup Wash & Sterilizer',
    tagline: '100% plant-based antibacterial formula',
    description: 'Gentle, pH-balanced foaming wash cleans silicone cups and discs without degrading the material. Keeps your cup odor-free and hygienic.',
    price: 179,
    icon: 'shield-checkmark-outline',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80',
    badge: 'Antibacterial',
    badgeColor: '#4a148c',
    unit: '100ml Pump Bottle',
    inStock: true,
  },
  {
    id: 'prod-organic-tampons',
    category: 'tampons',
    name: 'Organic Cotton Tampons with Applicator',
    tagline: 'Chlorine-free, zero perfume, easy insertion',
    description: '100% certified organic cotton tampons with smooth cardboard applicator. Compact and pocket-friendly for swimming, sports, and active days.',
    price: 160,
    icon: 'medical-outline',
    imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=400&q=80',
    badge: 'Zero Synthetics',
    badgeColor: '#ad1457',
    unit: 'Pack of 8 Tampons',
    sizes: ['Regular', 'Super'],
    inStock: true,
  },

  // Pads & Pantyliners
  {
    id: 'prod-day-pads-ultra',
    category: 'pads',
    name: 'Ultra-Thin Day Pads with Wings',
    tagline: 'Breathable cottony-soft feel for work & study',
    description: '240mm length with gel-lock core and side leak guards. Completely rash-free and discreetly wrapped.',
    price: 35,
    icon: 'shield-outline',
    imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=400&q=80',
    badge: 'Day Protection',
    badgeColor: '#c2185b',
    unit: 'Pack of 2 Pads',
    sizes: ['Regular (240mm)', 'XL (280mm)'],
    inStock: true,
  },
  {
    id: 'prod-night-pads-xxl',
    category: 'pads',
    name: 'XXL Heavy Flow Overnight Pads',
    tagline: 'Wide fan back for 360° stain-free sleep',
    description: '320mm extra-long night pads with deep absorbent channels that lock heavy flow and prevent back staining in any sleeping position.',
    price: 45,
    icon: 'moon-outline',
    imageUrl: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=400&q=80',
    badge: 'Overnight Guard',
    badgeColor: '#4a148c',
    unit: 'Pack of 2 Pads',
    sizes: ['XXL (320mm)'],
    inStock: true,
  },
  {
    id: 'prod-bamboo-pads',
    category: 'pads',
    name: '100% Organic Bamboo Cotton Pads',
    tagline: 'Naturally hypoallergenic and antibacterial',
    description: 'Made from sustainably harvested bamboo fiber. 3x more absorbent than regular cotton and naturally anti-odor for sensitive skin.',
    price: 60,
    icon: 'leaf-outline',
    imageUrl: 'https://images.unsplash.com/photo-1546554137-f86b9593a222?auto=format&fit=crop&w=400&q=80',
    badge: 'Sensitive Skin',
    badgeColor: '#2e7d32',
    unit: 'Pack of 2 Pads',
    inStock: true,
  },
  {
    id: 'prod-pantyliners',
    category: 'pads',
    name: 'Daily Cotton Breathable Pantyliners',
    tagline: 'For ovulation discharge, spotting & cup backup',
    description: 'Feather-light 155mm breathable liners. Keeps you fresh all day during ovulation discharge or when your flow is ending.',
    price: 75,
    icon: 'flower-outline',
    imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80',
    badge: 'Daily Freshness',
    badgeColor: '#00695c',
    unit: 'Pack of 20 Liners',
    inStock: true,
  },

  // Cramp Roll-Ons & Herbal Teas
  {
    id: 'prod-cramp-rollon',
    category: 'relief',
    name: 'Ayurvedic Cramp Relief Roll-On',
    tagline: 'Instant cooling botanical relief on skin',
    description: 'Enriched with peppermint oil, eucalyptus, and wintergreen. Absorbs within 30 seconds to numb throbbing pelvic and lower back cramps.',
    price: 129,
    icon: 'bandage-outline',
    imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
    badge: 'Fast Acting',
    badgeColor: '#1b5e20',
    unit: '10ml Roll-On',
    inStock: true,
  },
  {
    id: 'prod-cramp-tea',
    category: 'relief',
    name: 'Chamomile & Ginger Cramp Ease Tea',
    tagline: 'Warm herbal infusion that soothes spasms',
    description: 'Caffeine-free therapeutic blend of chamomile, dried ginger root, fennel seeds, and spearmint. Relaxes smooth muscles and reduces gas bloating.',
    price: 140,
    icon: 'cafe-outline',
    imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=400&q=80',
    badge: 'Caffeine Free',
    badgeColor: '#33691e',
    unit: '15 Pyramid Tea Bags',
    inStock: true,
  },

  // Intimate Hygiene & Care
  {
    id: 'prod-intimate-wash',
    category: 'hygiene',
    name: 'pH 3.5 Gentle Intimate Wash',
    tagline: 'Maintains healthy vaginal microflora',
    description: 'Infused with tea tree oil, aloe vera, and lactic acid. Free of parabens and harsh sulphates. Prevents bacterial irritation during periods.',
    price: 125,
    icon: 'sparkles-outline',
    imageUrl: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=400&q=80',
    badge: 'pH 3.5 Balanced',
    badgeColor: '#00838f',
    unit: '100ml Bottle',
    inStock: true,
  },
  {
    id: 'prod-intimate-wipes',
    category: 'hygiene',
    name: 'Biodegradable Soothing Intimate Wipes',
    tagline: 'Mess-free freshness when changing pads outside',
    description: '100% viscose biodegradable wipes soaked in chamomile and aloe water. Hypoallergenic, alcohol-free, and safe for intimate skin.',
    price: 60,
    icon: 'documents-outline',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
    badge: 'Flushable & Soft',
    badgeColor: '#004d40',
    unit: 'Pack of 10 Wipes',
    inStock: true,
  },

  // All-in-One Care Kits
  {
    id: 'prod-emergency-care-kit',
    category: 'kits',
    name: 'Complete SOS Period Comfort Box',
    tagline: 'Pads + Hot Patch + Dark Chocolate + Pouch',
    description: 'The ultimate emergency rescue box! Contains: 2x Day Pads + 1x Night Pad + 1x Self-Heating Patch + 1x Dark Chocolate Bar + 1x Herbal Tea + Discreet Pouch.',
    price: 249,
    icon: 'briefcase-outline',
    imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=400&q=80',
    badge: 'Complete Comfort',
    badgeColor: '#6a1b9a',
    unit: 'Full Rescue Box',
    inStock: true,
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'All Essentials', icon: 'grid-outline' },
  { id: 'chocolate', label: 'Dark Chocolate', icon: 'nutrition-outline' },
  { id: 'heat', label: 'Heat Therapy', icon: 'flame-outline' },
  { id: 'cup', label: 'Menstrual Cups', icon: 'water-outline' },
  { id: 'pads', label: 'Pads & Liners', icon: 'shield-outline' },
  { id: 'tampons', label: 'Organic Tampons', icon: 'medical-outline' },
  { id: 'relief', label: 'Cramp Relief', icon: 'bandage-outline' },
  { id: 'hygiene', label: 'Intimate Care', icon: 'sparkles-outline' },
  { id: 'kits', label: 'Care Boxes & Kits', icon: 'briefcase-outline' },
];

interface PeriodStoreSectionProps {
  onOrderItem: (item: EssentialItem, variant?: string, qty?: number) => void;
  nearestShopName?: string;
}

export const PeriodStoreSection: React.FC<PeriodStoreSectionProps> = ({
  onOrderItem,
  nearestShopName,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [items, setItems] = useState<EssentialItem[]>(DEFAULT_ESSENTIALS);
  const [loading, setLoading] = useState<boolean>(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Per-item state tracking (size/variant & quantity)
  const [itemVariants, setItemVariants] = useState<Record<string, string>>({
    'prod-menstrual-cup': 'Medium',
    'prod-organic-tampons': 'Regular',
    'prod-day-pads-ultra': 'Regular (240mm)',
    'prod-night-pads-xxl': 'XXL (320mm)',
  });

  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    async function fetchCatalog() {
      try {
        setLoading(true);
        const res = await PadzyraApi.getEssentialsCatalog(
          selectedCategory === 'all' ? undefined : selectedCategory
        );
        if (mounted && res?.items && res.items.length > 0) {
          // Merge with fallback imageUrls if missing from API
          const merged = res.items.map((it: EssentialItem) => {
            const fallback = DEFAULT_ESSENTIALS.find((d) => d.id === it.id);
            return {
              ...it,
              imageUrl: it.imageUrl || fallback?.imageUrl,
            };
          });
          setItems(merged);
        }
      } catch {
        // Fallback to local items filtered by category
        if (mounted) {
          if (selectedCategory === 'all') {
            setItems(DEFAULT_ESSENTIALS);
          } else {
            setItems(DEFAULT_ESSENTIALS.filter((it) => it.category === selectedCategory));
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchCatalog();
    return () => {
      mounted = false;
    };
  }, [selectedCategory]);

  const handleSelectVariant = (itemId: string, variant: string) => {
    setItemVariants((prev) => ({ ...prev, [itemId]: variant }));
  };

  const handleAdjustQty = (itemId: string, delta: number) => {
    setItemQuantities((prev) => {
      const current = prev[itemId] || 1;
      const next = Math.max(1, Math.min(6, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const handleImageError = (itemId: string) => {
    setImageErrors((prev) => ({ ...prev, [itemId]: true }));
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.tagline.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {nearestShopName ? (
        <View style={styles.nearestShopBar}>
          <Ionicons name="location" size={14} color={colors.plum} style={{ marginRight: 6 }} />
          <Text style={styles.nearestShopText}>
            Counter pickup ready at: <Text style={{ fontWeight: '800' }}>{nearestShopName}</Text>
          </Text>
        </View>
      ) : null}

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.rose} style={{ marginLeft: 14 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pads, chocolates, hot water bag, cup..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 10 }}>
            <Ionicons name="close-circle" size={18} color={colors.rose} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScroll}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={isSelected ? colors.white : colors.plum}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  isSelected && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Product List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={colors.plum} />
          <Text style={styles.loaderText}>Loading essentials...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="search-outline" size={36} color={colors.rose} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>No matching products</Text>
          <Text style={styles.emptySubtitle}>Try searching for "chocolate", "cup", or "hot water bag"</Text>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
          >
            <Text style={styles.resetBtnText}>View All Essentials</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        filteredItems.map((item) => {
          const selectedVariant = itemVariants[item.id] || (item.sizes ? item.sizes[0] : undefined);
          const qty = itemQuantities[item.id] || 1;
          const totalPrice = item.price * qty;
          const hasImage = item.imageUrl && !imageErrors[item.id];

          return (
            <View key={item.id} style={styles.productCard}>
              {/* Product Top Header: Image on Left + Info on Right */}
              <View style={styles.productHeader}>
                {/* Product Image */}
                <View style={styles.imageContainer}>
                  {hasImage ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.productImage}
                      resizeMode="cover"
                      onError={() => handleImageError(item.id)}
                    />
                  ) : (
                    <View style={[styles.productIconBox, { backgroundColor: `${item.badgeColor || colors.plum}15` }]}>
                      <Ionicons
                        name={(item.icon || 'shield-outline') as any}
                        size={28}
                        color={item.badgeColor || colors.plum}
                      />
                    </View>
                  )}
                  {item.badge ? (
                    <View style={[styles.imageBadge, { backgroundColor: item.badgeColor || colors.plum }]}>
                      <Text style={styles.imageBadgeText} numberOfLines={1}>
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Product Main Info */}
                <View style={styles.productInfo}>
                  <View style={styles.stockRow}>
                    <View style={styles.stockPill}>
                      <View style={styles.greenDot} />
                      <Text style={styles.stockText}>In Stock</Text>
                    </View>
                    <Text style={styles.unitText}>{item.unit}</Text>
                  </View>

                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productTagline} numberOfLines={2}>
                    {item.tagline}
                  </Text>
                </View>
              </View>

              {/* Variant / Size Selector (if applicable) */}
              {item.sizes && item.sizes.length > 0 && (
                <View style={styles.sizeSection}>
                  <Text style={styles.sizeSectionLabel}>Size / Option:</Text>
                  <View style={styles.sizePillsRow}>
                    {item.sizes.map((sz) => {
                      const isSzSelected = selectedVariant === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          style={[styles.sizePill, isSzSelected && styles.sizePillActive]}
                          onPress={() => handleSelectVariant(item.id, sz)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.sizePillText, isSzSelected && styles.sizePillTextActive]}>
                            {sz}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Pricing, Quantity & Buy Action Row */}
              <View style={styles.cardFooter}>
                <View style={styles.priceContainer}>
                  <View style={styles.priceRow}>
                    <Text style={styles.currencySym}>₹</Text>
                    <Text style={styles.priceNum}>{totalPrice}</Text>
                    {qty > 1 && (
                      <Text style={styles.perUnitText}> (₹{item.price} each)</Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionRight}>
                  {/* Quantity Controls */}
                  <View style={styles.qtyControlRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => handleAdjustQty(item.id, -1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={13} color={colors.plum} />
                    </TouchableOpacity>
                    <Text style={styles.qtyNumber}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => handleAdjustQty(item.id, 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={13} color={colors.plum} />
                    </TouchableOpacity>
                  </View>

                  {/* Buy / Discreet Order Button */}
                  <TouchableOpacity
                    style={styles.buyBtn}
                    onPress={() => onOrderItem(item, selectedVariant, qty)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="flash" size={13} color={colors.white} style={{ marginRight: 4 }} />
                    <Text style={styles.buyBtnText}>Quick Buy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  nearestShopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ebf3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  nearestShopText: {
    fontSize: 12,
    color: colors.plum,
    flex: 1,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ecdbe6',
    marginBottom: 12,
    shadowColor: '#6b3d62',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },

  // Categories
  categoriesScroll: {
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ecdbe6',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  categoryChipTextActive: {
    color: colors.white,
  },

  // Loader
  loaderWrap: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  loaderText: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 8,
    fontWeight: '600',
  },

  // Empty state
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 4,
    textAlign: 'center',
  },
  resetBtn: {
    marginTop: 12,
    backgroundColor: colors.plum,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  // Product Card - Clean, Clear, Modern Design
  productCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ecdbe6',
    shadowColor: '#6b3d62',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageContainer: {
    width: 86,
    height: 86,
    borderRadius: 12,
    backgroundColor: '#faf4f8',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#f2e5ed',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productIconBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBadgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  stockText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
  },
  unitText: {
    fontSize: 11,
    color: '#8b5e7c',
    fontWeight: '600',
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 18,
    marginTop: 1,
  },
  productTagline: {
    fontSize: 11,
    color: '#7a5a70',
    fontWeight: '500',
    lineHeight: 15,
    marginTop: 2,
  },

  // Size Selector
  sizeSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f7edf3',
  },
  sizeSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.rose,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sizePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizePill: {
    backgroundColor: '#fbf5f9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ecdbe6',
  },
  sizePillActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  sizePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  sizePillTextActive: {
    color: colors.white,
  },

  // Footer & Buy Action
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f7edf3',
  },
  priceContainer: {
    flexDirection: 'column',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySym: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  priceNum: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.ink,
  },
  perUnitText: {
    fontSize: 10,
    color: colors.rose,
    fontWeight: '600',
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbf5f9',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#ecdbe6',
  },
  qtyBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 6,
  },
  qtyNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    paddingHorizontal: 7,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plum,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  buyBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
});
