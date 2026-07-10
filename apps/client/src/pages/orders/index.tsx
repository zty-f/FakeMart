import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { ORDER_STATUS_LABELS, type Order } from '@fakemart/shared'
import { SafeImage } from '../../components/SafeImage'
import { ensureAuth, formatMoney, request, track } from '../../lib/api'
import './index.scss'

type TypeFilter = 'all' | 'shopping' | 'food_delivery'
type StatusFilter = 'all' | 'created' | 'active' | 'completed' | 'to_review' | 'reviewed' | 'cancelled'

const typeFilters: Array<{ label: string; value: TypeFilter }> = [
  { label: '全部', value: 'all' },
  { label: '购物', value: 'shopping' },
  { label: '外卖', value: 'food_delivery' }
]

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'created' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '待评价', value: 'to_review' },
  { label: '已评价', value: 'reviewed' },
  { label: '已取消', value: 'cancelled' }
]

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  async function load() {
    await ensureAuth()
    const result = await request<{ orders: Order[] }>('/orders')
    setOrders(result.orders)
    track('page_view', { name: 'orders' }, '/pages/orders/index')
  }

  async function cancelOrder(order: Order) {
    const confirm = await Taro.showModal({
      title: '取消订单',
      content: `确定取消 ${order.orderNo} 吗？`,
      confirmText: '取消订单',
      cancelText: '再想想'
    })
    if (!confirm.confirm) return
    await request(`/orders/${order.id}/cancel`, 'POST')
    await track('order_cancel', { orderId: order.id }, '/pages/orders/index')
    await load()
    Taro.showToast({ title: '已取消', icon: 'success' })
  }

  useDidShow(() => {
    const routeType = router.params?.type
    const routeStatus = router.params?.status
    if (routeType === 'food_delivery' || routeType === 'shopping') {
      setTypeFilter(routeType)
    } else {
      setTypeFilter('all')
    }
    if (isStatusFilter(routeStatus)) {
      setStatusFilter(routeStatus)
    } else {
      setStatusFilter('all')
    }
    load().catch((error) => console.warn(error))
  })

  const filteredOrders = orders.filter((order) => {
    const text = [
      order.orderNo,
      order.virtualAddressLabel,
      order.virtualPaymentMethod,
      ORDER_STATUS_LABELS[order.status],
      order.review?.content ?? '',
      ...(order.review?.tags ?? []),
      ...order.items.map((item) => item.title)
    ].join(' ')
    const matchesKeyword = !keyword.trim() || text.includes(keyword.trim())
    const matchesType = typeFilter === 'all' || order.orderType === typeFilter
    const matchesStatus =
      statusFilter === 'all' ||
      order.status === statusFilter ||
      (statusFilter === 'active' && !['created', 'completed', 'cancelled'].includes(order.status)) ||
      (statusFilter === 'to_review' && order.status === 'completed' && !order.review) ||
      (statusFilter === 'reviewed' && Boolean(order.review))
    return matchesKeyword && matchesType && matchesStatus
  })
  const stats = buildOrderStats(orders)

  return (
    <View className='page ordersPage'>
      <View className='ordersHero'>
        <View>
          <Text className='ordersHeroSub'>订单中心</Text>
          <Text className='ordersHeroTitle'>每一单都有进度</Text>
        </View>
        <View className='ordersHeroStats'>
          <View>
            <Text>{orders.length}</Text>
            <Text>全部</Text>
          </View>
          <View>
            <Text>{stats.toPay}</Text>
            <Text>待支付</Text>
          </View>
          <View>
            <Text>{stats.active}</Text>
            <Text>进行中</Text>
          </View>
        </View>
      </View>

      <View className='ordersSearch'>
        <Input
          value={keyword}
          placeholder='搜索订单号、商品、地址'
          confirmType='search'
          onInput={(event) => setKeyword(String(event.detail.value))}
          onConfirm={(event) => setKeyword(String(event.detail.value))}
        />
        {keyword && <Text className='ordersSearchClear' onClick={() => setKeyword('')}>清空</Text>}
      </View>

      <View className='ordersFilterBlock'>
        <View className='ordersFilterRow'>
          {typeFilters.map((item) => (
            <View
              className={typeFilter === item.value ? 'ordersFilter active' : 'ordersFilter'}
              key={item.value}
              onClick={() => setTypeFilter(item.value)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>
        <View className='ordersFilterRow scroll'>
          {statusFilters.map((item) => (
            <View
              className={statusFilter === item.value ? 'ordersFilter active' : 'ordersFilter'}
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>订单列表</Text>
          <Text className='muted'>{filteredOrders.length} 单</Text>
        </View>
        <View className='ordersList'>
          {filteredOrders.length === 0 ? (
            <View className='empty'>没有找到订单，换个关键词或筛选条件试试</View>
          ) : (
            filteredOrders.map((order) => <OrderCard order={order} key={order.id} onCancel={cancelOrder} />)
          )}
        </View>
      </View>
    </View>
  )
}

function buildOrderStats(orders: Order[]) {
  return {
    toPay: orders.filter((order) => order.status === 'created').length,
    active: orders.filter((order) => !['created', 'completed', 'cancelled'].includes(order.status)).length
  }
}

function isStatusFilter(value?: string): value is StatusFilter {
  return value === 'created' || value === 'active' || value === 'completed' || value === 'to_review' || value === 'reviewed' || value === 'cancelled'
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function latestProgress(order: Order): string {
  const latest = order.events[order.events.length - 1]
  return latest ? latest.description : ORDER_STATUS_LABELS[order.status]
}

function OrderCard({ order, onCancel }: { order: Order; onCancel: (order: Order) => Promise<void> }) {
  const firstItem = order.items[0]
  const extraCount = Math.max(order.itemCount - 1, 0)
  const canCancel = !['completed', 'cancelled'].includes(order.status)
  return (
    <View className='orderCard' onClick={() => Taro.navigateTo({ url: `/pages/order/detail?id=${order.id}` })}>
      <View className='orderCardHead'>
        <View>
          <Text className='orderStoreName'>{order.orderType === 'food_delivery' ? '外卖订单' : '购物订单'}</Text>
          <Text className='orderNo'>{order.orderNo}</Text>
        </View>
        <Text className='orderStatus'>{ORDER_STATUS_LABELS[order.status]}</Text>
      </View>

      <View className='orderMain'>
        {firstItem && <SafeImage className='orderImage' src={firstItem.imageUrl} mode='aspectFill' label={firstItem.title} />}
        <View className='orderBody'>
          <Text className='orderTitle'>{firstItem?.title ?? '订单商品'}</Text>
          <Text className='orderMeta'>
            {formatDateTime(order.createdAt)} · {order.itemCount} 件{extraCount ? ` · 另 ${extraCount} 件` : ''}
          </Text>
          <Text className='orderMeta'>支付方式 {order.virtualPaymentMethod}</Text>
          {order.couponDiscountAmount > 0 && <Text className='orderCouponLine'>{order.couponName} -{formatMoney(order.couponDiscountAmount)}</Text>}
          {order.review ? (
            <Text className='orderReviewLine'>{'★'.repeat(order.review.rating)} {order.review.rating}.0 已评价</Text>
          ) : order.status === 'completed' ? (
            <Text className='orderReviewLine pending'>待评价</Text>
          ) : null}
          <Text className='orderCardAddress'>{order.virtualAddressLabel}</Text>
        </View>
      </View>

      <View className='orderCardProgress'>
        <Text>{latestProgress(order)}</Text>
      </View>

      <View className='orderCardFoot'>
        <Text className='orderAmount'>{formatMoney(order.totalVirtualAmount)}</Text>
        <View className='orderActions'>
          {order.status !== 'created' && (
            <View
              className='orderActionButton secondary'
              onClick={(event) => {
                event.stopPropagation()
                Taro.navigateTo({ url: `/pages/order/detail?id=${order.id}` })
              }}
            >
              <Text>详情</Text>
            </View>
          )}
          {canCancel && (
            <View
              className='orderActionButton secondary'
              onClick={(event) => {
                event.stopPropagation()
                onCancel(order).catch((error) => {
                  Taro.showToast({ title: error instanceof Error ? error.message : '取消失败', icon: 'none' })
                })
              }}
            >
              <Text>取消</Text>
            </View>
          )}
          {order.status === 'created' && (
            <View
              className='orderActionButton primary'
              onClick={(event) => {
                event.stopPropagation()
                Taro.navigateTo({ url: `/pages/payment/index?id=${order.id}` })
              }}
            >
              <Text>去支付</Text>
            </View>
          )}
          {order.status === 'completed' && (
            <View
              className='orderActionButton primary'
              onClick={(event) => {
                event.stopPropagation()
                Taro.navigateTo({ url: `/pages/order/detail?id=${order.id}` })
              }}
            >
              <Text>{order.review ? '改评' : '评价'}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
