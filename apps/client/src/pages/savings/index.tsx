import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { SavingsOverview } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { SafeImage } from '../../components/SafeImage'
import memberReward from '../../assets/illustrations/member-reward-cutout.png'
import checkIcon from '../../assets/ui/fluent/check.png'
import clockIcon from '../../assets/ui/fluent/clock.png'
import receiptIcon from '../../assets/ui/fluent/receipt.png'
import starIcon from '../../assets/ui/fluent/star.png'
import { ensureAuth, formatMoney, request, track } from '../../lib/api'
import './index.scss'

export default function SavingsPage() {
  const [overview, setOverview] = useState<SavingsOverview | null>(null)

  async function load() {
    await ensureAuth()
    const result = await request<{ overview: SavingsOverview }>('/analytics/savings')
    setOverview(result.overview)
    track('savings_view', {}, '/pages/savings/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  function backProfile() {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
      return
    }
    Taro.redirectTo({ url: '/pages/profile/index' })
  }

  const trend = overview?.trend ?? []
  const maxTrend = Math.max(...trend.map((item) => item.simulated + item.opportunity), 1)
  const breakdown = overview?.categoryBreakdown ?? []
  const maxCategoryAmount = Math.max(...breakdown.map((item) => item.amount), 1)

  return (
    <View className='page savingsPage'>
      <View className='savingsTopBar'>
        <Text onClick={backProfile}>返回</Text>
        <Text>省钱账本</Text>
        <Text onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>订单</Text>
      </View>

      <View className='savingsHero'>
        <View className='savingsHeroCopy'>
          <Text className='savingsHeroLabel'>账本总额</Text>
          <Text className='savingsHeroAmount'>{formatMoney(overview?.estimatedTotalSavings ?? 0)}</Text>
          <Text className='savingsHeroText'>每一次克制、每一次下单，都帮你记得清清楚楚。</Text>
        </View>
        <SafeImage className='savingsHeroImage' src={memberReward} mode='aspectFit' label='账本' />
      </View>

      <View className='savingsMetricGrid'>
        <SavingsMetric icon={checkIcon} label='下单省下' value={formatMoney(overview?.simulatedOrderSavings ?? 0)} />
        <SavingsMetric icon={starIcon} label='浏览守住' value={formatMoney(overview?.productViewOpportunity ?? 0)} />
        <SavingsMetric icon={clockIcon} label='最爱未结算' value={formatMoney(overview?.cartAbandonedOpportunity ?? 0)} />
        <SavingsMetric icon={receiptIcon} label='累计订单' value={`${overview?.orderCount ?? 0} 单`} />
      </View>

      <View className='savingsPeriodPanel'>
        <View>
          <Text>今日</Text>
          <Text>{formatMoney(overview?.todaySavings ?? 0)}</Text>
        </View>
        <View>
          <Text>本周</Text>
          <Text>{formatMoney(overview?.weekSavings ?? 0)}</Text>
        </View>
        <View>
          <Text>本月</Text>
          <Text>{formatMoney(overview?.monthSavings ?? 0)}</Text>
        </View>
      </View>

      <View className='section savingsTrendPanel'>
        <View className='sectionHead savingsPanelHead'>
          <Text className='sectionTitle'>14 天趋势</Text>
          <Text className='muted'>账本曲线</Text>
        </View>
        {trend.length === 0 ? (
          <SavingsEmpty title='曲线正在准备' text='逛几次、下几单，这里就会长出漂亮的记录。' />
        ) : (
          <View className='savingsTrendBars'>
            {trend.map((item) => {
              const amount = item.simulated + item.opportunity
              const height = Math.max(12, Math.round((amount / maxTrend) * 92))
              return (
                <View className='savingsTrendItem' key={item.date}>
                  <View className='savingsTrendTrack'>
                    <View className='savingsTrendBar' style={{ height: `${height}px` }} />
                  </View>
                  <Text>{formatTrendDate(item.date)}</Text>
                </View>
              )
            })}
          </View>
        )}
      </View>

      <View className='section savingsBreakdownPanel'>
        <View className='sectionHead savingsPanelHead'>
          <Text className='sectionTitle'>分类统计</Text>
          <Text className='muted'>{overview?.orderCount ?? 0} 个订单</Text>
        </View>
        <View className='savingsBreakdownList'>
          {breakdown.length === 0 ? (
            <SavingsEmpty title='分类还在等第一笔' text='数码、零食、外卖都会按类目自动归档。' compact />
          ) : (
            breakdown.map((item) => (
              <View className='savingsBreakdownRow' key={item.categoryId}>
                <View className='savingsBreakdownTop'>
                  <Text>{item.categoryName}</Text>
                  <Text>{formatMoney(item.amount)}</Text>
                </View>
                <View className='savingsBreakdownTrack'>
                  <View className='savingsBreakdownBar' style={{ width: `${Math.max(8, Math.round((item.amount / maxCategoryAmount) * 100))}%` }} />
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      <View className='savingsActionStrip'>
        <View onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}>
          <Text>继续狂购</Text>
          <Text>看看今日好价</Text>
        </View>
        <View onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
          <Text>查看订单</Text>
          <Text>进度都在这里</Text>
        </View>
      </View>

      <BottomNav active='profile' />
    </View>
  )
}

function SavingsEmpty({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <View className={compact ? 'savingsEmptyState compact' : 'savingsEmptyState'}>
      <View className='savingsEmptyBadge'>
        <Text>FM</Text>
      </View>
      <View>
        <Text>{title}</Text>
        <Text>{text}</Text>
      </View>
    </View>
  )
}

function SavingsMetric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className='savingsMetric'>
      <SafeImage className='savingsMetricIcon' src={icon} mode='aspectFit' label={label} />
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}

function formatTrendDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(5)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
