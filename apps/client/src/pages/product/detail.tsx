import { Text, View } from '@tarojs/components'
import Taro, { getCurrentInstance, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import type { Category, Merchant, Product, ReviewFeedItem, ReviewSummary } from '@fakemart/shared'
import { SafeImage } from '../../components/SafeImage'
import { addressShort, defaultAddress } from '../../lib/address'
import { ensureAuth, formatMoney, request, sessionId, track } from '../../lib/api'
import './detail.scss'

export default function ProductDetail() {
  const id = getCurrentInstance().router?.params.id ?? ''
  const [product, setProduct] = useState<Product | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<ReviewFeedItem[]>([])

  useLoad(() => {
    load().catch((error) => console.warn(error))
  })

  async function load() {
    await ensureAuth()
    const [result, reviewResult] = await Promise.all([
      request<{ product: Product; merchant: Merchant | null; category: Category | null }>(`/catalog/products/${id}`),
      request<{ summary: ReviewSummary; reviews: ReviewFeedItem[] }>(`/reviews/products/${id}?limit=20`)
    ])
    setProduct(result.product)
    setMerchant(result.merchant)
    setCategory(result.category)
    setReviewSummary(reviewResult.summary)
    setReviews(reviewResult.reviews)
    await track('product_view', { productId: id }, '/pages/product/detail')
  }

  async function addCart() {
    if (!product) return
    await request('/cart/items', 'POST', { productId: product.id, quantity: 1, sessionId: sessionId() })
    await track('add_to_cart', { productId: product.id }, '/pages/product/detail')
    Taro.showToast({ title: '已加入最爱', icon: 'success' })
  }

  async function orderNow() {
    if (!product) return
    const result = await request<{ order: { id: string } }>('/orders', 'POST', {
      orderType: product.orderType,
      items: [{ productId: product.id, quantity: 1 }],
      virtualPaymentMethod: '余额支付',
      virtualAddressLabel: defaultAddress()
    })
    await track('order_submit', { productId: product.id, orderType: product.orderType }, '/pages/product/detail')
    Taro.navigateTo({ url: `/pages/payment/index?id=${result.order.id}` })
  }

  if (!product) return <View className='page'><View className='empty'>加载中...</View></View>

  return (
    <View className='page'>
      <View className='detailHero'>
        <SafeImage className='detailImage' mode='aspectFill' src={product.imageUrl} label={product.title} />
      </View>
      <View className='detailCard'>
        <View className='row'>
          <Text className='price'>{formatMoney(product.virtualPrice)}</Text>
          <Text className='detailBadge'>{product.orderType === 'food_delivery' ? '外卖' : '好物'}</Text>
        </View>
        <Text className='compare'>参考价 {formatMoney(product.compareAtPrice)}</Text>
        <Text className='detailTitle'>{product.title}</Text>
        <Text className='detailSubtitle'>{product.description}</Text>
        <View className='detailTags'>
          {category && <Text>{category.name}</Text>}
          {product.tags.map((tag) => <Text key={tag}>{tag}</Text>)}
        </View>
      </View>
      {merchant && (
        <View className='section panel detailMerchantCard' onClick={() => Taro.navigateTo({ url: `/pages/merchant/detail?id=${merchant.id}` })}>
          <SafeImage className='detailMerchantLogo' src={merchant.logoUrl} mode='aspectFill' label={merchant.name} />
          <View>
            <Text className='detailMerchantName'>{merchant.name}</Text>
            <Text className='detailMerchantMeta'>
              {merchant.rating.toFixed(1)}分 · {merchant.type === 'food_delivery' ? `${merchant.deliveryMinutes}分钟送达` : '官方精选店铺'}
            </Text>
          </View>
          <Text className='detailMerchantEnter'>进店</Text>
        </View>
      )}
      <View className='section panel savePanel'>
        <View>
          <Text className='metricLabel'>预计省下</Text>
          <Text className='metricValue'>{formatMoney(product.virtualPrice)}</Text>
        </View>
        <Text className='muted'>下单后可在订单里查看进度。</Text>
        <View className='detailAddress'>
          <Text className='metricLabel'>送至</Text>
          <Text>{addressShort()}</Text>
        </View>
      </View>
      <View className='section panel reviewPanel'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>商品评价</Text>
          <Text className='muted'>{reviewSummary?.count ?? 0} 条</Text>
        </View>
        <View className='reviewOverview'>
          <Text className='reviewScore'>{reviewSummary?.count ? reviewSummary.averageRating.toFixed(1) : '暂无'}</Text>
          <View>
            <Text className='reviewStars'>{reviewSummary?.count ? starsText(Math.round(reviewSummary.averageRating)) : '☆☆☆☆☆'}</Text>
            <Text className='reviewMeta'>{reviewSummary?.count ? '来自已完成订单的真实反馈' : '等第一位用户来评价'}</Text>
          </View>
        </View>
        {(reviewSummary?.topTags.length ?? 0) > 0 && (
          <View className='reviewTags'>
            {reviewSummary?.topTags.map((item) => <Text key={item.tag}>{item.tag} {item.count}</Text>)}
          </View>
        )}
        <View className='reviewList'>
          {reviews.length === 0 ? (
            <View className='reviewEmpty'>
              <Text>暂无商品评价</Text>
              <Text>完成订单后可以在订单详情里评价。</Text>
            </View>
          ) : (
            reviews.map((review) => <ReviewCard review={review} key={review.id} />)
          )}
        </View>
      </View>
      <View className='detailActions stickyActions'>
        <View className='secondaryButton' onClick={addCart}>
          <Text>加入最爱</Text>
        </View>
        <View className='primaryButton' onClick={orderNow}>
          <Text>立即下单</Text>
        </View>
      </View>
    </View>
  )
}

function ReviewCard({ review }: { review: ReviewFeedItem }) {
  return (
    <View className='reviewCard'>
      <View className='reviewCardHead'>
        <View>
          <Text className='reviewUser'>{review.userDisplayName}</Text>
          <Text className='reviewStars small'>{starsText(review.rating)}</Text>
        </View>
        <Text className='reviewDate'>{formatReviewDate(review.updatedAt)}</Text>
      </View>
      {review.itemTitles.length > 0 && <Text className='reviewProductLine'>买过：{review.itemTitles.join('、')}</Text>}
      {review.tags.length > 0 && (
        <View className='reviewTags compact'>
          {review.tags.map((tag) => <Text key={tag}>{tag}</Text>)}
        </View>
      )}
      <Text className='reviewContent'>{review.content || '这次体验不错。'}</Text>
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
