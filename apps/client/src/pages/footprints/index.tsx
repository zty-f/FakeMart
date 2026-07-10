import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { FootprintItem, Product } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { SafeImage } from '../../components/SafeImage'
import { ensureAuth, formatMoney, request, sessionId, track } from '../../lib/api'
import '../profile-trace.scss'

export default function FootprintsPage() {
  const [items, setItems] = useState<FootprintItem[]>([])
  const [keyword, setKeyword] = useState('')

  async function load() {
    await ensureAuth()
    const result = await request<{ footprints: FootprintItem[] }>('/footprints?limit=80')
    setItems(result.footprints)
    await track('page_view', { name: 'footprints' }, '/pages/footprints/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  const filteredItems = items.filter((item) => {
    const text = [item.product.title, item.product.subtitle, item.product.description, ...item.product.tags].join(' ')
    return !keyword.trim() || text.includes(keyword.trim())
  })

  async function addFavorite(product: Product) {
    await request('/cart/items', 'POST', { productId: product.id, quantity: 1, sessionId: sessionId() })
    await track('add_to_cart', { productId: product.id, source: 'footprints' }, '/pages/footprints/index')
    Taro.showToast({ title: '已加入最爱', icon: 'success' })
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
        <Text className='traceTopTitle'>足迹</Text>
        <View className='traceTopAction' onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}>
          <Text>狂购</Text>
        </View>
      </View>

      <View className='traceHero blue'>
        <View className='traceHeroCopy'>
          <Text className='traceHeroLabel'>刚刚看过</Text>
          <Text className='traceHeroTitle'>{items.length} 个商品</Text>
          <Text className='traceHeroText'>每一次心动都有痕迹，回头再看不用翻半天。</Text>
        </View>
        <View className='traceHeroMetric'>
          <Text>{items.reduce((sum, item) => sum + item.viewCount, 0)}</Text>
          <Text>浏览次数</Text>
        </View>
      </View>

      <View className='traceSearch'>
        <Input
          value={keyword}
          placeholder='搜索足迹里的商品'
          confirmType='search'
          onInput={(event) => setKeyword(String(event.detail.value))}
        />
        {keyword && <Text onClick={() => setKeyword('')}>清空</Text>}
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>浏览足迹</Text>
          <Text className='muted'>{filteredItems.length} 个</Text>
        </View>
        <View className='traceList'>
          {filteredItems.length === 0 ? (
            <TraceEmpty title='还没有足迹' text='打开商品详情后，这里会自动保存最近看过的东西。' />
          ) : (
            filteredItems.map((item) => (
              <View className='traceCard' key={item.product.id} onClick={() => Taro.navigateTo({ url: `/pages/product/detail?id=${item.product.id}` })}>
                <View className='traceMediaRow'>
                  <SafeImage className='traceImage' src={item.product.imageUrl} mode='aspectFill' label={item.product.title} />
                  <View className='traceBody'>
                    <Text className='traceCardTitle'>{item.product.title}</Text>
                    <Text className='traceCardText'>{item.product.subtitle}</Text>
                    <Text className='traceCardMeta'>{formatDateTime(item.lastViewedAt)} · 看过 {item.viewCount} 次</Text>
                    <View className='traceTagRow'>
                      {item.product.tags.slice(0, 3).map((tag) => <Text key={tag}>{tag}</Text>)}
                    </View>
                    <View className='tracePriceRow'>
                      <Text className='tracePrice'>{formatMoney(item.product.virtualPrice)}</Text>
                      <Text className='traceCompare'>{formatMoney(item.product.compareAtPrice)}</Text>
                    </View>
                  </View>
                </View>
                <View className='traceCardFoot'>
                  <Text>{item.product.orderType === 'food_delivery' ? '再点一次也很顺手' : '喜欢就先放进收藏夹'}</Text>
                  <View className='traceCardActions'>
                    <View
                      className='traceMiniButton secondary'
                      onClick={(event) => {
                        event.stopPropagation()
                        addFavorite(item.product).catch((error) => {
                          Taro.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
                        })
                      }}
                    >
                      <Text>收藏</Text>
                    </View>
                    <View
                      className='traceMiniButton primary'
                      onClick={(event) => {
                        event.stopPropagation()
                        Taro.navigateTo({ url: `/pages/product/detail?id=${item.product.id}` })
                      }}
                    >
                      <Text>再看</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
      <BottomNav active='profile' />
    </View>
  )
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function TraceEmpty({ title, text }: { title: string; text: string }) {
  return (
    <View className='traceEmpty'>
      <View className='traceEmptyMark'>
        <Text>↗</Text>
      </View>
      <Text className='traceEmptyTitle'>{title}</Text>
      <Text className='traceEmptyText'>{text}</Text>
    </View>
  )
}
