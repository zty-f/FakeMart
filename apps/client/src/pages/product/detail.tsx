import { Text, View } from '@tarojs/components'
import Taro, { getCurrentInstance, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import type { Product } from '@fakemart/shared'
import { SafeImage } from '../../components/SafeImage'
import { addressShort, defaultAddress } from '../../lib/address'
import { ensureAuth, formatMoney, request, sessionId, track } from '../../lib/api'
import './detail.scss'

export default function ProductDetail() {
  const id = getCurrentInstance().router?.params.id ?? ''
  const [product, setProduct] = useState<Product | null>(null)

  useLoad(() => {
    load().catch((error) => console.warn(error))
  })

  async function load() {
    await ensureAuth()
    const result = await request<{ product: Product }>(`/catalog/products/${id}`)
    setProduct(result.product)
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
          {product.tags.map((tag) => <Text key={tag}>{tag}</Text>)}
        </View>
      </View>
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
