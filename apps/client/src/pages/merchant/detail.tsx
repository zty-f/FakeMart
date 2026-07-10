import { Text, View } from '@tarojs/components'
import Taro, { getCurrentInstance, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import type { Merchant, Product, ReviewFeedItem, ReviewSummary } from '@fakemart/shared'
import { SafeImage } from '../../components/SafeImage'
import { defaultAddress } from '../../lib/address'
import { ensureAuth, formatMoney, request, sessionId, track } from '../../lib/api'
import './detail.scss'

export default function MerchantDetail() {
  const id = getCurrentInstance().router?.params.id ?? ''
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<ReviewFeedItem[]>([])
  const [followed, setFollowed] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  useLoad(() => {
    load().catch((error) => console.warn(error))
  })

  async function load() {
    await ensureAuth()
    const [merchantResult, reviewResult, followResult] = await Promise.all([
      request<{ merchant: Merchant; products: Product[] }>(`/catalog/merchants/${id}`),
      request<{ summary: ReviewSummary; reviews: ReviewFeedItem[] }>(`/reviews/merchants/${id}?limit=30`),
      request<{ followed: boolean }>(`/merchant-follows/${id}/status`)
    ])
    setMerchant(merchantResult.merchant)
    setProducts(merchantResult.products)
    setSummary(reviewResult.summary)
    setReviews(reviewResult.reviews)
    setFollowed(followResult.followed)
    await track('merchant_detail_view', { merchantId: id }, '/pages/merchant/detail')
  }

  async function addCart(product: Product) {
    await request('/cart/items', 'POST', { productId: product.id, quantity: 1, sessionId: sessionId() })
    await track('add_to_cart', { productId: product.id, merchantId: product.merchantId }, '/pages/merchant/detail')
    Taro.showToast({ title: '已加入最爱', icon: 'success' })
  }

  async function orderNow(product: Product) {
    const result = await request<{ order: { id: string } }>('/orders', 'POST', {
      orderType: product.orderType,
      items: [{ productId: product.id, quantity: 1 }],
      virtualPaymentMethod: '余额支付',
      virtualAddressLabel: defaultAddress()
    })
    await track('order_submit', { productId: product.id, merchantId: product.merchantId, orderType: product.orderType }, '/pages/merchant/detail')
    Taro.navigateTo({ url: `/pages/payment/index?id=${result.order.id}` })
  }

  async function toggleFollow() {
    if (!merchant || followBusy) return
    setFollowBusy(true)
    try {
      if (followed) {
        await request(`/merchant-follows/${merchant.id}`, 'DELETE')
        setFollowed(false)
        Taro.showToast({ title: '已取消关注', icon: 'success' })
      } else {
        await request(`/merchant-follows/${merchant.id}`, 'POST')
        setFollowed(true)
        Taro.showToast({ title: '已关注店铺', icon: 'success' })
      }
      await track('merchant_follow_toggle', { merchantId: merchant.id, followed: !followed }, '/pages/merchant/detail')
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
    } finally {
      setFollowBusy(false)
    }
  }

  function backOrHome() {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
      return
    }
    Taro.redirectTo({ url: '/pages/index/index' })
  }

  if (!merchant) return <View className='page'><View className='empty'>加载中...</View></View>

  const featured = products[0]

  return (
    <View className='page merchantPage'>
      <View className='merchantHero'>
        <SafeImage className='merchantHeroBg' src={featured?.imageUrl || merchant.logoUrl} mode='aspectFill' label={merchant.name} />
        <View className='merchantHeroShade' />
        <View className='merchantHeroContent'>
          <SafeImage className='merchantLogo' src={merchant.logoUrl} mode='aspectFill' label={merchant.name} />
          <View>
            <Text className='merchantName'>{merchant.name}</Text>
            <Text className='merchantMeta'>
              {merchant.type === 'food_delivery' ? `${merchant.deliveryMinutes}分钟送达 · 起送 ${formatMoney(merchant.minOrderAmount)}` : '官方精选 · 快速发货'}
            </Text>
            <View className='merchantTags'>
              {merchant.tags.slice(0, 4).map((tag) => <Text key={tag}>{tag}</Text>)}
            </View>
          </View>
          <View className={followed ? 'merchantFollowButton followed' : 'merchantFollowButton'} onClick={toggleFollow}>
            <Text>{followBusy ? '...' : followed ? '已关注' : '关注'}</Text>
          </View>
        </View>
      </View>

      <View className='merchantStats panel'>
        <View>
          <Text>{summary?.count ? summary.averageRating.toFixed(1) : merchant.rating.toFixed(1)}</Text>
          <Text>店铺评分</Text>
        </View>
        <View>
          <Text>{summary?.count ?? 0}</Text>
          <Text>历史评价</Text>
        </View>
        <View>
          <Text>{products.length}</Text>
          <Text>在售商品</Text>
        </View>
      </View>

      <View className='section panel merchantReviewPanel'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>店铺评价</Text>
          <Text className='muted'>{summary?.count ?? 0} 条</Text>
        </View>
        <View className='merchantReviewScore'>
          <Text>{summary?.count ? starsText(Math.round(summary.averageRating)) : '☆☆☆☆☆'}</Text>
          <Text>{summary?.count ? '来自已完成订单的历史评价' : '还没有用户评价这家店'}</Text>
        </View>
        {(summary?.topTags.length ?? 0) > 0 && (
          <View className='merchantReviewTags'>
            {summary?.topTags.map((item) => <Text key={item.tag}>{item.tag} {item.count}</Text>)}
          </View>
        )}
        <View className='merchantReviewList'>
          {reviews.length === 0 ? (
            <View className='merchantEmptyReview'>
              <Text>暂无历史评价</Text>
              <Text>用户完成订单后，评价会沉淀到这里。</Text>
            </View>
          ) : (
            reviews.map((review) => <ReviewCard review={review} key={review.id} />)
          )}
        </View>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>{merchant.type === 'food_delivery' ? '店内菜单' : '店内商品'}</Text>
          <Text className='muted'>{products.length} 款</Text>
        </View>
        <View className='merchantProductList'>
          {products.map((product) => (
            <View className='merchantProductCard' key={product.id} onClick={() => Taro.navigateTo({ url: `/pages/product/detail?id=${product.id}` })}>
              <SafeImage className='merchantProductImage' src={product.imageUrl} mode='aspectFill' label={product.title} />
              <View className='merchantProductBody'>
                <Text className='merchantProductTitle'>{product.title}</Text>
                <Text className='merchantProductSub'>{product.subtitle}</Text>
                <View className='merchantProductTags'>
                  {product.tags.slice(0, 3).map((tag) => <Text key={tag}>{tag}</Text>)}
                </View>
                <View className='merchantProductFoot'>
                  <Text className='merchantProductPrice'>{formatMoney(product.virtualPrice)}</Text>
                  <View className='merchantProductActions'>
                    <View
                      className='merchantMiniButton secondary'
                      onClick={(event) => {
                        event.stopPropagation()
                        addCart(product)
                      }}
                    >
                      <Text>加购</Text>
                    </View>
                    <View
                      className='merchantMiniButton primary'
                      onClick={(event) => {
                        event.stopPropagation()
                        orderNow(product)
                      }}
                    >
                      <Text>{product.orderType === 'food_delivery' ? '点餐' : '下单'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='primaryButton merchantBackButton' onClick={backOrHome}>
        <Text>返回上一页</Text>
      </View>
    </View>
  )
}

function ReviewCard({ review }: { review: ReviewFeedItem }) {
  return (
    <View className='merchantReviewCard'>
      <View className='merchantReviewHead'>
        <View>
          <Text className='merchantReviewUser'>{review.userDisplayName}</Text>
          <Text className='merchantReviewStars'>{starsText(review.rating)}</Text>
        </View>
        <Text className='merchantReviewDate'>{formatReviewDate(review.updatedAt)}</Text>
      </View>
      {review.itemTitles.length > 0 && <Text className='merchantReviewBought'>买过：{review.itemTitles.join('、')}</Text>}
      {review.tags.length > 0 && (
        <View className='merchantReviewTags compact'>
          {review.tags.map((tag) => <Text key={tag}>{tag}</Text>)}
        </View>
      )}
      <Text className='merchantReviewContent'>{review.content || '这次体验不错。'}</Text>
    </View>
  )
}

function starsText(rating: number): string {
  const normalized = Math.max(1, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(normalized)}${'☆'.repeat(5 - normalized)}`
}

function formatReviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}`
}
