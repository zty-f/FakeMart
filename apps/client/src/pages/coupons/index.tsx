import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { CouponTemplate, UserCoupon } from '@fakemart/shared'
import { SafeImage } from '../../components/SafeImage'
import redEnvelopeIcon from '../../assets/ui/fluent/red-envelope.png'
import shoppingBagsIcon from '../../assets/ui/fluent/shopping-bags.png'
import cupStrawIcon from '../../assets/ui/fluent/cup-straw.png'
import { ensureAuth, request, track } from '../../lib/api'
import './index.scss'

interface CouponStats {
  available: number
  used: number
  expired: number
}

type CouponTab = 'center' | 'mine'

export default function CouponsPage() {
  const [tab, setTab] = useState<CouponTab>('center')
  const [templates, setTemplates] = useState<CouponTemplate[]>([])
  const [coupons, setCoupons] = useState<UserCoupon[]>([])
  const [stats, setStats] = useState<CouponStats>({ available: 0, used: 0, expired: 0 })
  const [claimingId, setClaimingId] = useState('')

  async function load() {
    await ensureAuth()
    const [centerResult, couponResult] = await Promise.all([
      request<{ templates: CouponTemplate[]; stats: CouponStats }>('/coupons/center'),
      request<{ coupons: UserCoupon[] }>('/coupons?status=all')
    ])
    setTemplates(centerResult.templates)
    setStats(centerResult.stats)
    setCoupons(couponResult.coupons)
    await track('coupon_page_view', { tab }, '/pages/coupons/index')
  }

  useDidShow(() => {
    load().catch((error) => console.warn(error))
  })

  async function claim(template: CouponTemplate) {
    if (!template.canClaim || claimingId) return
    setClaimingId(template.id)
    try {
      await request(`/coupons/${template.id}/claim`, 'POST')
      await track('coupon_claim_click', { templateId: template.id }, '/pages/coupons/index')
      Taro.showToast({ title: '领取成功', icon: 'success' })
      await load()
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '领取失败', icon: 'none' })
    } finally {
      setClaimingId('')
    }
  }

  function goBack() {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
      return
    }
    Taro.redirectTo({ url: '/pages/index/index' })
  }

  const availableCoupons = coupons.filter((coupon) => coupon.status === 'available')
  const unavailableCoupons = coupons.filter((coupon) => coupon.status !== 'available')

  return (
    <View className='page couponsPage'>
      <View className='couponTopBar'>
        <Text onClick={goBack}>‹</Text>
        <Text>优惠券</Text>
        <Text onClick={() => setTab('mine')}>我的</Text>
      </View>

      <View className='couponHero'>
        <View>
          <Text className='couponHeroLabel'>领券中心</Text>
          <Text className='couponHeroTitle'>下单前，先薅一张</Text>
          <Text className='couponHeroText'>商城、外卖、无门槛券都在这里，支付时自动抵扣。</Text>
        </View>
        <SafeImage className='couponHeroIcon' src={redEnvelopeIcon} mode='aspectFit' label='优惠券' />
      </View>

      <View className='couponStats'>
        <View>
          <Text>{stats.available}</Text>
          <Text>可用</Text>
        </View>
        <View>
          <Text>{stats.used}</Text>
          <Text>已用</Text>
        </View>
        <View>
          <Text>{stats.expired}</Text>
          <Text>过期</Text>
        </View>
      </View>

      <View className='couponTabs'>
        <View className={tab === 'center' ? 'couponTab active' : 'couponTab'} onClick={() => setTab('center')}>
          <Text>领券中心</Text>
        </View>
        <View className={tab === 'mine' ? 'couponTab active' : 'couponTab'} onClick={() => setTab('mine')}>
          <Text>我的卡券</Text>
        </View>
      </View>

      {tab === 'center' ? (
        <View className='couponList'>
          {templates.map((template) => (
            <TemplateCard template={template} claiming={claimingId === template.id} onClaim={claim} key={template.id} />
          ))}
        </View>
      ) : (
        <View className='couponList'>
          {availableCoupons.length === 0 ? (
            <View className='couponEmpty'>
              <Text>暂时没有可用券</Text>
              <Text>去领券中心补充一点快乐额度</Text>
            </View>
          ) : (
            <ScrollView className='couponUseStrip' scrollX>
              <View className='couponUseTrack'>
                <View onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}>
                  <SafeImage className='couponUseIcon' src={shoppingBagsIcon} mode='aspectFit' label='狂购' />
                  <Text>去狂购</Text>
                </View>
                <View onClick={() => Taro.redirectTo({ url: '/pages/food/index' })}>
                  <SafeImage className='couponUseIcon' src={cupStrawIcon} mode='aspectFit' label='狂吃' />
                  <Text>去狂吃</Text>
                </View>
              </View>
            </ScrollView>
          )}
          {availableCoupons.map((coupon) => <UserCouponCard coupon={coupon} key={coupon.id} />)}
          {unavailableCoupons.length > 0 && <Text className='couponGroupTitle'>历史卡券</Text>}
          {unavailableCoupons.map((coupon) => <UserCouponCard coupon={coupon} key={coupon.id} />)}
        </View>
      )}
    </View>
  )
}

function TemplateCard({ template, claiming, onClaim }: { template: CouponTemplate; claiming: boolean; onClaim: (template: CouponTemplate) => void }) {
  return (
    <View className='couponCard'>
      <View className='couponAmount'>
        <Text>{formatCouponAmount(template.discountAmount)}</Text>
        <Text>{template.thresholdAmount === 0 ? '无门槛' : `满${formatThreshold(template.thresholdAmount)}可用`}</Text>
      </View>
      <View className='couponBody'>
        <Text className='couponTitle'>{template.title}</Text>
        <Text className='couponDesc'>{template.description}</Text>
        <View className='couponTags'>
          <Text>{scopeText(template.scope)}</Text>
          <Text>{formatDate(template.endsAt)} 到期</Text>
        </View>
      </View>
      <View className={template.canClaim ? 'couponAction' : 'couponAction disabled'} onClick={() => onClaim(template)}>
        <Text>{claiming ? '领取中' : template.claimText || '领取'}</Text>
      </View>
    </View>
  )
}

function UserCouponCard({ coupon }: { coupon: UserCoupon }) {
  return (
    <View className={coupon.status === 'available' ? 'couponCard user' : 'couponCard user unavailable'}>
      <View className='couponAmount'>
        <Text>{formatCouponAmount(coupon.discountAmount)}</Text>
        <Text>{coupon.thresholdAmount === 0 ? '无门槛' : `满${formatThreshold(coupon.thresholdAmount)}可用`}</Text>
      </View>
      <View className='couponBody'>
        <Text className='couponTitle'>{coupon.title}</Text>
        <Text className='couponDesc'>{coupon.description}</Text>
        <View className='couponTags'>
          <Text>{scopeText(coupon.scope)}</Text>
          <Text>{coupon.status === 'used' ? '已使用' : coupon.status === 'expired' ? '已过期' : `${formatDate(coupon.expiresAt)} 到期`}</Text>
        </View>
      </View>
      <View className='couponStatusPill'>
        <Text>{coupon.status === 'available' ? '可用' : coupon.status === 'used' ? '已用' : '过期'}</Text>
      </View>
    </View>
  )
}

function formatCouponAmount(cents: number): string {
  return `¥${Math.round(cents / 100)}`
}

function formatThreshold(cents: number): string {
  return `${Math.round(cents / 100)}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(5, 10)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function scopeText(scope: string): string {
  if (scope === 'shopping') return '限商城'
  if (scope === 'food_delivery') return '限外卖'
  return '全场通用'
}
