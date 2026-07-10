import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { CartItem, OrderType, UserCoupon } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { ProductCard } from '../../components/ProductCard'
import { addressShort, defaultAddress, syncDefaultAddress } from '../../lib/address'
import { ensureAuth, formatMoney, request, track } from '../../lib/api'
import './index.scss'

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([])
  const [address, setAddress] = useState(defaultAddress())
  const [coupons, setCoupons] = useState<UserCoupon[]>([])
  const [selectedCouponId, setSelectedCouponId] = useState('')

  async function load() {
    await ensureAuth()
    const [result, me] = await Promise.all([
      request<{ items: CartItem[] }>('/cart'),
      request<{ user?: { defaultAddressLabel?: string | null } }>('/auth/me')
    ])
    setItems(result.items)
    setAddress(syncDefaultAddress(me.user?.defaultAddressLabel))
    const amount = cartTotal(result.items)
    if (amount > 0) {
      const couponResult = await request<{ coupons: UserCoupon[] }>(`/coupons/available?orderType=${cartOrderType(result.items)}&amount=${amount}`)
      setCoupons(couponResult.coupons)
      setSelectedCouponId((current) => {
        if (current === 'none') return current
        return couponResult.coupons.some((coupon) => coupon.id === current) ? current : couponResult.coupons[0]?.id ?? ''
      })
    } else {
      setCoupons([])
      setSelectedCouponId('')
    }
    track('page_view', { name: 'cart' }, '/pages/cart/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  const total = cartTotal(items)
  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedCouponId) ?? null
  const couponDiscount = selectedCoupon ? Math.min(selectedCoupon.discountAmount, total) : 0
  const payableTotal = Math.max(0, total - couponDiscount)

  async function submit() {
    if (items.length === 0) return
    const result = await request<{ order: { id: string } }>('/orders', 'POST', {
      clearCart: true,
      virtualPaymentMethod: '余额支付',
      virtualAddressLabel: address || defaultAddress(),
      couponId: selectedCouponId && selectedCouponId !== 'none' ? selectedCouponId : undefined,
      autoCoupon: selectedCouponId !== 'none'
    })
    await track('order_submit', { source: 'cart', amount: payableTotal, couponId: selectedCouponId || '' }, '/pages/cart/index')
    Taro.navigateTo({ url: `/pages/payment/index?id=${result.order.id}` })
  }

  async function removeItem(item: CartItem) {
    const confirm = await Taro.showModal({
      title: '移出最爱',
      content: `确定移出「${item.product.title}」吗？`,
      confirmText: '移出',
      cancelText: '再看看'
    })
    if (!confirm.confirm) return
    await request(`/cart/items/${item.id}`, 'DELETE')
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
    await track('cart_item_remove', { productId: item.productId }, '/pages/cart/index')
    Taro.showToast({ title: '已移出', icon: 'success' })
  }

  function editAddress() {
    Taro.setStorageSync('fakemart_profile_edit_address', '1')
    Taro.redirectTo({ url: '/pages/profile/index' })
  }

  return (
    <View className='page cartPage'>
      <View className='sectionHead'>
        <Text className='sectionTitle'>最爱</Text>
        <Text className='muted'>共 {items.length} 件</Text>
      </View>
      <View className='cartAddressPanel'>
        <View className='cartAddressHead'>
          <Text className='metricLabel'>送至</Text>
          <Text onClick={editAddress}>编辑地址</Text>
        </View>
        <Text className='cartAddressText'>{addressShort(address)}</Text>
      </View>
      <View className='cartCouponPanel'>
        <View className='cartCouponHead'>
          <Text>优惠券</Text>
          <Text>{coupons.length ? `可用 ${coupons.length} 张` : '暂无可用'}</Text>
        </View>
        {coupons.length === 0 ? (
          <View className='cartCouponEmpty' onClick={() => Taro.navigateTo({ url: '/pages/coupons/index' })}>
            <Text>去领券中心看看</Text>
          </View>
        ) : (
          <View className='cartCouponList'>
            <View className={selectedCouponId === 'none' ? 'cartCouponChip active none' : 'cartCouponChip none'} onClick={() => setSelectedCouponId('none')}>
              <Text>不使用</Text>
            </View>
            {coupons.map((coupon) => (
              <View className={selectedCouponId === coupon.id ? 'cartCouponChip active' : 'cartCouponChip'} key={coupon.id} onClick={() => setSelectedCouponId(coupon.id)}>
                <Text>{coupon.title}</Text>
                <Text>-{formatMoney(coupon.discountAmount)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View className='productList'>
        {items.length === 0 ? <View className='empty'>最爱清单还是空的，去狂购逛逛</View> : items.map((item) => (
          <View className='cartItem' key={item.id}>
            <ProductCard compact product={item.product} />
            <View
              className='cartRemoveButton'
              onClick={() => {
                removeItem(item).catch((error) => {
                  Taro.showToast({ title: error instanceof Error ? error.message : '移出失败', icon: 'none' })
                })
              }}
            >
              <Text>移出</Text>
            </View>
          </View>
        ))}
      </View>
      <View className='cartFooter'>
        <View>
          <Text className='metricLabel'>商品合计</Text>
          <Text className='metricValue'>{formatMoney(payableTotal)}</Text>
          {couponDiscount > 0 && <Text className='cartCouponDiscount'>已减 {formatMoney(couponDiscount)}</Text>}
        </View>
        <View className={items.length === 0 ? 'primaryButton disabled' : 'primaryButton'} onClick={submit}>
          <Text>去结算</Text>
        </View>
      </View>
      <BottomNav active='cart' />
    </View>
  )
}

function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.virtualPrice * item.quantity, 0)
}

function cartOrderType(items: CartItem[]): OrderType {
  return items.length > 0 && items.every((item) => item.product.orderType === 'food_delivery') ? 'food_delivery' : 'shopping'
}
