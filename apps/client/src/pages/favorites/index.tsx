import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { CartItem, Product } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { SafeImage } from '../../components/SafeImage'
import { ensureAuth, formatMoney, request, sessionId, track } from '../../lib/api'
import '../profile-trace.scss'

export default function FavoritesPage() {
  const [items, setItems] = useState<CartItem[]>([])
  const [keyword, setKeyword] = useState('')

  async function load() {
    await ensureAuth()
    const result = await request<{ items: CartItem[] }>('/cart')
    setItems(result.items)
    await track('page_view', { name: 'favorites' }, '/pages/favorites/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  const filteredItems = items.filter((item) => {
    const text = [item.product.title, item.product.subtitle, item.product.description, ...item.product.tags].join(' ')
    return !keyword.trim() || text.includes(keyword.trim())
  })
  const totalAmount = filteredItems.reduce((sum, item) => sum + item.product.virtualPrice * item.quantity, 0)

  async function removeItem(item: CartItem) {
    const confirm = await Taro.showModal({
      title: '移出收藏夹',
      content: `确定移出「${item.product.title}」吗？`,
      confirmText: '移出',
      cancelText: '再看看'
    })
    if (!confirm.confirm) return
    await request(`/cart/items/${item.id}`, 'DELETE')
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
    await track('favorite_remove', { productId: item.productId }, '/pages/favorites/index')
    Taro.showToast({ title: '已移出', icon: 'success' })
  }

  async function addAgain(product: Product) {
    await request('/cart/items', 'POST', { productId: product.id, quantity: 1, sessionId: sessionId() })
    await load()
    Taro.showToast({ title: '已加 1 件', icon: 'success' })
  }

  function backProfile() {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
      return
    }
    Taro.redirectTo({ url: '/pages/profile/index' })
  }

  return (
    <View className='page tracePage'>
      <View className='traceTopBar'>
        <View className='traceTopBack' onClick={backProfile}>
          <Text>返回</Text>
        </View>
        <Text className='traceTopTitle'>收藏夹</Text>
        <View className='traceTopAction' onClick={() => Taro.navigateTo({ url: '/pages/cart/index' })}>
          <Text>结算</Text>
        </View>
      </View>

      <View className='traceHero'>
        <View className='traceHeroCopy'>
          <Text className='traceHeroLabel'>心动清单</Text>
          <Text className='traceHeroTitle'>{items.length} 件好物</Text>
          <Text className='traceHeroText'>喜欢的都先放这里，想买的时候一秒回到现场。</Text>
        </View>
        <View className='traceHeroMetric'>
          <Text>{formatMoney(totalAmount)}</Text>
          <Text>当前合计</Text>
        </View>
      </View>

      <View className='traceSearch'>
        <Input
          value={keyword}
          placeholder='搜索收藏的商品'
          confirmType='search'
          onInput={(event) => setKeyword(String(event.detail.value))}
        />
        {keyword && <Text onClick={() => setKeyword('')}>清空</Text>}
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>收藏商品</Text>
          <Text className='muted'>{filteredItems.length} 件</Text>
        </View>
        <View className='traceList'>
          {filteredItems.length === 0 ? (
            <TraceEmpty title='收藏夹还空着' text='去狂购或狂吃逛逛，遇到喜欢的就加入最爱。' />
          ) : (
            filteredItems.map((item) => (
              <ProductTraceCard
                key={item.id}
                product={item.product}
                meta={`已收藏 ${item.quantity} 件 · ${item.product.virtualStock} 件可买`}
                footText={`比参考价低 ${formatMoney(Math.max(item.product.compareAtPrice - item.product.virtualPrice, 0))}`}
                primaryText='去看看'
                secondaryText='移出'
                onPrimary={() => Taro.navigateTo({ url: `/pages/product/detail?id=${item.product.id}` })}
                onSecondary={() => {
                  removeItem(item).catch((error) => {
                    Taro.showToast({ title: error instanceof Error ? error.message : '移出失败', icon: 'none' })
                  })
                }}
                onAdd={() => {
                  addAgain(item.product).catch((error) => {
                    Taro.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
                  })
                }}
              />
            ))
          )}
        </View>
      </View>
      <BottomNav active='profile' />
    </View>
  )
}

function ProductTraceCard({
  product,
  meta,
  footText,
  primaryText,
  secondaryText,
  onPrimary,
  onSecondary,
  onAdd
}: {
  product: Product
  meta: string
  footText: string
  primaryText: string
  secondaryText: string
  onPrimary: () => void
  onSecondary: () => void
  onAdd: () => void
}) {
  return (
    <View className='traceCard' onClick={onPrimary}>
      <View className='traceMediaRow'>
        <SafeImage className='traceImage' src={product.imageUrl} mode='aspectFill' label={product.title} />
        <View className='traceBody'>
          <Text className='traceCardTitle'>{product.title}</Text>
          <Text className='traceCardText'>{product.subtitle}</Text>
          <Text className='traceCardMeta'>{meta}</Text>
          <View className='traceTagRow'>
            {product.tags.slice(0, 3).map((tag) => <Text key={tag}>{tag}</Text>)}
          </View>
          <View className='tracePriceRow'>
            <Text className='tracePrice'>{formatMoney(product.virtualPrice)}</Text>
            <Text className='traceCompare'>{formatMoney(product.compareAtPrice)}</Text>
          </View>
        </View>
      </View>
      <View className='traceCardFoot'>
        <Text>{footText}</Text>
        <View className='traceCardActions'>
          <View
            className='traceMiniButton secondary'
            onClick={(event) => {
              event.stopPropagation()
              onSecondary()
            }}
          >
            <Text>{secondaryText}</Text>
          </View>
          <View
            className='traceMiniButton green'
            onClick={(event) => {
              event.stopPropagation()
              onAdd()
            }}
          >
            <Text>加 1 件</Text>
          </View>
          <View
            className='traceMiniButton primary'
            onClick={(event) => {
              event.stopPropagation()
              onPrimary()
            }}
          >
            <Text>{primaryText}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function TraceEmpty({ title, text }: { title: string; text: string }) {
  return (
    <View className='traceEmpty'>
      <View className='traceEmptyMark'>
        <Text>♥</Text>
      </View>
      <Text className='traceEmptyTitle'>{title}</Text>
      <Text className='traceEmptyText'>{text}</Text>
    </View>
  )
}
