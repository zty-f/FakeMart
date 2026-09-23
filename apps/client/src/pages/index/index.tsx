import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { Category, MerchantSection, Product, SavingsOverview } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { ProductCard } from '../../components/ProductCard'
import { SafeImage } from '../../components/SafeImage'
import shoppingMascot from '../../assets/illustrations/shopping-mascot-cutout.webp'
import babyBottleIcon from '../../assets/ui/fluent/baby-bottle.webp'
import booksIcon from '../../assets/ui/fluent/books.webp'
import cameraIcon from '../../assets/ui/fluent/camera.webp'
import cartIcon from '../../assets/ui/fluent/cart.webp'
import couchIcon from '../../assets/ui/fluent/couch.webp'
import cupStrawIcon from '../../assets/ui/fluent/cup-straw.webp'
import dressIcon from '../../assets/ui/fluent/dress.webp'
import gridIcon from '../../assets/ui/fluent/grid.webp'
import lipstickIcon from '../../assets/ui/fluent/lipstick.webp'
import pawIcon from '../../assets/ui/fluent/paw.webp'
import soccerIcon from '../../assets/ui/fluent/soccer.webp'
import { addressShort } from '../../lib/address'
import { ensureAuth, formatMoney, request, sessionId, track } from '../../lib/api'
import './index.scss'

interface HomeShortcut extends Category {
  asset: string
  tone: string
  targetSlug?: string
}

interface CouponStats {
  available: number
  used: number
  expired: number
}

const HOME_CATEGORY_SHORTCUTS: HomeShortcut[] = [
  { id: 'quick-digital', name: '数码电器', slug: 'quick-digital', targetSlug: 'digital', icon: 'camera', asset: cameraIcon, tone: 'blue', description: '数码电器', sortOrder: 1 },
  { id: 'quick-beauty', name: '美妆护肤', slug: 'quick-beauty', targetSlug: 'beauty', icon: 'lipstick', asset: lipstickIcon, tone: 'pink', description: '美妆护肤', sortOrder: 2 },
  { id: 'quick-home', name: '家居日用', slug: 'quick-home', targetSlug: 'home', icon: 'couch', asset: couchIcon, tone: 'orange', description: '家居日用', sortOrder: 3 },
  { id: 'quick-fashion', name: '服饰鞋包', slug: 'quick-fashion', targetSlug: 'fashion', icon: 'dress', asset: dressIcon, tone: 'green', description: '服饰鞋包', sortOrder: 4 },
  { id: 'quick-food', name: '食品饮料', slug: 'quick-food', targetSlug: 'snacks', icon: 'drink', asset: cupStrawIcon, tone: 'yellow', description: '食品饮料', sortOrder: 5 },
  { id: 'quick-books', name: '图书文娱', slug: 'quick-books', targetSlug: 'books', icon: 'books', asset: booksIcon, tone: 'purple', description: '图书文娱', sortOrder: 6 },
  { id: 'quick-sport', name: '运动户外', slug: 'quick-sport', targetSlug: 'sport', icon: 'soccer', asset: soccerIcon, tone: 'cyan', description: '运动户外', sortOrder: 7 },
  { id: 'quick-baby', name: '母婴玩具', slug: 'quick-baby', icon: 'baby', asset: babyBottleIcon, tone: 'rose', description: '母婴玩具', sortOrder: 8 },
  { id: 'quick-pet', name: '宠物生活', slug: 'quick-pet', icon: 'paw', asset: pawIcon, tone: 'peach', description: '宠物生活', sortOrder: 9 },
  { id: 'all-category', name: '全部分类', slug: 'all', icon: 'grid', asset: gridIcon, tone: 'blue', description: '全部分类', sortOrder: 999 }
]

export default function Index() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shoppingSections, setShoppingSections] = useState<MerchantSection[]>([])
  const [foodSections, setFoodSections] = useState<MerchantSection[]>([])
  const [savings, setSavings] = useState<SavingsOverview | null>(null)
  const [couponStats, setCouponStats] = useState<CouponStats>({ available: 0, used: 0, expired: 0 })
  const [keyword, setKeyword] = useState('')

  async function load() {
    await ensureAuth()
    const [categoryResult, productResult, savingsResult, shoppingSectionResult, foodSectionResult, couponResult] = await Promise.all([
      request<{ categories: Category[] }>('/catalog/categories'),
      request<{ products: Product[] }>('/catalog/products?orderType=shopping&limit=18'),
      request<{ overview: SavingsOverview }>('/analytics/savings'),
      request<{ sections: MerchantSection[] }>('/catalog/merchant-sections?type=shopping&limit=8&productLimit=3'),
      request<{ sections: MerchantSection[] }>('/catalog/merchant-sections?type=food_delivery&limit=4&productLimit=3'),
      request<{ stats: CouponStats }>('/coupons/center')
    ])
    setCategories(categoryResult.categories)
    setProducts(productResult.products)
    setSavings(savingsResult.overview)
    setShoppingSections(shoppingSectionResult.sections)
    setFoodSections(foodSectionResult.sections)
    setCouponStats(couponResult.stats)
    track('page_view', { name: 'home' }, '/pages/index/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  async function search() {
    if (!keyword.trim()) return
    await track('search_submit', { term: keyword.trim() }, '/pages/index/index')
    Taro.removeStorageSync('fakemart_pending_category_id')
    Taro.removeStorageSync('fakemart_pending_merchant_id')
    Taro.removeStorageSync('fakemart_pending_merchant_name')
    Taro.setStorageSync('fakemart_pending_category_query', keyword.trim())
    Taro.navigateTo({ url: '/pages/category/index' })
  }

  async function addCart(product: Product) {
    await request('/cart/items', 'POST', { productId: product.id, quantity: 1, sessionId: sessionId() })
    await track('add_to_cart', { productId: product.id }, '/pages/index/index')
    Taro.showToast({ title: '已加入最爱', icon: 'success' })
  }

  function showDeveloping() {
    Taro.showToast({ title: '功能开发中', icon: 'none' })
  }

  function openCoupons() {
    Taro.navigateTo({ url: '/pages/coupons/index' })
  }

  function openCategory(category: Category) {
    if (category.slug === 'takeaway') {
      Taro.redirectTo({ url: '/pages/food/index' })
      return
    }
    if (category.slug === 'all') {
      Taro.removeStorageSync('fakemart_pending_category_id')
      Taro.removeStorageSync('fakemart_pending_category_query')
      Taro.removeStorageSync('fakemart_pending_merchant_id')
      Taro.removeStorageSync('fakemart_pending_merchant_name')
      Taro.navigateTo({ url: '/pages/category/index' })
      return
    }
    if (category.slug.startsWith('quick-')) {
      Taro.removeStorageSync('fakemart_pending_category_id')
      Taro.removeStorageSync('fakemart_pending_category_query')
      Taro.removeStorageSync('fakemart_pending_merchant_id')
      Taro.removeStorageSync('fakemart_pending_merchant_name')
      const targetSlug = 'targetSlug' in category ? category.targetSlug : undefined
      const resolvedCategoryId = category.id.startsWith('quick-')
        ? categories.find((item) => item.slug === targetSlug || item.name === category.name)?.id
        : category.id
      if (resolvedCategoryId) {
        Taro.setStorageSync('fakemart_pending_category_id', resolvedCategoryId)
      } else {
        Taro.setStorageSync('fakemart_pending_category_query', category.name)
      }
      Taro.navigateTo({ url: '/pages/category/index' })
      return
    }
    Taro.setStorageSync('fakemart_pending_category_id', category.id)
    Taro.removeStorageSync('fakemart_pending_category_query')
    Taro.removeStorageSync('fakemart_pending_merchant_id')
    Taro.removeStorageSync('fakemart_pending_merchant_name')
    Taro.navigateTo({ url: '/pages/category/index' })
  }

  function openStore(section: MerchantSection) {
    Taro.navigateTo({ url: `/pages/merchant/detail?id=${section.merchant.id}` })
  }

  const dealProducts = products.slice(0, 10)
  const recommendedProducts = products.slice(6, 18)
  const displayCategories = HOME_CATEGORY_SHORTCUTS.map((shortcut) => {
    const matched = categories.find((category) => category.name === shortcut.name || category.slug === shortcut.targetSlug || category.slug === shortcut.slug)
    return matched
      ? {
          ...matched,
          name: shortcut.name,
          slug: shortcut.slug,
          icon: shortcut.icon,
          asset: shortcut.asset,
          tone: shortcut.tone,
          targetSlug: shortcut.targetSlug
        }
      : shortcut
  })

  return (
    <View className='page homePage'>
      <View className='homeTopBar'>
        <View className='homeBrandCluster'>
          <View className='homeLogoStack'>
            <Text className='homeLogo'>假装购</Text>
            <Text className='homeLogoSub'>FakeMart</Text>
          </View>
          <View className='homeLocationPill'>
            <Text>送至</Text>
            <Text>{addressShort()}</Text>
          </View>
        </View>
        <View className='homeTopActions'>
          <View className='homeTopChip homeIconButton' onClick={() => Taro.redirectTo({ url: '/pages/cart/index' })}>
            <SafeImage className='homeTopActionIcon' src={cartIcon} mode='aspectFit' label='最爱' />
            <Text className='homeIconBadge'>9+</Text>
          </View>
          <View className='homeAvatar homeOrderButton' onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <Text>订单</Text>
          </View>
        </View>
      </View>

      <View className='homeHero'>
        <View className='homeHeroMain'>
          <View className='homeHeroCopy'>
            <Text className='homeHeroMiniBadge'>今日精选</Text>
            <View className='brandName'>
              <Text>今天想买的，</Text>
              <Text>都先逛一圈</Text>
            </View>
            <Text className='brandText'>好物、数码、家清、零食，一屏开逛。</Text>
          </View>
          <View className='homeHeroPreview'>
            <SafeImage className='homeHeroMascot' src={shoppingMascot} mode='aspectFit' label='假装购' />
            <Text className='homeHeroSticker'>今日精选</Text>
          </View>
        </View>
        <View className='searchBox'>
          <Input
            value={keyword}
            placeholder='搜索手机、耳机、奶茶、夜宵'
            confirmType='search'
            onInput={(event) => setKeyword(String(event.detail.value))}
            onConfirm={search}
          />
          <View className='searchButton' onClick={search}>
            <Text>搜索</Text>
          </View>
        </View>
        <View className='heroSavings'>
          <View>
            <Text className='heroSavingsLabel'>本月已省</Text>
            <Text className='heroSavingsValue'>{formatMoney(savings?.simulatedOrderSavings ?? 0)}</Text>
          </View>
          <View>
            <Text className='heroSavingsLabel'>今日守住</Text>
            <Text className='heroSavingsValue'>{formatMoney(savings?.estimatedTotalSavings ?? 0)}</Text>
          </View>
          <View>
            <Text className='heroSavingsLabel'>优惠券</Text>
            <Text className='heroSavingsValue'>{couponStats.available} 张</Text>
          </View>
          <View className='heroCouponCenter' onClick={openCoupons}>
            <Text className='heroSavingsLabel'>领券中心</Text>
            <Text className='heroCouponIcon'>券</Text>
          </View>
        </View>
      </View>

      <View className='homeCategoryPanel'>
        <View className='homeCategoryGrid'>
          {displayCategories.map((category) => (
            <View className='homeCategoryItem' key={category.id} onClick={() => openCategory(category)}>
              <View className={`homeCategoryIcon tone-${category.tone}`}>
                <SafeImage className='homeCategoryIconImage' src={category.asset} mode='aspectFit' label={category.name} />
              </View>
              <Text className='homeCategoryName'>{category.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='section homeDenseSection'>
        <View className='sectionHead dealSectionHead'>
          <View className='dealTitleRow'>
            <Text className='sectionTitle'>限时好价</Text>
            <Text className='flashMark'>⚡</Text>
            <Text className='dealTimer'>01:25:36</Text>
          </View>
          <Text className='muted' onClick={() => Taro.navigateTo({ url: '/pages/category/index' })}>更多</Text>
        </View>
        <View className='homeDealGrid'>
          {dealProducts.slice(0, 2).map((product, index) => (
            <DealCard product={product} key={product.id} onAddCart={addCart} index={index} />
          ))}
        </View>
      </View>

      <View className='homeBottomPromoGrid'>
        <View className='homeMiniPromo live' onClick={showDeveloping}>
          <Text>狂购直播</Text>
          <Text>主播优选好物</Text>
          <View>
            <Text>直播中</Text>
          </View>
        </View>
        <View className='homeMiniPromo coupon' onClick={openCoupons}>
          <Text>天天领券</Text>
          <Text>最高可领 ¥80</Text>
          <View>
            <Text>¥80</Text>
          </View>
        </View>
        <View className='homeMiniPromo mail' onClick={showDeveloping}>
          <Text>9.9 包邮</Text>
          <Text>好物低价抢</Text>
          <View>
            <Text>抢</Text>
          </View>
        </View>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>精选店铺</Text>
          <Text className='muted' onClick={() => Taro.navigateTo({ url: '/pages/category/index' })}>全部</Text>
        </View>
        <View className='homeStoreFeed'>
          {shoppingSections.map((section) => (
            <StoreCard section={section} key={section.merchant.id} onAddCart={addCart} onOpen={openStore} />
          ))}
        </View>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>附近好店</Text>
          <Text className='muted' onClick={() => Taro.redirectTo({ url: '/pages/food/index' })}>去点餐</Text>
        </View>
        <ScrollView className='nearbyStoreScroll' scrollX>
          <View className='nearbyStoreTrack'>
            {foodSections.map((section) => (
              <StoreCard section={section} key={section.merchant.id} onAddCart={addCart} onOpen={openStore} compact />
            ))}
          </View>
        </ScrollView>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>猜你喜欢</Text>
          <Text className='muted'>今日热度</Text>
        </View>
        <View className='productGrid'>
          {(recommendedProducts.length ? recommendedProducts : products).map((product) => (
            <ProductCard product={product} key={product.id} onAddCart={addCart} variant='grid' />
          ))}
        </View>
      </View>
      <BottomNav active='home' />
    </View>
  )
}

function distanceText(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`
  return `${meters}m`
}

function savedAmount(product: Product): number {
  return Math.max(product.compareAtPrice - product.virtualPrice, 0)
}

function DealCard({ product, onAddCart, index }: { product: Product; onAddCart: (product: Product) => void; index: number }) {
  return (
    <View className='dealCard' onClick={() => Taro.navigateTo({ url: `/pages/product/detail?id=${product.id}` })}>
      <SafeImage className='dealImage' src={product.imageUrl} mode='aspectFill' label={product.title} />
      <Text className={index === 0 ? 'dealRibbon hot' : 'dealRibbon top'}>{index === 0 ? '直降300' : '今日TOP'}</Text>
      <Text className='dealTitle'>{product.title}</Text>
      <Text className='dealSub'>{product.subtitle}</Text>
      <View className='dealFoot'>
        <View>
          <Text className='dealPrice'>{formatWholeMoney(product.virtualPrice)}</Text>
          <Text className='dealSave'>省 {formatMoney(savedAmount(product))}</Text>
        </View>
        <View
          className='dealAdd'
          onClick={(event) => {
            event.stopPropagation()
            onAddCart(product)
          }}
        >
          <Text>+</Text>
        </View>
      </View>
    </View>
  )
}

function formatWholeMoney(cents: number): string {
  return `¥${Math.round(cents / 100)}`
}

function StoreCard({
  section,
  onAddCart,
  onOpen,
  compact = false
}: {
  section: MerchantSection
  onAddCart: (product: Product) => void
  onOpen: (section: MerchantSection) => void
  compact?: boolean
}) {
  const merchant = section.merchant
  const isFood = merchant.type === 'food_delivery'

  return (
    <View className={compact ? 'homeStoreCard compact' : 'homeStoreCard'} onClick={() => onOpen(section)}>
      <View className='homeStoreHead'>
        <SafeImage className='homeStoreLogo' src={merchant.logoUrl} mode='aspectFill' label={merchant.name} />
        <View className='homeStoreInfo'>
          <View className='homeStoreTitleRow'>
            <Text className='homeStoreName'>{merchant.name}</Text>
            <Text className='homeStoreKind'>{isFood ? '外卖' : '店铺'}</Text>
          </View>
          <Text className='homeStoreMeta'>
            {merchant.rating.toFixed(1)}分 · 月售{section.monthlySales} · {merchant.deliveryMinutes}分钟 · {distanceText(section.distanceMeters)}
          </Text>
          <Text className='homeStoreFee'>
            {isFood ? `起送 ${formatMoney(merchant.minOrderAmount)} · 配送 ${formatMoney(merchant.deliveryFee)}` : '官方精选 · 快速发货'}
          </Text>
          <View className='homeStorePromos'>
            {section.promotionTags.slice(0, 3).map((tag) => <Text key={tag}>{tag}</Text>)}
          </View>
        </View>
      </View>
      <View className='storeProductRow'>
        {section.products.slice(0, 3).map((product) => (
          <View
            className='storeProductMini'
            key={product.id}
            onClick={(event) => {
              event.stopPropagation()
              Taro.navigateTo({ url: `/pages/product/detail?id=${product.id}` })
            }}
          >
            <SafeImage className='storeProductImage' src={product.imageUrl} mode='aspectFill' label={product.title} />
            <Text className='storeProductName'>{product.title}</Text>
            <View className='storeProductFoot'>
              <Text className='storeProductPrice'>{formatMoney(product.virtualPrice)}</Text>
              <View
                className='storeProductAdd'
                onClick={(event) => {
                  event.stopPropagation()
                  onAddCart(product)
                }}
              >
                <Text>+</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
