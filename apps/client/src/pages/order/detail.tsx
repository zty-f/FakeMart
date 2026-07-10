import { Text, Textarea, View } from '@tarojs/components'
import Taro, { getCurrentInstance, useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ORDER_STATUS_LABELS, statusFlowForOrderType, type Order } from '@fakemart/shared'
import { ensureAuth, formatMoney, request, track } from '../../lib/api'
import './detail.scss'

export default function OrderDetail() {
  const id = getCurrentInstance().router?.params.id ?? ''
  const [order, setOrder] = useState<Order | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewTags, setReviewTags] = useState<string[]>([])
  const [submittingReview, setSubmittingReview] = useState(false)

  async function load() {
    await ensureAuth()
    const result = await request<{ order: Order }>(`/orders/${id}`)
    setOrder(result.order)
    track('order_detail_view', { orderId: id }, '/pages/order/detail')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  useEffect(() => {
    if (!order || ['completed', 'cancelled'].includes(order.status)) return undefined
    const timer = setInterval(() => {
      load().catch((error) => console.warn(error))
    }, 4200)
    return () => clearInterval(timer)
  }, [order?.status, id])

  async function cancelOrder() {
    if (!order || ['completed', 'cancelled'].includes(order.status)) return
    const confirm = await Taro.showModal({
      title: '取消订单',
      content: `确定取消 ${order.orderNo} 吗？`,
      confirmText: '取消订单',
      cancelText: '再想想'
    })
    if (!confirm.confirm) return
    await request(`/orders/${order.id}/cancel`, 'POST')
    await track('order_cancel', { orderId: order.id }, '/pages/order/detail')
    await load()
    Taro.showToast({ title: '已取消', icon: 'success' })
  }

  function openReviewEditor() {
    if (!order) return
    setReviewRating(order.review?.rating ?? 5)
    setReviewText(order.review?.content ?? '')
    setReviewTags(order.review?.tags ?? [])
    setReviewOpen(true)
  }

  function toggleReviewTag(tag: string) {
    setReviewTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 8)))
  }

  async function submitReview() {
    if (!order || submittingReview) return
    setSubmittingReview(true)
    try {
      const result = await request<{ order: Order }>(`/orders/${order.id}/review`, 'POST', {
        rating: reviewRating,
        content: reviewText.trim(),
        tags: reviewTags
      })
      setOrder(result.order)
      setReviewOpen(false)
      await track('order_review_submit', { orderId: order.id, rating: reviewRating, tags: reviewTags }, '/pages/order/detail')
      Taro.showToast({ title: '评价已提交', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '评价失败', icon: 'none' })
    } finally {
      setSubmittingReview(false)
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

  if (!order) return <View className='page'><View className='empty'>加载中...</View></View>

  const flow = statusFlowForOrderType(order.orderType)
  const currentIndex = Math.max(flow.indexOf(order.status), 0)
  const progress = flow.length <= 1 ? 100 : Math.round((currentIndex / (flow.length - 1)) * 100)
  const latest = order.events[order.events.length - 1]
  const canCancel = !['completed', 'cancelled'].includes(order.status)
  const availableReviewTags = order.orderType === 'food_delivery' ? foodReviewTags : shoppingReviewTags

  return (
    <View className='page'>
      <View className='panel'>
        <Text className='sectionTitle'>{order.orderNo}</Text>
        <Text className='detailSubtitle'>{order.orderType === 'food_delivery' ? '外卖订单' : '购物订单'} · {ORDER_STATUS_LABELS[order.status]}</Text>
        <Text className='metricValue'>{formatMoney(order.totalVirtualAmount)}</Text>
        <Text className='muted'>{order.couponDiscountAmount > 0 ? `优惠券已抵扣 ${formatMoney(order.couponDiscountAmount)}` : '已为你记录本单账目和进度。'}</Text>
        <View className='orderAmountPanel'>
          <View>
            <Text>商品金额</Text>
            <Text>{formatMoney(order.originalAmount || order.totalVirtualAmount)}</Text>
          </View>
          <View>
            <Text>优惠券</Text>
            <Text>{order.couponDiscountAmount > 0 ? `-${formatMoney(order.couponDiscountAmount)}` : '未使用'}</Text>
          </View>
          <View>
            <Text>实付金额</Text>
            <Text>{formatMoney(order.totalVirtualAmount)}</Text>
          </View>
        </View>
        <View className='orderAddress'>
          <Text className='metricLabel'>收货地址</Text>
          <Text>{order.virtualAddressLabel}</Text>
        </View>
        <View className='orderProgress'>
          <View className='orderProgressBar' style={{ width: `${progress}%` }} />
        </View>
        <View className='liveStatus'>
          <Text className='liveTitle'>{latest?.title ?? ORDER_STATUS_LABELS[order.status]}</Text>
          <Text className='liveText'>{latest?.description ?? '订单正在处理中。'}</Text>
        </View>
        {order.status === 'created' && (
          <View className='primaryButton payAgainButton' onClick={() => Taro.navigateTo({ url: `/pages/payment/index?id=${order.id}` })}>
            <Text>去支付</Text>
          </View>
        )}
        {canCancel && (
          <View className='secondaryButton cancelDetailButton' onClick={cancelOrder}>
            <Text>取消订单</Text>
          </View>
        )}
        {order.review ? (
          <View className='reviewSummary'>
            <View className='reviewSummaryHead'>
              <View>
                <Text className='metricLabel'>我的评价</Text>
                <Text className='reviewStars'>{starsText(order.review.rating)}</Text>
              </View>
              {order.status === 'completed' && (
                <View className='reviewEditButton' onClick={openReviewEditor}>
                  <Text>修改</Text>
                </View>
              )}
            </View>
            {order.review.tags.length > 0 && (
              <View className='reviewTagRow'>
                {order.review.tags.map((tag) => <Text className='reviewTag selected' key={tag}>{tag}</Text>)}
              </View>
            )}
            <Text className='reviewContent'>{order.review.content || '这次体验不错。'}</Text>
          </View>
        ) : order.status === 'completed' ? (
          <View className='reviewPrompt'>
            <View>
              <Text className='reviewPromptTitle'>给这次体验打个分</Text>
              <Text className='reviewPromptText'>你的反馈会帮我们把店铺、商品和配送做得更顺手。</Text>
            </View>
            <View className='reviewPromptButton' onClick={openReviewEditor}>
              <Text>去评价</Text>
            </View>
          </View>
        ) : null}
        {reviewOpen && (
          <View className='reviewEditor'>
            <View className='reviewEditorHead'>
              <Text className='reviewPromptTitle'>{order.review ? '修改评价' : '评价本单'}</Text>
              <Text className='reviewClose' onClick={() => setReviewOpen(false)}>收起</Text>
            </View>
            <View className='reviewStarsPicker'>
              {[1, 2, 3, 4, 5].map((value) => (
                <Text
                  className={value <= reviewRating ? 'reviewStar active' : 'reviewStar'}
                  key={value}
                  onClick={() => setReviewRating(value)}
                >
                  ★
                </Text>
              ))}
              <Text className='reviewRatingText'>{reviewRating}.0 分</Text>
            </View>
            <View className='reviewTagRow'>
              {availableReviewTags.map((tag) => (
                <Text
                  className={reviewTags.includes(tag) ? 'reviewTag selected' : 'reviewTag'}
                  key={tag}
                  onClick={() => toggleReviewTag(tag)}
                >
                  {tag}
                </Text>
              ))}
            </View>
            <Textarea
              className='reviewTextarea'
              value={reviewText}
              maxlength={500}
              placeholder='说说这次体验，商品、包装、配送都可以聊聊'
              onInput={(event) => setReviewText(String(event.detail.value))}
            />
            <View className={submittingReview ? 'primaryButton disabled reviewSubmitButton' : 'primaryButton reviewSubmitButton'} onClick={submitReview}>
              <Text>{submittingReview ? '提交中...' : '提交评价'}</Text>
            </View>
          </View>
        )}
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>订单进度</Text>
          <View className='secondaryButton refreshButton' onClick={load}>
            <Text>刷新</Text>
          </View>
        </View>
        <View className='timeline'>
          {order.events.map((event, index) => (
            <View className={index === order.events.length - 1 ? 'timelineItem active' : 'timelineItem'} key={event.id}>
              <Text className='timelineTitle'>{event.title}</Text>
              <Text className='timelineText'>{event.description}</Text>
              <Text className='timelineText'>{new Date(event.occurredAt).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='section productList'>
        {order.items.map((item) => (
          <View className='panel' key={item.id}>
            <View className='row'>
              <Text>{item.title} x {item.quantity}</Text>
              <Text className='price'>{formatMoney(item.subtotalAmount)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className='primaryButton' onClick={backOrHome}>
        <Text>返回上一页</Text>
      </View>
    </View>
  )
}

const shoppingReviewTags = ['发货很快', '包装不错', '很划算', '质感在线', '还想再买']
const foodReviewTags = ['送达很快', '味道在线', '分量满足', '包装严实', '服务不错']

function starsText(rating: number): string {
  const normalized = Math.max(1, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(normalized)}${'☆'.repeat(5 - normalized)} ${normalized}.0`
}
