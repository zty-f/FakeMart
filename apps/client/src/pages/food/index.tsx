import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { Merchant, Order, Product } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { SafeImage } from '../../components/SafeImage'
import deliveryMascot from '../../assets/illustrations/delivery-mascot-cutout.webp'
import bentoIcon from '../../assets/ui/fluent/bento.webp'
import bubbleTeaIcon from '../../assets/ui/fluent/bubble-tea.webp'
import doughnutIcon from '../../assets/ui/fluent/doughnut.webp'
import hamburgerIcon from '../../assets/ui/fluent/hamburger.webp'
import hotBeverageIcon from '../../assets/ui/fluent/hot-beverage.webp'
import moonIcon from '../../assets/ui/fluent/moon.webp'
import shoppingBagsIcon from '../../assets/ui/fluent/shopping-bags.webp'
import starIcon from '../../assets/ui/fluent/star.webp'
import { addressShort, defaultAddress } from '../../lib/address'
import { ensureAuth, formatMoney, request, sessionId, track } from '../../lib/api'
import './index.scss'

const channelItems = [
  { label: '全部', icon: 'star', asset: starIcon, terms: [] },
  { label: '奶茶', icon: 'bubble-tea', asset: bubbleTeaIcon, terms: ['奶茶', '果茶', '下午茶'] },
  { label: '咖啡', icon: 'hot-beverage', asset: hotBeverageIcon, terms: ['咖啡', '轻食'] },
  { label: '美食', icon: 'hamburger', asset: hamburgerIcon, terms: ['炸鸡汉堡', '烧烤', '寿司', '热汤面', '早餐', '套餐'] },
  { label: '便当', icon: 'bento', asset: bentoIcon, terms: ['便当', '工作餐'] },
  { label: '夜宵', icon: 'moon', asset: moonIcon, terms: ['夜宵', '烧烤', '热汤面'] },
  { label: '甜品', icon: 'doughnut', asset: doughnutIcon, terms: ['甜品', '蛋糕', '烘焙'] }
]

const foodFilterChips = [
  { label: '全部', key: 'all' },
  { label: '附近商家', key: 'nearby' },
  { label: '30分钟内', key: 'fast' },
  { label: '满减优惠', key: 'discount' },
  { label: '评分最高', key: 'rating' }
] as const

const foodSortItems = [
  { label: '综合排序', key: 'smart' },
  { label: '距离最近', key: 'nearby' },
  { label: '销量最高', key: 'sales' },
  { label: '满减优惠', key: 'discount' }
] as const

type FoodFilterKey = (typeof foodFilterChips)[number]['key']
type FoodSortKey = (typeof foodSortItems)[number]['key'] | 'rating'

interface FoodStoreGroup {
  merchant: Merchant
  products: Product[]
  allProducts: Product[]
}

interface FoodOrderBadge {
  count: number
  status?: 'created' | 'active'
}

export default function FoodPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [allFoodProducts, setAllFoodProducts] = useState<Product[]>([])
  const [foodOrders, setFoodOrders] = useState<Order[]>([])
  const [keyword, setKeyword] = useState('')
  const [channel, setChannel] = useState('全部')
  const [filterKey, setFilterKey] = useState<FoodFilterKey>('all')
  const [sortKey, setSortKey] = useState<FoodSortKey>('smart')
  const [expandedMerchantId, setExpandedMerchantId] = useState('')

  async function load() {
    await ensureAuth()
    const [merchantResult, productResult, orderResult] = await Promise.all([
      request<{ merchants: Merchant[] }>('/food/merchants'),
      request<{ products: Product[] }>('/catalog/products?orderType=food_delivery&limit=100'),
      request<{ orders: Order[] }>('/orders?orderType=food_delivery')
    ])
    setMerchants(merchantResult.merchants)
    setAllFoodProducts(productResult.products)
    setFoodOrders(orderResult.orders)
    track('page_view', { name: 'food' }, '/pages/food/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  async function addCart(product: Product) {
    await request('/cart/items', 'POST', { productId: product.id, quantity: 1, sessionId: sessionId() })
    await track('add_to_cart', { productId: product.id, scene: 'food' }, '/pages/food/index')
    Taro.showToast({ title: '已加入最爱', icon: 'success' })
  }

  async function orderNow(product: Product) {
    const result = await request<{ order: { id: string } }>('/orders', 'POST', {
      orderType: 'food_delivery',
      items: [{ productId: product.id, quantity: 1 }],
      virtualPaymentMethod: '余额支付',
      virtualAddressLabel: defaultAddress()
    })
    await track('order_submit', { productId: product.id, orderType: 'food_delivery' }, '/pages/food/index')
    Taro.navigateTo({ url: `/pages/payment/index?id=${result.order.id}` })
  }

  async function submitSearch(value = keyword) {
    const term = value.trim()
    setKeyword(term)
    await track('search_submit', { term, scene: 'food' }, '/pages/food/index')
    if (term) {
      Taro.showToast({ title: '已筛选', icon: 'success' })
    }
  }

  async function selectChannel(item: string) {
    setChannel(item)
    setKeyword('')
    setFilterKey('all')
    setSortKey('smart')
    setExpandedMerchantId('')
    await track('food_channel_select', { channel: item }, '/pages/food/index')
    Taro.showToast({ title: item === '全部' ? '已显示全部' : `已筛选${item}`, icon: 'none' })
  }

  async function selectFilter(item: (typeof foodFilterChips)[number]) {
    setFilterKey(item.key)
    if (item.key === 'nearby' || item.key === 'discount' || item.key === 'rating') {
      setSortKey(item.key)
    }
    setExpandedMerchantId('')
    await track('food_filter_select', { filter: item.key, channel }, '/pages/food/index')
    Taro.showToast({ title: item.label, icon: 'none' })
  }

  async function selectSort(item: (typeof foodSortItems)[number]) {
    setSortKey(item.key)
    setExpandedMerchantId('')
    await track('food_sort_select', { sort: item.key, channel }, '/pages/food/index')
    Taro.showToast({ title: item.label, icon: 'none' })
  }

  function toggleStore(merchant: Merchant) {
    setExpandedMerchantId((current) => (current === merchant.id ? '' : merchant.id))
    track('food_store_toggle', { merchantId: merchant.id, channel }, '/pages/food/index')
  }

  const storeGroups = buildStoreGroups(merchants, allFoodProducts, channel, keyword, filterKey, sortKey)
  const orderBadge = foodOrderBadge(foodOrders)
  const valueProducts = allFoodProducts.slice(0, 4)

  function openFoodOrders() {
    const statusQuery = orderBadge.status ? `&status=${orderBadge.status}` : ''
    Taro.navigateTo({ url: `/pages/orders/index?type=food_delivery${statusQuery}` })
  }

  return (
    <View className='page foodPage'>
      <View className='foodTopBar'>
        <View className='foodBrandCluster'>
          <View className='foodLogoStack'>
            <Text className='foodLogo'>假装购</Text>
            <Text className='foodLogoSub'>FakeMart</Text>
          </View>
          <View className='foodLocationPill'>
            <Text>送至</Text>
            <Text>{addressShort()}</Text>
          </View>
        </View>
        <View className='foodTopOrder' onClick={openFoodOrders}>
          <SafeImage className='foodTopOrderIcon' src={shoppingBagsIcon} mode='aspectFit' label='订单' />
          <Text>订单</Text>
          {orderBadge.count > 0 && <Text className='foodTopOrderBadge'>{orderBadge.count > 99 ? '99+' : orderBadge.count}</Text>}
        </View>
      </View>

      <View className='foodHero'>
        <View className='foodHeroTop'>
          <View className='foodHeroCopy'>
            <Text className='foodTitle'>狂吃到家</Text>
            <Text className='foodText'>奶茶、咖啡、夜宵，想吃的现在就安排。</Text>
          </View>
          <View className='foodHeroVisual'>
            <SafeImage className='foodHeroMascot' src={deliveryMascot} mode='aspectFit' label='狂吃' />
            <Text className='foodHeroBubble'>吃饭啦!</Text>
          </View>
        </View>
        <View className='foodSearch'>
          <Input
            value={keyword}
            placeholder='搜索商家、奶茶、便当、夜宵'
            confirmType='search'
            onInput={(event) => setKeyword(String(event.detail.value))}
            onConfirm={(event) => submitSearch(String(event.detail.value))}
          />
          <View className='searchButton' onClick={() => submitSearch()}>
            <Text>搜索</Text>
          </View>
        </View>
      </View>

      <ScrollView className='foodChannels' scrollX>
        <View className='foodChannelTrack'>
          {channelItems.map((item) => (
            <View className={channel === item.label ? 'foodChannel active' : 'foodChannel'} key={item.label} onClick={() => selectChannel(item.label)}>
              <View className='foodChannelIcon'>
                <SafeImage className='foodChannelImage' src={item.asset} mode='aspectFit' label={item.label} />
              </View>
              <Text className='foodChannelName'>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className='foodFilterChips'>
        {foodFilterChips.map((item) => (
          <View className={filterKey === item.key ? 'foodFilterChip active' : 'foodFilterChip'} key={item.key} onClick={() => selectFilter(item)}>
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>

      <View className='foodValueStrip'>
        <View>
          <Text>超值套餐</Text>
          <Text>吃得好更省钱</Text>
        </View>
        <View className='foodValueProducts'>
          {valueProducts.map((product) => (
            <SafeImage className='foodValueImage' key={product.id} src={product.imageUrl} mode='aspectFill' label={product.title} />
          ))}
        </View>
        <Text>GO</Text>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>{keyword.trim() ? '搜索结果' : channel === '全部' ? '附近好店' : `${channel}好店`}</Text>
          <Text className='muted'>⚡ {fastestDelivery(merchants)} 分钟内送达</Text>
        </View>
        <View className='foodStoreSortRow'>
          {foodSortItems.map((item) => (
            <Text className={sortKey === item.key ? 'active' : ''} key={item.key} onClick={() => selectSort(item)}>{item.label}</Text>
          ))}
        </View>
        <View className='foodStoreFeed'>
          {storeGroups.length === 0 ? (
            <View className='empty'>没有找到想吃的，换个分类或关键词试试</View>
          ) : (
            storeGroups.map((group) => (
              <FoodStoreCard
                group={group}
                key={group.merchant.id}
                expanded={expandedMerchantId === group.merchant.id}
                onToggle={toggleStore}
                onAddCart={addCart}
                onOrder={orderNow}
              />
            ))
          )}
        </View>
      </View>
      <BottomNav active='food' />
    </View>
  )
}

function buildStoreGroups(
  merchants: Merchant[],
  products: Product[],
  channel: string,
  keyword: string,
  filterKey: FoodFilterKey,
  sortKey: FoodSortKey
): FoodStoreGroup[] {
  const term = keyword.trim()
  const channelConfig = channelItems.find((item) => item.label === channel)
  const channelTerms = channelConfig?.terms ?? []
  const groups = merchants
    .map((merchant) => {
      const allProducts = products.filter((product) => product.merchantId === merchant.id)
      const merchantText = [merchant.name, ...merchant.tags].join(' ')
      const matchedProducts = allProducts.filter((product) => {
        const productText = [product.title, product.subtitle, product.description, ...product.tags].join(' ')
        const matchesChannel =
          channel === '全部' ||
          channelTerms.some((termItem) => productText.includes(termItem) || merchantText.includes(termItem)) ||
          productText.includes(channel) ||
          merchantText.includes(channel)
        const matchesKeyword = !term || productText.includes(term) || merchantText.includes(term)
        return matchesChannel && matchesKeyword
      })
      const productsForMerchant = matchedProducts.length > 0 ? matchedProducts : channel === '全部' && !term ? allProducts : []
      return { merchant, products: productsForMerchant, allProducts }
    })
    .filter((group) => group.products.length > 0)

  const filteredGroups = groups.filter((group) => {
    if (filterKey === 'fast') return group.merchant.deliveryMinutes <= 30
    if (filterKey === 'discount') return group.products.some((product) => product.compareAtPrice > product.virtualPrice)
    return true
  })

  return sortStoreGroups(filteredGroups, sortKey)
}

function sortStoreGroups(groups: FoodStoreGroup[], sortKey: FoodSortKey): FoodStoreGroup[] {
  return [...groups].sort((a, b) => {
    if (sortKey === 'nearby') return distanceMeters(a.merchant) - distanceMeters(b.merchant)
    if (sortKey === 'sales') return monthlySales(b) - monthlySales(a)
    if (sortKey === 'discount') return discountAmount(b) - discountAmount(a)
    if (sortKey === 'rating') return b.merchant.rating - a.merchant.rating || a.merchant.deliveryMinutes - b.merchant.deliveryMinutes
    return b.merchant.rating - a.merchant.rating || a.merchant.deliveryMinutes - b.merchant.deliveryMinutes
  })
}

function foodOrderBadge(orders: Order[]): FoodOrderBadge {
  const toPay = orders.filter((order) => order.status === 'created').length
  if (toPay > 0) return { count: toPay, status: 'created' }
  const active = orders.filter((order) => !['created', 'completed', 'cancelled'].includes(order.status)).length
  if (active > 0) return { count: active, status: 'active' }
  return { count: orders.length }
}

function fastestDelivery(merchants: Merchant[]): number {
  if (merchants.length === 0) return 30
  return Math.min(...merchants.map((merchant) => merchant.deliveryMinutes))
}

function monthlySales(group: FoodStoreGroup): number {
  const total = group.allProducts.reduce((sum, product) => sum + product.virtualSalesCount, 0)
  return Math.max(300, Math.round(total / 7))
}

function distanceText(merchant: Merchant): string {
  const meters = distanceMeters(merchant)
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
}

function distanceMeters(merchant: Merchant): number {
  const seed = merchant.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return 420 + (seed % 2800)
}

function discountAmount(group: FoodStoreGroup): number {
  return group.products.reduce((sum, product) => sum + Math.max(product.compareAtPrice - product.virtualPrice, 0), 0)
}

function FoodStoreCard({
  group,
  expanded,
  onToggle,
  onAddCart,
  onOrder
}: {
  group: FoodStoreGroup
  expanded: boolean
  onToggle: (merchant: Merchant) => void
  onAddCart: (product: Product) => void
  onOrder: (product: Product) => void
}) {
  const merchant = group.merchant
  const featuredProduct = group.products[0]
  const visibleProducts = group.products.slice(0, expanded ? 8 : 2)

  return (
    <View className='foodStoreCard' onClick={() => Taro.navigateTo({ url: `/pages/merchant/detail?id=${merchant.id}` })}>
      <View className='foodStoreHead'>
        <SafeImage className='foodStoreCover' src={featuredProduct?.imageUrl || merchant.logoUrl} mode='aspectFill' label={featuredProduct?.title || merchant.name} />
        <View className='foodStoreInfo'>
          <View className='foodStoreNameRow'>
            <Text className='foodStoreName'>{merchant.name}</Text>
            <Text className='foodStoreBadge'>{merchant.rating.toFixed(1)}分</Text>
          </View>
          <Text className='foodStoreMeta'>
            月售{monthlySales(group)} · {merchant.deliveryMinutes}分钟 · {distanceText(merchant)}
          </Text>
          <Text className='foodStoreMeta'>起送 {formatMoney(merchant.minOrderAmount)} · 配送 {formatMoney(merchant.deliveryFee)}</Text>
          <Text className='foodStoreDealLine'>{featuredProduct ? `${featuredProduct.title} 等 ${group.products.length} 款` : '今日热卖套餐'}</Text>
          <View className='foodStoreTags'>
            {merchant.tags.slice(0, 3).map((tag) => <Text key={tag}>{tag}</Text>)}
          </View>
        </View>
        <Text className='foodStoreToggle'>进店</Text>
      </View>

      <View className='foodStoreCouponRow'>
        {group.products.slice(0, 3).map((product) => (
          <View
            className='foodStoreCoupon'
            key={product.id}
            onClick={(event) => {
              event.stopPropagation()
              Taro.navigateTo({ url: `/pages/product/detail?id=${product.id}` })
            }}
          >
            <Text>{product.tags[0] || '热卖'}</Text>
            <Text>{formatMoney(product.virtualPrice)}</Text>
          </View>
        ))}
      </View>

      <View className={expanded ? 'foodProductList expanded' : 'foodProductList'}>
        {visibleProducts.map((product) => (
          <FoodProductCard product={product} key={product.id} expanded={expanded} onAddCart={onAddCart} onOrder={onOrder} />
        ))}
      </View>

      {group.products.length > 3 && (
        <View
          className='foodStoreMore'
          onClick={(event) => {
            event.stopPropagation()
            onToggle(merchant)
          }}
        >
          <Text>{expanded ? '收起菜单' : `展开 ${group.products.length} 款商品`}</Text>
        </View>
      )}
    </View>
  )
}

function FoodProductCard({
  product,
  expanded,
  onAddCart,
  onOrder
}: {
  product: Product
  expanded: boolean
  onAddCart: (product: Product) => void
  onOrder: (product: Product) => void
}) {
  return (
    <View
      className={expanded ? 'foodProductCard expanded' : 'foodProductCard'}
      onClick={(event) => {
        event.stopPropagation()
        Taro.navigateTo({ url: `/pages/product/detail?id=${product.id}` })
      }}
    >
      <SafeImage className='foodProductImage' src={product.imageUrl} mode='aspectFill' label={product.title} />
      <View className='foodProductBody'>
        <Text className='foodProductTitle'>{product.title}</Text>
        <Text className='foodProductSub'>{product.subtitle}</Text>
        <View className='foodProductTags'>
          {product.tags.slice(0, expanded ? 3 : 2).map((tag) => <Text key={tag}>{tag}</Text>)}
        </View>
        <View className='foodProductFoot'>
          <Text className='foodProductPrice'>{formatMoney(product.virtualPrice)}</Text>
          <View className='foodProductActions'>
            {expanded && (
              <View
                className='foodMiniButton secondary'
                onClick={(event) => {
                  event.stopPropagation()
                  onAddCart(product)
                }}
              >
                <Text>加购</Text>
              </View>
            )}
            <View
              className='foodMiniButton primary'
              onClick={(event) => {
                event.stopPropagation()
                onOrder(product)
              }}
            >
              <Text>点餐</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
