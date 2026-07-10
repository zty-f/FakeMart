import { Image, Text, View } from '@tarojs/components'
import Taro, { getCurrentInstance, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import type { Order } from '@fakemart/shared'
import alipayLogo from '../../assets/payments/alipay.svg'
import balanceLogo from '../../assets/payments/balance-pay.svg'
import unionPayLogo from '../../assets/payments/union-pay.svg'
import wechatPayLogo from '../../assets/payments/wechat-pay.svg'
import { ensureAuth, formatMoney, request, track } from '../../lib/api'
import './index.scss'

const paymentChannels = [
  { id: '微信支付', title: '微信支付', note: '推荐使用', logo: wechatPayLogo },
  { id: '支付宝', title: '支付宝', note: '常用支付', logo: alipayLogo },
  { id: '云闪付', title: '云闪付', note: '银行卡支付', logo: unionPayLogo },
  { id: '余额支付', title: '余额支付', note: '快速完成', logo: balanceLogo }
]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function PaymentPage() {
  const id = getCurrentInstance().router?.params.id ?? ''
  const [order, setOrder] = useState<Order | null>(null)
  const [selected, setSelected] = useState(paymentChannels[0].id)
  const [phase, setPhase] = useState<'idle' | 'processing' | 'success'>('idle')
  const [stageText, setStageText] = useState('确认订单金额')

  useLoad(() => {
    load().catch((error) => console.warn(error))
  })

  async function load() {
    await ensureAuth()
    const result = await request<{ order: Order }>(`/orders/${id}`)
    setOrder(result.order)
    if (result.order.status !== 'created') {
      setPhase('success')
      setStageText('支付已完成')
    }
    await track('payment_view', { orderId: id }, '/pages/payment/index')
  }

  async function pay() {
    if (!order || phase === 'processing') return
    setPhase('processing')
    setStageText('正在连接支付渠道')
    await track('payment_channel_select', { orderId: order.id, channel: selected }, '/pages/payment/index')
    await sleep(650)
    setStageText('正在校验订单金额')
    await sleep(650)
    setStageText('正在确认支付结果')
    const result = await request<{ order: Order }>(`/orders/${order.id}/pay`, 'POST', { paymentMethod: selected })
    setOrder(result.order)
    await sleep(650)
    setPhase('success')
    setStageText('支付成功')
    await track('payment_success', { orderId: order.id, channel: selected }, '/pages/payment/index')
    await sleep(900)
    Taro.redirectTo({ url: `/pages/order/detail?id=${order.id}` })
  }

  if (!order) return <View className='page'><View className='empty'>加载中...</View></View>

  return (
    <View className='page paymentPage'>
      <View className='paymentHero'>
        <Text className='paymentLabel'>{order.orderType === 'food_delivery' ? '外卖收银台' : '订单收银台'}</Text>
        <Text className='paymentAmount'>{formatMoney(order.totalVirtualAmount)}</Text>
        <Text className='paymentSub'>
          {order.itemCount} 件商品 · {order.couponDiscountAmount > 0 ? `已优惠 ${formatMoney(order.couponDiscountAmount)}` : order.orderNo}
        </Text>
      </View>

      <View className='cashierPanel'>
        <View className='cashierRow'>
          <Text className='cashierLabel'>商品金额</Text>
          <Text className='cashierValue'>{formatMoney(order.originalAmount || order.totalVirtualAmount)}</Text>
        </View>
        <View className='cashierRow'>
          <Text className='cashierLabel'>优惠券</Text>
          <Text className={order.couponDiscountAmount > 0 ? 'cashierValue coupon' : 'cashierValue'}>
            {order.couponDiscountAmount > 0 ? `${order.couponName || '优惠券'} -${formatMoney(order.couponDiscountAmount)}` : '暂无使用'}
          </Text>
        </View>
        <View className='cashierRow'>
          <Text className='cashierLabel'>收货地址</Text>
          <Text className='cashierValue'>{order.virtualAddressLabel}</Text>
        </View>
        <View className='cashierRow'>
          <Text className='cashierLabel'>订单类型</Text>
          <Text className='cashierValue'>{order.orderType === 'food_delivery' ? '外卖配送' : '商城配送'}</Text>
        </View>
        <View className='cashierRow'>
          <Text className='cashierLabel'>支付状态</Text>
          <Text className='cashierValue highlight'>{stageText}</Text>
        </View>
      </View>

      <View className={phase === 'idle' ? 'payStatusCard idle' : `payStatusCard ${phase}`}>
        <View className='payStatusIcon'>
          <View className='payStatusInner'>
            <Text>{phase === 'success' ? '✓' : '¥'}</Text>
          </View>
        </View>
        <View>
          <Text className='payStatusTitle'>{phase === 'success' ? '支付成功' : phase === 'processing' ? '正在支付' : '确认订单金额'}</Text>
          <Text className='payStatusText'>{phase === 'idle' ? '选择支付方式后完成订单' : stageText}</Text>
        </View>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>支付方式</Text>
          <Text className='muted'>选择一个渠道</Text>
        </View>
        <View className='paymentMethods'>
          {paymentChannels.map((channel) => (
            <View
              className={selected === channel.id ? 'paymentMethod active' : 'paymentMethod'}
              key={channel.id}
              onClick={() => {
                if (phase === 'idle') setSelected(channel.id)
              }}
            >
              <Image className='paymentLogo' src={channel.logo} mode='aspectFit' />
              <View>
                <Text className='paymentName'>{channel.title}</Text>
                <Text className='paymentNote'>{channel.note}</Text>
              </View>
              <View className={selected === channel.id ? 'paymentRadio active' : 'paymentRadio'}>
                <Text>{selected === channel.id ? '✓' : ''}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='paymentFooter'>
        <View className={phase === 'idle' ? 'primaryButton' : 'primaryButton disabled'} onClick={pay}>
          <Text>{phase === 'processing' ? '支付中...' : phase === 'success' ? '支付成功' : `确认支付 ${formatMoney(order.totalVirtualAmount)}`}</Text>
        </View>
      </View>
    </View>
  )
}
