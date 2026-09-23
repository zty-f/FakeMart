import { Input, Text, Textarea, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { ORDER_STATUS_LABELS, type Order, type ProfileTraceSummary, type SavingsOverview } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { SafeImage } from '../../components/SafeImage'
import memberReward from '../../assets/illustrations/member-reward-cutout.webp'
import checkIcon from '../../assets/ui/fluent/check.webp'
import clockIcon from '../../assets/ui/fluent/clock.webp'
import creditCardIcon from '../../assets/ui/fluent/credit-card.webp'
import crownIcon from '../../assets/ui/fluent/crown.webp'
import deliveryTruckIcon from '../../assets/ui/fluent/delivery-truck.webp'
import footprintsIcon from '../../assets/ui/fluent/footprints.webp'
import gearIcon from '../../assets/ui/fluent/gear.webp'
import headphoneIcon from '../../assets/ui/fluent/headphone.webp'
import pinIcon from '../../assets/ui/fluent/pin.webp'
import receiptIcon from '../../assets/ui/fluent/receipt.webp'
import redEnvelopeIcon from '../../assets/ui/fluent/red-envelope.webp'
import repeatIcon from '../../assets/ui/fluent/repeat.webp'
import shoppingBagsIcon from '../../assets/ui/fluent/shopping-bags.webp'
import speechIcon from '../../assets/ui/fluent/speech.webp'
import starIcon from '../../assets/ui/fluent/star.webp'
import storeIcon from '../../assets/ui/fluent/store.webp'
import { addressShort, defaultAddress, setDefaultAddress, syncDefaultAddress } from '../../lib/address'
import { ensureAuth, formatMoney, request, setToken, track } from '../../lib/api'
import './index.scss'

interface UserProfile {
  id: string
  username: string | null
  displayName: string
  avatarUrl?: string | null
  defaultAddressLabel?: string | null
  lastActiveAt?: string | null
  wechatLinked?: boolean
}

interface CouponStats {
  available: number
  used: number
  expired: number
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [savings, setSavings] = useState<SavingsOverview | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [traceSummary, setTraceSummary] = useState<ProfileTraceSummary>({ favoriteCount: 0, footprintCount: 0, followedMerchantCount: 0, browseRecordCount: 0 })
  const [couponStats, setCouponStats] = useState<CouponStats>({ available: 0, used: 0, expired: 0 })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const [addressDraft, setAddressDraft] = useState(defaultAddress())
  const [addressEditing, setAddressEditing] = useState(false)
  const [addressBusy, setAddressBusy] = useState(false)

  async function load() {
    await ensureAuth()
    const [me, savingsResult, orderResult, traceResult, couponResult] = await Promise.all([
      request<{ user: UserProfile }>('/auth/me'),
      request<{ overview: SavingsOverview }>('/analytics/savings'),
      request<{ orders: Order[] }>('/orders'),
      request<{ summary: ProfileTraceSummary }>('/profile/trace-summary'),
      request<{ stats: CouponStats }>('/coupons/center')
    ])
    setUser(me.user)
    setAddressDraft(syncDefaultAddress(me.user?.defaultAddressLabel))
    setSavings(savingsResult.overview)
    setOrders(orderResult.orders)
    setTraceSummary(traceResult.summary)
    setCouponStats(couponResult.stats)
    if (me.user?.username) setUsername(me.user.username)
    track('page_view', { name: 'profile' }, '/pages/profile/index')
  }

  useDidShow(() => {
    load()
      .then(() => {
        const shouldEditAddress = Taro.getStorageSync<string>('fakemart_profile_edit_address')
        if (shouldEditAddress) {
          Taro.removeStorageSync('fakemart_profile_edit_address')
          setAddressEditing(true)
          setTimeout(() => {
            Taro.pageScrollTo({ selector: '.profileAddressCard', duration: 240 }).catch(() => undefined)
          }, 80)
        }
      })
      .catch((error) => console.warn(error))
  })

  async function login() {
    if (!username.trim() || !password.trim()) {
      Taro.showToast({ title: '请输入账号密码', icon: 'none' })
      return
    }
    if (accountBusy) return
    setAccountBusy(true)
    try {
      const isWechatApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
      const endpoint = isWechatApp ? '/auth/link-wechat' : '/auth/login'
      const result = await request<{ token: string; user: UserProfile }>(endpoint, 'POST', { username: username.trim(), password })
      setToken(result.token)
      setUser(result.user)
      setAddressDraft(syncDefaultAddress(result.user.defaultAddressLabel))
      setPassword('')
      await load()
      Taro.showToast({ title: isWechatApp ? '微信已关联' : '登录成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '登录失败', icon: 'none' })
    } finally {
      setAccountBusy(false)
    }
  }

  async function linkWechat() {
    if (accountBusy) return
    setAccountBusy(true)
    try {
      const result = await Taro.login()
      const linked = await request<{ token: string; user: UserProfile }>('/auth/link-wechat', 'POST', { code: result.code })
      setToken(linked.token)
      setUser(linked.user)
      setAddressDraft(syncDefaultAddress(linked.user.defaultAddressLabel))
      await load()
      Taro.showToast({ title: '微信已关联', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '微信关联失败', icon: 'none' })
    } finally {
      setAccountBusy(false)
    }
  }

  async function register() {
    if (!username.trim() || password.length < 6) {
      Taro.showToast({ title: '密码至少 6 位', icon: 'none' })
      return
    }
    if (accountBusy) return
    setAccountBusy(true)
    const endpoint = user?.username ? '/auth/register' : '/auth/bind'
    try {
      const result = await request<{ token: string; user: UserProfile }>(endpoint, 'POST', {
        username: username.trim(),
        password,
        displayName: username.trim()
      })
      setToken(result.token)
      setUser(result.user)
      setAddressDraft(syncDefaultAddress(result.user.defaultAddressLabel))
      setPassword('')
      await load()
      Taro.showToast({ title: endpoint === '/auth/bind' ? '绑定成功' : '注册成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '绑定失败', icon: 'none' })
    } finally {
      setAccountBusy(false)
    }
  }

  function copyAddress() {
    Taro.setClipboardData({ data: addressDraft || defaultAddress() }).catch(() => {
      Taro.showToast({ title: '地址已准备好', icon: 'success' })
    })
  }

  async function saveAddress() {
    if (addressBusy) return
    const next = addressDraft.trim()
    if (!next) {
      Taro.showToast({ title: '请输入收货地址', icon: 'none' })
      return
    }
    setAddressBusy(true)
    try {
      setDefaultAddress(next)
      const result = await request<{ user: UserProfile }>('/auth/me', 'PATCH', { defaultAddressLabel: next })
      setUser(result.user)
      setAddressDraft(syncDefaultAddress(result.user.defaultAddressLabel))
      setAddressEditing(false)
      await track('address_save', {}, '/pages/profile/index')
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
    } finally {
      setAddressBusy(false)
    }
  }

  function editAddress() {
    setAddressDraft(defaultAddress())
    setAddressEditing(true)
    Taro.pageScrollTo({ selector: '.profileAddressCard', duration: 240 }).catch(() => undefined)
  }

  function jumpAccountPanel() {
    Taro.pageScrollTo({ selector: '.profileAccountPanel', duration: 260 }).catch(() => undefined)
  }

  function showDeveloping() {
    Taro.showToast({ title: '功能开发中', icon: 'none' })
  }

  function openOrders(status?: 'created' | 'active' | 'completed' | 'cancelled') {
    Taro.navigateTo({ url: `/pages/orders/index${status ? `?status=${status}` : ''}` })
  }

  function openSavings() {
    Taro.navigateTo({ url: '/pages/savings/index' })
  }

  function openCoupons() {
    Taro.navigateTo({ url: '/pages/coupons/index' })
  }

  function openFavorites() {
    Taro.navigateTo({ url: '/pages/favorites/index' })
  }

  function openFootprints() {
    Taro.navigateTo({ url: '/pages/footprints/index' })
  }

  function openFollowing() {
    Taro.navigateTo({ url: '/pages/following/index' })
  }

  function openBrowseHistory() {
    Taro.navigateTo({ url: '/pages/browse-history/index' })
  }

  const recentOrders = orders.slice(0, 3)
  const orderStats = buildOrderStats(orders)
  const displayName = user?.displayName && user.displayName !== '假装购用户' ? user.displayName : '快乐小海绵'
  const isBound = Boolean(user?.username)

  return (
    <View className='page profilePage'>
      <View className='profileHeader'>
        <View className='profileHeaderActions'>
          <View onClick={showDeveloping}>
            <SafeImage className='profileHeaderActionIcon' src={gearIcon} mode='aspectFit' label='设置' />
          </View>
          <View onClick={showDeveloping}>
            <SafeImage className='profileHeaderActionIcon' src={speechIcon} mode='aspectFit' label='消息' />
          </View>
        </View>
        <View className='profileHeaderTop'>
          <View className='profileAvatar'>
            <SafeImage className='profileAvatarImage' src={memberReward} mode='aspectFit' label={displayName.slice(0, 2).toUpperCase()} />
          </View>
          <View className='profileIdentity'>
            <Text className='profileName'>{displayName}</Text>
            <Text className='profileSub'>{isBound ? `ID: ${maskUsername(user?.username)}` : 'ID: 135****8866'}</Text>
          </View>
          <View className='profileVipBadge'>
            <Text>V4 会员</Text>
          </View>
        </View>
        <View className='profileMemberBar'>
          <View>
            <Text>超级会员</Text>
            <Text>每日最高¥30 · 专属客服 · 免配送费</Text>
          </View>
          <Text onClick={showDeveloping}>立即开通</Text>
        </View>
      </View>

      {!isBound && (
        <View className='profileBindNotice'>
          <View>
            <Text className='profileBindTitle'>先绑定账号，订单和账本才稳</Text>
            <Text className='profileBindText'>设置用户名和密码后，换设备也能继续找回记录和收货地址。</Text>
          </View>
          <View className='profileBindButton' onClick={jumpAccountPanel}>
            <Text>去绑定</Text>
          </View>
        </View>
      )}

      <View className='profileAddressCard'>
        <View className='profileAddressHead'>
          <View>
            <Text className='profileCardLabel'>默认收货地址</Text>
            {!addressEditing && <Text className='profileAddress'>{addressShort(addressDraft)}</Text>}
          </View>
          <View className='profileAddressActions'>
            {!addressEditing && (
              <>
                <View className='profileSmallButton' onClick={copyAddress}>
                  <Text>复制</Text>
                </View>
                <View className='profileSmallButton primary' onClick={editAddress}>
                  <Text>编辑</Text>
                </View>
              </>
            )}
          </View>
        </View>
        {addressEditing && (
          <View className='profileAddressEditor'>
            <Textarea
              className='profileAddressInput'
              value={addressDraft}
              maxlength={1000}
              autoHeight
              placeholder='请输入收货地址'
              onInput={(event) => setAddressDraft(String(event.detail.value))}
            />
            <View className='profileAddressEditorActions'>
              <View
                className='secondaryButton compact'
                onClick={() => {
                  setAddressDraft(defaultAddress())
                  setAddressEditing(false)
                }}
              >
                <Text>取消</Text>
              </View>
              <View className={addressBusy ? 'primaryButton compact disabled' : 'primaryButton compact'} onClick={saveAddress}>
                <Text>{addressBusy ? '保存中' : '保存地址'}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View className='profileStats'>
        <View onClick={openSavings}>
          <Text className='profileStatLabel'>省钱账本</Text>
          <Text className='profileStatValue'>{formatStatMoney(savings?.estimatedTotalSavings)}</Text>
          <Text className='profileStatAction'>去查看</Text>
        </View>
        <View onClick={openSavings}>
          <Text className='profileStatLabel'>今日省下</Text>
          <Text className='profileStatValue'>{formatStatMoney(savings?.todaySavings)}</Text>
          <Text className='profileStatAction'>明细</Text>
        </View>
        <View onClick={() => openOrders()}>
          <Text className='profileStatLabel'>订单数</Text>
          <Text className='profileStatValue'>{savings?.orderCount ?? orders.length} 单</Text>
          <Text className='profileStatAction'>去查看</Text>
        </View>
        <View onClick={openCoupons}>
          <Text className='profileStatLabel'>红包卡券</Text>
          <Text className='profileStatValue'>{couponStats.available} 张</Text>
          <Text className='profileStatAction'>去查看</Text>
        </View>
      </View>

      <View className='section profileOrderPanel'>
        <View className='profilePanelHead'>
          <Text>我的订单</Text>
          <Text onClick={() => openOrders()}>全部订单 ›</Text>
        </View>
        <View className='profileOrderStatus'>
          <View onClick={() => openOrders('created')}>
            <SafeImage className='profileStatusIcon' src={creditCardIcon} mode='aspectFit' label='待付款' />
            <Text className='profileStatusValue'>{orderStats.toPay}</Text>
            <Text className='profileStatusLabel'>待付款</Text>
          </View>
          <View onClick={() => openOrders('active')}>
            <SafeImage className='profileStatusIcon' src={shoppingBagsIcon} mode='aspectFit' label='待发货' />
            <Text className='profileStatusValue'>{orderStats.toShip}</Text>
            <Text className='profileStatusLabel'>待发货</Text>
          </View>
          <View onClick={() => openOrders('active')}>
            <SafeImage className='profileStatusIcon' src={deliveryTruckIcon} mode='aspectFit' label='待收货' />
            <Text className='profileStatusValue'>{orderStats.toReceive}</Text>
            <Text className='profileStatusLabel'>待收货</Text>
          </View>
          <View onClick={() => openOrders('completed')}>
            <SafeImage className='profileStatusIcon' src={speechIcon} mode='aspectFit' label='待评价' />
            <Text className='profileStatusValue'>{orderStats.completed}</Text>
            <Text className='profileStatusLabel'>待评价</Text>
          </View>
          <View onClick={() => openOrders('cancelled')}>
            <SafeImage className='profileStatusIcon' src={repeatIcon} mode='aspectFit' label='退换/售后' />
            <Text className='profileStatusValue'>{orderStats.afterSale}</Text>
            <Text className='profileStatusLabel'>退换/售后</Text>
          </View>
        </View>
      </View>

      <View className='profileTraceRow'>
        <View onClick={openFavorites}>
          <SafeImage className='profileTraceIcon' src={starIcon} mode='aspectFit' label='收藏夹' />
          <Text>收藏夹</Text>
          <Text>{traceSummary.favoriteCount}</Text>
        </View>
        <View onClick={openFootprints}>
          <SafeImage className='profileTraceIcon' src={footprintsIcon} mode='aspectFit' label='足迹' />
          <Text>足迹</Text>
          <Text>{traceSummary.footprintCount}</Text>
        </View>
        <View onClick={openFollowing}>
          <SafeImage className='profileTraceIcon' src={storeIcon} mode='aspectFit' label='关注店铺' />
          <Text>关注店铺</Text>
          <Text>{traceSummary.followedMerchantCount}</Text>
        </View>
        <View onClick={openBrowseHistory}>
          <SafeImage className='profileTraceIcon' src={clockIcon} mode='aspectFit' label='浏览记录' />
          <Text>浏览记录</Text>
          <Text>{traceSummary.browseRecordCount}</Text>
        </View>
      </View>

      <View className='section profileShortcutGrid'>
        <Shortcut icon={checkIcon} title='签到领券' desc='每日红包' badge='领券' onClick={openCoupons} />
        <Shortcut icon={crownIcon} title='会员中心' desc='权益升级' badge='NEW' onClick={showDeveloping} />
        <Shortcut icon={storeIcon} title='积分商城' desc='好物兑换' onClick={showDeveloping} />
        <Shortcut icon={redEnvelopeIcon} title='天天红包' desc='整点开抢' onClick={openCoupons} />
        <Shortcut icon={pinIcon} title='收货地址' desc='编辑默认' onClick={editAddress} />
        <Shortcut icon={headphoneIcon} title='客服中心' desc='在线帮忙' onClick={showDeveloping} />
        <Shortcut icon={receiptIcon} title='发票助手' desc='抬头管理' onClick={showDeveloping} />
        <Shortcut icon={gearIcon} title='设置' desc='账号管理' onClick={showDeveloping} />
      </View>

      <View className='profileCouponBanner' onClick={showDeveloping}>
        <View>
          <Text>邀请好友 赚现金红包</Text>
          <Text>最高得 ¥30</Text>
        </View>
        <SafeImage className='profileCouponImage' src={memberReward} mode='aspectFit' label='红包' />
        <Text>去邀请</Text>
      </View>

      <View className='section'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>近期订单</Text>
          <Text className='muted' onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>全部</Text>
        </View>
        <View className='profileRecentList'>
          {recentOrders.length === 0 ? (
            <View className='empty'>还没有订单，先去逛逛</View>
          ) : (
            recentOrders.map((order) => <RecentOrderCard order={order} key={order.id} />)
          )}
        </View>
      </View>

      <View className='section profileAccountPanel'>
        <View className='sectionHead'>
          <Text className='sectionTitle'>{isBound ? '账号状态' : '绑定账号'}</Text>
          <Text className='muted'>{isBound ? (user?.wechatLinked ? '微信已关联' : '微信未关联') : '用户名密码'}</Text>
        </View>
        {isBound ? (
          <View className='profileBoundCard'>
            <Text className='profileBoundName'>{user?.username}</Text>
            <Text className='profileBoundText'>订单、账本和收货地址已关联到这个账号。</Text>
            {!user?.wechatLinked && Taro.getEnv() === Taro.ENV_TYPE.WEAPP && (
              <View className={accountBusy ? 'primaryButton disabled' : 'primaryButton'} onClick={linkWechat}>
                <Text>{accountBusy ? '关联中...' : '绑定微信登录'}</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <Input className='accountInput' value={username} placeholder='设置或输入用户名' onInput={(event) => setUsername(String(event.detail.value))} />
            <Input className='accountInput' value={password} password placeholder='输入密码，至少 6 位' onInput={(event) => setPassword(String(event.detail.value))} />
            <View className='profileAccountActions'>
              <View className={accountBusy ? 'secondaryButton disabled' : 'secondaryButton'} onClick={login}>
                <Text>{Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? '绑定已有账号' : '登录已有账号'}</Text>
              </View>
              <View className={accountBusy ? 'primaryButton disabled' : 'primaryButton'} onClick={register}>
                <Text>{accountBusy ? '处理中...' : '绑定当前记录'}</Text>
              </View>
            </View>
          </>
        )}
      </View>
      <BottomNav active='profile' />
    </View>
  )
}

function buildOrderStats(orders: Order[]) {
  return {
    toPay: orders.filter((order) => order.status === 'created').length,
    toShip: orders.filter((order) => ['virtual_paid', 'warehouse_processing', 'merchant_accepted', 'preparing'].includes(order.status)).length,
    toReceive: orders.filter((order) => ['packed', 'outbound', 'in_transit', 'delivering', 'rider_assigned', 'picked_up', 'arriving'].includes(order.status)).length,
    completed: orders.filter((order) => order.status === 'completed').length,
    afterSale: orders.filter((order) => order.status === 'cancelled').length
  }
}

function formatDate(value?: string | null): string {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatStatMoney(value = 0): string {
  const yuan = value / 100
  if (yuan >= 10000) {
    const amount = yuan / 10000
    return `¥${amount >= 100 ? amount.toFixed(0) : amount.toFixed(1)}万`
  }
  return formatMoney(value)
}

function maskUsername(value?: string | null): string {
  if (!value) return '135****8866'
  if (value.length <= 4) return `${value.slice(0, 1)}***`
  return `${value.slice(0, 3)}****${value.slice(-2)}`
}

function Shortcut({ icon, title, desc, badge, onClick }: { icon: string; title: string; desc: string; badge?: string; onClick: () => void }) {
  return (
    <View className='profileShortcut' onClick={onClick}>
      {badge && <Text className='profileShortcutBadge'>{badge}</Text>}
      <View className='profileShortcutIcon'>
        <SafeImage className='profileShortcutImage' src={icon} mode='aspectFit' label={title} />
      </View>
      <View>
        <Text className='profileShortcutTitle'>{title}</Text>
        <Text className='profileShortcutDesc'>{desc}</Text>
      </View>
    </View>
  )
}

function RecentOrderCard({ order }: { order: Order }) {
  const firstItem = order.items[0]
  const extraCount = Math.max(order.itemCount - 1, 0)
  return (
    <View className='profileOrderCard' onClick={() => Taro.navigateTo({ url: `/pages/order/detail?id=${order.id}` })}>
      {firstItem && <SafeImage className='profileOrderImage' src={firstItem.imageUrl} mode='aspectFill' label={firstItem.title} />}
      <View className='profileOrderBody'>
        <View className='profileOrderTop'>
          <Text className='profileOrderTitle'>{firstItem?.title ?? order.orderNo}</Text>
          <Text className='profileOrderStatusText'>{ORDER_STATUS_LABELS[order.status]}</Text>
        </View>
        <Text className='profileOrderMeta'>
          {order.orderType === 'food_delivery' ? '外卖' : '购物'} · {formatDate(order.createdAt)}{extraCount ? ` · 另 ${extraCount} 件` : ''}
        </Text>
        <View className='profileOrderFoot'>
          <Text>{formatMoney(order.totalVirtualAmount)}</Text>
          <Text>查看详情</Text>
        </View>
      </View>
    </View>
  )
}
