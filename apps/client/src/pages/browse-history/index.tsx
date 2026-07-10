import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { BrowseRecord } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { SafeImage } from '../../components/SafeImage'
import { ensureAuth, request, track } from '../../lib/api'
import '../profile-trace.scss'

type HistoryFilter = 'all' | 'product' | 'merchant' | 'order' | 'other'

const filters: Array<{ label: string; value: HistoryFilter }> = [
  { label: '全部', value: 'all' },
  { label: '商品', value: 'product' },
  { label: '店铺', value: 'merchant' },
  { label: '订单', value: 'order' },
  { label: '其他', value: 'other' }
]

export default function BrowseHistoryPage() {
  const [records, setRecords] = useState<BrowseRecord[]>([])
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<HistoryFilter>('all')

  async function load() {
    await ensureAuth()
    const result = await request<{ records: BrowseRecord[] }>('/browse-records?limit=100')
    setRecords(result.records)
    await track('page_view', { name: 'browse_history' }, '/pages/browse-history/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  const filteredRecords = records.filter((record) => {
    const type = recordType(record)
    const text = [record.targetTitle ?? '', eventLabel(record.eventName), record.pagePath ?? '', JSON.stringify(record.properties)].join(' ')
    const matchesKeyword = !keyword.trim() || text.includes(keyword.trim())
    const matchesFilter = filter === 'all' || filter === type
    return matchesKeyword && matchesFilter
  })

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
        <Text className='traceTopTitle'>浏览记录</Text>
        <View className='traceTopAction' onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}>
          <Text>狂购</Text>
        </View>
      </View>

      <View className='traceHero purple'>
        <View className='traceHeroCopy'>
          <Text className='traceHeroLabel'>行动时间线</Text>
          <Text className='traceHeroTitle'>{records.length} 条记录</Text>
          <Text className='traceHeroText'>看过、点过、下过单，都按时间帮你收好。</Text>
        </View>
        <View className='traceHeroMetric'>
          <Text>{todayCount(records)}</Text>
          <Text>今日新增</Text>
        </View>
      </View>

      <View className='traceSearch'>
        <Input
          value={keyword}
          placeholder='搜索商品、店铺、订单行为'
          confirmType='search'
          onInput={(event) => setKeyword(String(event.detail.value))}
        />
        {keyword && <Text onClick={() => setKeyword('')}>清空</Text>}
      </View>

      <View className='traceFilterRow'>
        {filters.map((item) => (
          <View className={filter === item.value ? 'traceFilter active' : 'traceFilter'} key={item.value} onClick={() => setFilter(item.value)}>
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>时间线</Text>
          <Text className='muted'>{filteredRecords.length} 条</Text>
        </View>
        <View className='traceTimelineList'>
          {filteredRecords.length === 0 ? (
            <TraceEmpty title='暂无记录' text='继续逛一逛，浏览、收藏和下单动作会自动出现在这里。' />
          ) : (
            filteredRecords.map((record) => <TimelineItem record={record} key={record.id} />)
          )}
        </View>
      </View>
      <BottomNav active='profile' />
    </View>
  )
}

function TimelineItem({ record }: { record: BrowseRecord }) {
  const productId = stringProp(record.properties, 'productId')
  const merchantId = stringProp(record.properties, 'merchantId')
  const canOpen = Boolean(productId || merchantId)

  function openTarget() {
    if (productId) {
      Taro.navigateTo({ url: `/pages/product/detail?id=${productId}` })
      return
    }
    if (merchantId) {
      Taro.navigateTo({ url: `/pages/merchant/detail?id=${merchantId}` })
      return
    }
    Taro.showToast({ title: '这条记录没有可打开的详情', icon: 'none' })
  }

  return (
    <View className='traceTimelineItem' onClick={openTarget}>
      <View className='traceTimelineDot' />
      <View className='traceTimelineBody'>
        <View className='traceTimelineHead'>
          <View>
            <Text className='traceTimelineType'>{eventLabel(record.eventName)}</Text>
            <Text className='traceTimelineTitle'>{record.targetTitle || fallbackTitle(record)}</Text>
          </View>
          <Text className='traceTimelineTime'>{formatDateTime(record.occurredAt)}</Text>
        </View>
        <Text className='traceTimelineText'>{timelineText(record, canOpen)}</Text>
      </View>
      {record.targetImageUrl && <SafeImage className='traceTimelineImage' src={record.targetImageUrl} mode='aspectFill' label={record.targetTitle ?? eventLabel(record.eventName)} />}
    </View>
  )
}

function eventLabel(eventName: string): string {
  const labels: Record<string, string> = {
    page_view: '页面浏览',
    product_view: '商品浏览',
    add_to_cart: '加入最爱',
    order_submit: '提交订单',
    order_cancel: '取消订单',
    merchant_detail_view: '进店浏览',
    merchant_follow_toggle: '关注店铺',
    merchant_unfollow: '取消关注',
    favorite_remove: '移出收藏',
    cart_item_remove: '移出最爱',
    savings_view: '查看账本',
    address_save: '保存地址'
  }
  return labels[eventName] ?? eventName
}

function recordType(record: BrowseRecord): HistoryFilter {
  if (record.eventName === 'product_view' || stringProp(record.properties, 'productId')) return 'product'
  if (record.eventName === 'merchant_detail_view' || stringProp(record.properties, 'merchantId')) return 'merchant'
  if (record.eventName.includes('order')) return 'order'
  return 'other'
}

function fallbackTitle(record: BrowseRecord): string {
  if (record.eventName === 'page_view') return pageLabel(record.pagePath)
  return eventLabel(record.eventName)
}

function timelineText(record: BrowseRecord, canOpen: boolean): string {
  const page = pageLabel(record.pagePath)
  const suffix = canOpen ? '，点击可继续查看。' : '。'
  return `${page ? `${page} · ` : ''}${eventLabel(record.eventName)}${suffix}`
}

function pageLabel(pagePath: string | null): string {
  const labels: Record<string, string> = {
    '/pages/index/index': '狂购',
    '/pages/food/index': '狂吃',
    '/pages/cart/index': '最爱',
    '/pages/profile/index': 'Me',
    '/pages/product/detail': '商品详情',
    '/pages/merchant/detail': '店铺详情',
    '/pages/orders/index': '订单中心',
    '/pages/order/detail': '订单详情',
    '/pages/payment/index': '支付台',
    '/pages/savings/index': '省钱账本',
    '/pages/coupons/index': '优惠券'
  }
  return pagePath ? labels[pagePath] ?? pagePath : ''
}

function stringProp(properties: Record<string, unknown>, key: string): string {
  const value = properties[key]
  return typeof value === 'string' ? value : ''
}

function todayCount(records: BrowseRecord[]): number {
  const today = new Date().toDateString()
  return records.filter((record) => new Date(record.occurredAt).toDateString() === today).length
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
        <Text>时</Text>
      </View>
      <Text className='traceEmptyTitle'>{title}</Text>
      <Text className='traceEmptyText'>{text}</Text>
    </View>
  )
}
