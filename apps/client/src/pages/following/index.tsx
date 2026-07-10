import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { MerchantFollow } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { SafeImage } from '../../components/SafeImage'
import { ensureAuth, formatMoney, request, track } from '../../lib/api'
import '../profile-trace.scss'

export default function FollowingPage() {
  const [follows, setFollows] = useState<MerchantFollow[]>([])
  const [keyword, setKeyword] = useState('')

  async function load() {
    await ensureAuth()
    const result = await request<{ follows: MerchantFollow[] }>('/merchant-follows')
    setFollows(result.follows)
    await track('page_view', { name: 'following' }, '/pages/following/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  const filteredFollows = follows.filter((follow) => {
    const text = [follow.merchant.name, follow.merchant.type, ...follow.merchant.tags].join(' ')
    return !keyword.trim() || text.includes(keyword.trim())
  })

  async function unfollow(follow: MerchantFollow) {
    const confirm = await Taro.showModal({
      title: '取消关注',
      content: `确定不再关注「${follow.merchant.name}」吗？`,
      confirmText: '取消关注',
      cancelText: '再逛逛'
    })
    if (!confirm.confirm) return
    await request(`/merchant-follows/${follow.merchant.id}`, 'DELETE')
    setFollows((current) => current.filter((item) => item.merchant.id !== follow.merchant.id))
    await track('merchant_unfollow', { merchantId: follow.merchant.id }, '/pages/following/index')
    Taro.showToast({ title: '已取消关注', icon: 'success' })
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
        <Text className='traceTopTitle'>关注店铺</Text>
        <View className='traceTopAction' onClick={() => Taro.redirectTo({ url: '/pages/food/index' })}>
          <Text>狂吃</Text>
        </View>
      </View>

      <View className='traceHero green'>
        <View className='traceHeroCopy'>
          <Text className='traceHeroLabel'>常逛店铺</Text>
          <Text className='traceHeroTitle'>{follows.length} 家已关注</Text>
          <Text className='traceHeroText'>喜欢的店都在这，下次进店不用重新搜索。</Text>
        </View>
        <View className='traceHeroMetric'>
          <Text>{averageRating(follows)}</Text>
          <Text>平均评分</Text>
        </View>
      </View>

      <View className='traceSearch'>
        <Input
          value={keyword}
          placeholder='搜索关注店铺'
          confirmType='search'
          onInput={(event) => setKeyword(String(event.detail.value))}
        />
        {keyword && <Text onClick={() => setKeyword('')}>清空</Text>}
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>店铺列表</Text>
          <Text className='muted'>{filteredFollows.length} 家</Text>
        </View>
        <View className='traceList'>
          {filteredFollows.length === 0 ? (
            <TraceEmpty title='还没有关注店铺' text='进入店铺详情点关注，常逛店铺就会出现在这里。' />
          ) : (
            filteredFollows.map((follow) => (
              <View className='traceCard' key={follow.id} onClick={() => Taro.navigateTo({ url: `/pages/merchant/detail?id=${follow.merchant.id}` })}>
                <View className='traceMediaRow'>
                  <SafeImage className='traceMerchantLogo' src={follow.merchant.logoUrl} mode='aspectFill' label={follow.merchant.name} />
                  <View className='traceBody'>
                    <Text className='traceCardTitle'>{follow.merchant.name}</Text>
                    <Text className='traceCardText'>
                      {follow.merchant.type === 'food_delivery'
                        ? `${follow.merchant.deliveryMinutes}分钟送达 · 起送 ${formatMoney(follow.merchant.minOrderAmount)}`
                        : '官方精选 · 快速发货'}
                    </Text>
                    <Text className='traceCardMeta'>{formatDate(follow.followedAt)} 关注 · {follow.merchant.rating.toFixed(1)} 分</Text>
                    <View className='traceMerchantStats'>
                      <Text>{follow.merchant.type === 'food_delivery' ? '外卖' : '好物'}</Text>
                      <Text>{follow.merchant.deliveryFee === 0 ? '免配送费' : `配送 ${formatMoney(follow.merchant.deliveryFee)}`}</Text>
                      {follow.merchant.tags.slice(0, 2).map((tag) => <Text key={tag}>{tag}</Text>)}
                    </View>
                  </View>
                </View>
                <View className='traceCardFoot'>
                  <Text>{follow.merchant.type === 'food_delivery' ? '看看今日菜单' : '看看店内上新'}</Text>
                  <View className='traceCardActions'>
                    <View
                      className='traceMiniButton secondary'
                      onClick={(event) => {
                        event.stopPropagation()
                        unfollow(follow).catch((error) => {
                          Taro.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
                        })
                      }}
                    >
                      <Text>取关</Text>
                    </View>
                    <View
                      className='traceMiniButton primary'
                      onClick={(event) => {
                        event.stopPropagation()
                        Taro.navigateTo({ url: `/pages/merchant/detail?id=${follow.merchant.id}` })
                      }}
                    >
                      <Text>进店</Text>
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

function averageRating(follows: MerchantFollow[]): string {
  if (follows.length === 0) return '0.0'
  const value = follows.reduce((sum, follow) => sum + follow.merchant.rating, 0) / follows.length
  return value.toFixed(1)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function TraceEmpty({ title, text }: { title: string; text: string }) {
  return (
    <View className='traceEmpty'>
      <View className='traceEmptyMark'>
        <Text>店</Text>
      </View>
      <Text className='traceEmptyTitle'>{title}</Text>
      <Text className='traceEmptyText'>{text}</Text>
    </View>
  )
}
