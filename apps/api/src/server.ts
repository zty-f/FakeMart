import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type OrderType,
  statusFlowForOrderType
} from '@fakemart/shared'
import { config } from './config.js'
import { closePool, exec, migrate, row, rows, withTransaction } from './db/client.js'
import { seedDatabase } from './db/seed.js'

type AnyRow = Record<string, any>
type AuthPayload = { sub: string; role: 'user' | 'admin'; username?: string }

const DEFAULT_ADDRESS_LABEL = '奥特曼 星期八 138****7788 光之国银河路 7 号 宇宙便利店楼上 302'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info'
  }
})

const scheduledOrders = new Map<string, NodeJS.Timeout[]>()

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || config.corsOrigin.includes(origin)) {
      callback(null, true)
      return
    }
    callback(null, false)
  },
  credentials: true
})

await app.register(jwt, {
  secret: config.jwtSecret
})

function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date().toISOString()
}

function nullableIso(value: unknown): string | null {
  if (!value) return null
  return iso(value)
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function orderNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `FM${date}${Math.floor(Math.random() * 900000 + 100000)}`
}

function publicProduct(product: AnyRow) {
  return {
    id: product.id,
    merchantId: product.merchant_id,
    categoryId: product.category_id,
    orderType: product.order_type,
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    imageUrl: product.image_url,
    virtualPrice: Number(product.virtual_price),
    compareAtPrice: Number(product.compare_at_price),
    virtualStock: Number(product.virtual_stock),
    virtualSalesCount: Number(product.virtual_sales_count),
    tags: json<string[]>(product.tags, []),
    status: product.status,
    recommendationWeight: Number(product.recommendation_weight ?? 0)
  }
}

function publicCategory(category: AnyRow) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    description: category.description,
    sortOrder: Number(category.sort_order)
  }
}

function publicMerchant(merchant: AnyRow) {
  return {
    id: merchant.id,
    name: merchant.name,
    type: merchant.type,
    logoUrl: merchant.logo_url,
    rating: Number(merchant.rating),
    deliveryMinutes: Number(merchant.delivery_minutes),
    minOrderAmount: Number(merchant.min_order_amount),
    deliveryFee: Number(merchant.delivery_fee),
    tags: json<string[]>(merchant.tags, [])
  }
}

function publicMerchantFollow(follow: AnyRow) {
  return {
    id: follow.follow_id,
    followedAt: iso(follow.followed_at),
    merchant: publicMerchant(follow)
  }
}

function normalizeAddressLabel(value?: string | null): string {
  const trimmed = value?.trim()
  return trimmed || DEFAULT_ADDRESS_LABEL
}

function publicUser(user: AnyRow) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    defaultAddressLabel: normalizeAddressLabel(user.default_address_label),
    createdAt: user.created_at ? iso(user.created_at) : null,
    lastActiveAt: user.last_active_at ? nullableIso(user.last_active_at) : null
  }
}

function stableNumber(input: string, min: number, max: number): number {
  const range = max - min + 1
  const hash = input.split('').reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 100000, 7)
  return min + (hash % range)
}

function publicMerchantSection(merchant: AnyRow, products: AnyRow[]) {
  const merchantTags = json<string[]>(merchant.tags, [])
  const monthlySales = Math.max(
    stableNumber(`${merchant.id}_sales`, 360, merchant.type === 'food_delivery' ? 5200 : 8600),
    Math.round(Number(merchant.total_sales ?? 0) / 5)
  )
  const distanceMeters = stableNumber(`${merchant.id}_distance`, 420, merchant.type === 'food_delivery' ? 3600 : 7800)
  const promotionTags =
    merchant.type === 'food_delivery'
      ? [
          `满${Math.max(20, Math.round(Number(merchant.min_order_amount ?? 0) / 100))}减${stableNumber(`${merchant.id}_off`, 4, 12)}`,
          Number(merchant.delivery_fee) === 0 ? '免配送费' : `配送 ¥${(Number(merchant.delivery_fee) / 100).toFixed(0)}`,
          merchantTags[0] ?? '附近好评'
        ]
      : [
          `店铺券满${stableNumber(`${merchant.id}_coupon_base`, 99, 399)}减${stableNumber(`${merchant.id}_coupon`, 10, 60)}`,
          Number(merchant.delivery_fee) === 0 ? '包邮' : '快速发货',
          merchantTags[0] ?? '精选店铺'
        ]

  return {
    merchant: publicMerchant(merchant),
    products: products.map(publicProduct),
    monthlySales,
    distanceMeters,
    promotionTags
  }
}

function publicStatusEvent(event: AnyRow) {
  return {
    id: event.id,
    orderId: event.order_id,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    title: event.title,
    description: event.description,
    triggerType: event.trigger_type,
    occurredAt: iso(event.occurred_at)
  }
}

function publicOrderReview(review: AnyRow) {
  return {
    id: review.id,
    orderId: review.order_id,
    userId: review.user_id,
    rating: Number(review.rating),
    content: review.content,
    tags: json<string[]>(review.tags, []),
    createdAt: iso(review.created_at),
    updatedAt: iso(review.updated_at)
  }
}

function publicReviewFeedItem(review: AnyRow) {
  return {
    id: review.id,
    orderId: review.order_id,
    orderNo: review.order_no,
    userDisplayName: review.display_name || '假装购用户',
    rating: Number(review.rating),
    content: review.content,
    tags: json<string[]>(review.tags, []),
    itemTitles: String(review.item_titles || '')
      .split('、')
      .map((item) => item.trim())
      .filter(Boolean),
    createdAt: iso(review.created_at),
    updatedAt: iso(review.updated_at)
  }
}

async function publicOrder(order: AnyRow) {
  const items = await rows(
    `SELECT id, product_id, title, image_url, unit_price, quantity, subtotal_amount
     FROM order_items WHERE order_id = ? ORDER BY created_at ASC`,
    [order.id]
  )
  const events = await rows(
    `SELECT id, order_id, from_status, to_status, title, description, trigger_type, occurred_at
     FROM order_status_events WHERE order_id = ? ORDER BY occurred_at ASC`,
    [order.id]
  )
  const review = await row(
    `SELECT id, order_id, user_id, rating, content, tags, created_at, updated_at
     FROM order_reviews WHERE order_id = ?`,
    [order.id]
  )

  return {
    id: order.id,
    orderNo: order.order_no,
    userId: order.user_id,
    orderType: order.order_type,
    status: order.status,
    originalAmount: Number(order.original_amount || Number(order.total_virtual_amount) + Number(order.coupon_discount_amount ?? 0)),
    totalVirtualAmount: Number(order.total_virtual_amount),
    savedAmount: Number(order.saved_amount),
    couponId: order.coupon_id ?? null,
    couponName: order.coupon_name ?? null,
    couponDiscountAmount: Number(order.coupon_discount_amount ?? 0),
    itemCount: Number(order.item_count),
    virtualPaymentMethod: order.virtual_payment_method,
    virtualAddressLabel: order.virtual_address_label,
    createdAt: iso(order.created_at),
    completedAt: nullableIso(order.completed_at),
    canceledAt: nullableIso(order.canceled_at),
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      title: item.title,
      imageUrl: item.image_url,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
      subtotalAmount: Number(item.subtotal_amount)
    })),
    events: events.map(publicStatusEvent),
    review: review ? publicOrderReview(review) : null
  }
}

async function reviewSummary(scope: { productId?: string; merchantId?: string }) {
  const existsSql = scope.productId
    ? `EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = rv.order_id AND oi.product_id = ?)`
    : `EXISTS (
        SELECT 1 FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = rv.order_id AND p.merchant_id = ?
      )`
  const scopeId = scope.productId ?? scope.merchantId
  const [summary, distribution, tagRows] = await Promise.all([
    row(`SELECT COUNT(*) count, COALESCE(AVG(rv.rating), 0) average_rating FROM order_reviews rv WHERE ${existsSql}`, [scopeId]),
    rows(`SELECT rv.rating, COUNT(*) count FROM order_reviews rv WHERE ${existsSql} GROUP BY rv.rating ORDER BY rv.rating DESC`, [scopeId]),
    rows(`SELECT rv.tags FROM order_reviews rv WHERE ${existsSql} ORDER BY rv.updated_at DESC LIMIT 200`, [scopeId])
  ])
  const tagCounts = new Map<string, number>()
  for (const item of tagRows) {
    for (const tag of json<string[]>(item.tags, [])) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  return {
    count: Number(summary?.count ?? 0),
    averageRating: Number(Number(summary?.average_rating ?? 0).toFixed(1)),
    distribution: distribution.map((item) => ({ rating: Number(item.rating), count: Number(item.count) })),
    topTags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }))
  }
}

async function reviewFeed(scope: { productId?: string; merchantId?: string }, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50)
  if (scope.productId) {
    return rows(
      `SELECT rv.*, u.display_name, o.order_no,
        (
          SELECT GROUP_CONCAT(DISTINCT oi.title ORDER BY oi.created_at SEPARATOR '、')
          FROM order_items oi
          WHERE oi.order_id = rv.order_id AND oi.product_id = ?
        ) item_titles
       FROM order_reviews rv
       JOIN orders o ON o.id = rv.order_id
       JOIN users u ON u.id = rv.user_id
       WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = rv.order_id AND oi.product_id = ?)
       ORDER BY rv.updated_at DESC
       LIMIT ${safeLimit}`,
      [scope.productId, scope.productId]
    )
  }

  return rows(
    `SELECT rv.*, u.display_name, o.order_no,
      (
        SELECT GROUP_CONCAT(DISTINCT oi.title ORDER BY oi.created_at SEPARATOR '、')
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = rv.order_id AND p.merchant_id = ?
      ) item_titles
     FROM order_reviews rv
     JOIN orders o ON o.id = rv.order_id
     JOIN users u ON u.id = rv.user_id
     WHERE EXISTS (
       SELECT 1 FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = rv.order_id AND p.merchant_id = ?
     )
     ORDER BY rv.updated_at DESC
     LIMIT ${safeLimit}`,
    [scope.merchantId, scope.merchantId]
  )
}

function couponStatus(coupon: AnyRow): 'available' | 'used' | 'expired' {
  if (coupon.status === 'used') return 'used'
  const expiresAt = coupon.expires_at ?? coupon.ends_at
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return 'expired'
  return 'available'
}

function couponScopeMatches(scope: string, orderType: OrderType): boolean {
  return scope === 'all' || scope === orderType
}

function couponEligibility(coupon: AnyRow, orderType: OrderType, amount: number): { canUse: boolean; reason: string } {
  const status = couponStatus(coupon)
  if (status !== 'available') return { canUse: false, reason: status === 'used' ? '已使用' : '已过期' }
  if (coupon.template_status && coupon.template_status !== 'active') return { canUse: false, reason: '暂不可用' }
  if (!couponScopeMatches(String(coupon.scope), orderType)) return { canUse: false, reason: orderType === 'food_delivery' ? '限商城订单' : '限外卖订单' }
  if (Number(coupon.threshold_amount) > amount) {
    return { canUse: false, reason: `还差${formatCouponMoney(Number(coupon.threshold_amount) - amount)}可用` }
  }
  return { canUse: true, reason: '' }
}

function formatCouponMoney(cents: number): string {
  return `¥${(cents / 100).toFixed(0)}`
}

function publicCouponTemplate(template: AnyRow) {
  const totalQuantity = template.total_quantity == null ? null : Number(template.total_quantity)
  const claimedCount = Number(template.claimed_count ?? 0)
  const userClaimedCount = Number(template.user_claimed_count ?? 0)
  const perUserLimit = Number(template.per_user_limit ?? 1)
  const soldOut = totalQuantity != null && claimedCount >= totalQuantity
  const inactive = template.status !== 'active' || new Date(template.ends_at).getTime() <= Date.now()
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    scope: template.scope,
    thresholdAmount: Number(template.threshold_amount),
    discountAmount: Number(template.discount_amount),
    totalQuantity,
    claimedCount,
    perUserLimit,
    startsAt: iso(template.starts_at),
    endsAt: iso(template.ends_at),
    status: template.status,
    sortOrder: Number(template.sort_order ?? 0),
    userClaimedCount,
    canClaim: !soldOut && !inactive && userClaimedCount < perUserLimit,
    claimText: inactive ? '已结束' : soldOut ? '已抢光' : userClaimedCount >= perUserLimit ? '已领取' : '立即领取'
  }
}

function publicUserCoupon(coupon: AnyRow, orderType?: OrderType, amount?: number) {
  const status = couponStatus(coupon)
  const eligibility = orderType && amount != null ? couponEligibility(coupon, orderType, amount) : { canUse: status === 'available', reason: '' }
  return {
    id: coupon.id,
    templateId: coupon.template_id,
    title: coupon.title,
    description: coupon.description,
    scope: coupon.scope,
    thresholdAmount: Number(coupon.threshold_amount),
    discountAmount: Number(coupon.discount_amount),
    status,
    claimedAt: iso(coupon.claimed_at),
    usedAt: nullableIso(coupon.used_at),
    expiresAt: iso(coupon.expires_at),
    orderId: coupon.order_id ?? null,
    canUse: eligibility.canUse,
    unusableReason: eligibility.reason
  }
}

async function updateExpiredCoupons(userId: string): Promise<void> {
  await exec(`UPDATE user_coupons SET status = 'expired' WHERE user_id = ? AND status = 'available' AND expires_at <= NOW()`, [userId])
}

async function findEligibleCoupons(userId: string, orderType: OrderType, amount: number): Promise<AnyRow[]> {
  await updateExpiredCoupons(userId)
  const result = await rows(
    `SELECT uc.*, ct.title, ct.description, ct.scope, ct.threshold_amount, ct.discount_amount, ct.status template_status
     FROM user_coupons uc
     JOIN coupon_templates ct ON ct.id = uc.template_id
     WHERE uc.user_id = ? AND uc.status = 'available' AND uc.expires_at > NOW()
     ORDER BY ct.discount_amount DESC, ct.threshold_amount ASC, uc.claimed_at ASC`,
    [userId]
  )
  return result.filter((coupon) => couponEligibility(coupon, orderType, amount).canUse)
}

async function chooseCouponForOrder(userId: string, couponId: string | undefined, autoCoupon: boolean, orderType: OrderType, amount: number): Promise<AnyRow | null> {
  if (couponId) {
    const coupon = await row(
      `SELECT uc.*, ct.title, ct.description, ct.scope, ct.threshold_amount, ct.discount_amount, ct.status template_status
       FROM user_coupons uc
       JOIN coupon_templates ct ON ct.id = uc.template_id
       WHERE uc.id = ? AND uc.user_id = ?`,
      [couponId, userId]
    )
    if (!coupon) throw new Error('优惠券不存在')
    const eligibility = couponEligibility(coupon, orderType, amount)
    if (!eligibility.canUse) throw new Error(eligibility.reason || '优惠券不可用')
    return coupon
  }
  if (!autoCoupon) return null
  const coupons = await findEligibleCoupons(userId, orderType, amount)
  return coupons[0] ?? null
}

function statusDescription(status: OrderStatus, orderType: OrderType): string {
  const shopping: Partial<Record<OrderStatus, string>> = {
    created: '订单已提交，等待支付。',
    virtual_paid: '支付成功，省钱账本已更新。',
    warehouse_processing: '仓库正在处理商品。',
    packed: '商品已打包完成。',
    outbound: '包裹已从仓库发出。',
    in_transit: '包裹运输中。',
    delivering: '配送员正在前往收货地址。',
    completed: '订单已完成，今天也稳稳拿捏。'
  }
  const food: Partial<Record<OrderStatus, string>> = {
    created: '外卖订单已提交，等待支付。',
    virtual_paid: '支付成功，商家即将接单。',
    merchant_accepted: '商家已接单。',
    preparing: '餐品正在制作中。',
    rider_assigned: '骑手已接单。',
    picked_up: '骑手已取餐。',
    arriving: '骑手即将送达。',
    completed: '订单已完成，这一餐安排得明明白白。'
  }
  return (orderType === 'food_delivery' ? food[status] : shopping[status]) ?? ORDER_STATUS_LABELS[status]
}

function nextStatusDelay(orderType: OrderType, status: OrderStatus): number {
  const foodDelays: Partial<Record<OrderStatus, number>> = {
    virtual_paid: 4500,
    merchant_accepted: 6500,
    preparing: 8500,
    rider_assigned: 5500,
    picked_up: 7000,
    arriving: 5500
  }
  const shoppingDelays: Partial<Record<OrderStatus, number>> = {
    virtual_paid: 6500,
    warehouse_processing: 8500,
    packed: 7000,
    outbound: 7500,
    in_transit: 9000,
    delivering: 7000
  }
  return (orderType === 'food_delivery' ? foodDelays[status] : shoppingDelays[status]) ?? 7000
}

async function tokenPayload(request: FastifyRequest): Promise<AuthPayload | null> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    return app.jwt.verify<AuthPayload>(header.slice('Bearer '.length))
  } catch {
    return null
  }
}

async function userIdFromRequest(request: FastifyRequest): Promise<string> {
  const payload = await tokenPayload(request)
  if (payload?.role === 'user') {
    await exec('UPDATE users SET last_active_at = NOW() WHERE id = ?', [payload.sub])
    return payload.sub
  }
  return 'demo-user'
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const payload = await tokenPayload(request)
  if (payload?.role !== 'admin') {
    await reply.code(401).send({ message: 'Admin token required' })
  }
}

async function signUser(userId: string, username?: string): Promise<string> {
  return app.jwt.sign({ sub: userId, role: 'user', username } satisfies AuthPayload, { expiresIn: '30d' })
}

async function signAdmin(adminId: string, username: string): Promise<string> {
  return app.jwt.sign({ sub: adminId, role: 'admin', username } satisfies AuthPayload, { expiresIn: '12h' })
}

async function logOperation(
  request: FastifyRequest,
  action: string,
  targetType: string,
  targetId: string | null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  const payload = await tokenPayload(request)
  await exec(
    `INSERT INTO operation_logs (id, admin_user_id, action, target_type, target_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [`op_${nanoid(12)}`, payload?.role === 'admin' ? payload.sub : null, action, targetType, targetId, JSON.stringify(detail)]
  )
}

async function ensureCart(userId: string): Promise<string> {
  const existing = await row('SELECT id FROM carts WHERE user_id = ?', [userId])
  if (existing) return existing.id
  const id = `cart_${nanoid(12)}`
  await exec('INSERT INTO carts (id, user_id) VALUES (?, ?)', [id, userId])
  return id
}

async function createSavingsOpportunity(params: {
  userId: string
  sessionId: string
  sourceType: 'product_view_no_order' | 'cart_abandoned'
  productId: string
}): Promise<void> {
  const product = await row(
    'SELECT id, category_id, order_type, virtual_price FROM products WHERE id = ? AND status = "active"',
    [params.productId]
  )
  if (!product) return

  const dedupeKey = `${params.userId}:${params.sourceType}:${params.productId}:${todayKey()}`
  await exec(
    `INSERT IGNORE INTO savings_opportunity_records (
      id, user_id, session_id, source_type, product_id, category_id, order_type, virtual_amount,
      dedupe_key, status, occurred_at, counted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'counted', NOW(), NOW())`,
    [
      `save_${nanoid(12)}`,
      params.userId,
      params.sessionId,
      params.sourceType,
      product.id,
      product.category_id,
      product.order_type,
      Number(product.virtual_price),
      dedupeKey
    ]
  )
}

async function trackCouponClaim(userId: string, templateId: string): Promise<void> {
  await exec(
    `INSERT INTO behavior_events (
      id, event_name, user_id, anonymous_id, session_id, platform, page_path, occurred_at,
      app_version, network_type, experiment_id, properties
    ) VALUES (?, 'coupon_claim', ?, NULL, ?, 'h5', '/pages/coupons/index', NOW(), '0.1.0', NULL, NULL, ?)`,
    [`evt_${nanoid(14)}`, userId, `coupon_${todayKey()}`, JSON.stringify({ templateId })]
  )
}

async function markOpportunitiesConverted(userId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return
  const placeholders = productIds.map(() => '?').join(',')
  await exec(
    `UPDATE savings_opportunity_records
     SET status = 'converted'
     WHERE user_id = ? AND status = 'counted' AND product_id IN (${placeholders})`,
    [userId, ...productIds]
  )
}

async function advanceOrder(orderId: string, triggerType: 'system_job' | 'admin_manual' = 'system_job'): Promise<void> {
  const order = await row('SELECT id, order_type, status FROM orders WHERE id = ?', [orderId])
  if (!order || ['completed', 'cancelled'].includes(order.status)) return

  const flow = statusFlowForOrderType(order.order_type as OrderType)
  const currentIndex = flow.indexOf(order.status as OrderStatus)
  const nextStatus = flow[currentIndex + 1]
  if (!nextStatus) return

  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE orders SET status = ?, completed_at = IF(? = 'completed', NOW(), completed_at) WHERE id = ?`,
      [nextStatus, nextStatus, orderId]
    )
    await connection.execute(
      `INSERT INTO order_status_events (id, order_id, from_status, to_status, title, description, trigger_type, job_id, occurred_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        `ose_${nanoid(12)}`,
        orderId,
        order.status,
        nextStatus,
        ORDER_STATUS_LABELS[nextStatus],
        statusDescription(nextStatus, order.order_type as OrderType),
        triggerType,
        triggerType === 'system_job' ? `job_${orderId}_${nextStatus}` : null,
        JSON.stringify({ simulated: true })
      ]
    )
  })

  if (nextStatus !== 'completed' && triggerType === 'system_job') {
    scheduleOrder(orderId, nextStatusDelay(order.order_type as OrderType, nextStatus))
  }
}

function scheduleOrder(orderId: string, delay = 9000): void {
  const existing = scheduledOrders.get(orderId) ?? []
  for (const timer of existing) clearTimeout(timer)
  const timer = setTimeout(() => {
    advanceOrder(orderId).catch((error) => app.log.error(error, `Failed to advance order ${orderId}`))
  }, delay)
  scheduledOrders.set(orderId, [timer])
}

async function resumePendingOrders(): Promise<void> {
  const pending = await rows(
    `SELECT id, order_type, status FROM orders WHERE status NOT IN ('created', 'completed', 'cancelled') ORDER BY created_at DESC LIMIT 100`
  )
  for (const item of pending) scheduleOrder(item.id, nextStatusDelay(item.order_type as OrderType, item.status as OrderStatus))
}

const registerSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(80).optional()
})

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

const wechatSchema = z.object({
  code: z.string().optional(),
  nickname: z.string().optional(),
  avatarUrl: z.string().optional(),
  platform: z.enum(['wechat_mp', 'h5']).default('wechat_mp')
})

type WechatCode2SessionResponse = {
  openid?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

async function resolveWechatOpenId(code: string): Promise<string> {
  if (!config.wechatAppId || !config.wechatAppSecret) {
    throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET are not configured')
  }

  const query = new URLSearchParams({
    appid: config.wechatAppId,
    secret: config.wechatAppSecret,
    js_code: code,
    grant_type: 'authorization_code'
  })
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`)
  if (!response.ok) {
    throw new Error(`WeChat code2Session HTTP ${response.status}`)
  }

  const result = await response.json() as WechatCode2SessionResponse
  if (!result.openid) {
    throw new Error(`WeChat code2Session ${result.errcode ?? 'unknown'}: ${result.errmsg ?? 'missing openid'}`)
  }
  return result.openid
}

app.get('/health', async () => ({ ok: true, name: '假装购 FakeMart API' }))

app.get('/', async () => ({
  ok: true,
  name: '假装购 FakeMart API',
  health: '/health'
}))

app.post('/auth/register', async (request, reply) => {
  const body = registerSchema.parse(request.body)
  const existing = await row('SELECT id FROM auth_accounts WHERE provider = "username_password" AND provider_user_id = ?', [
    body.username
  ])
  if (existing) return reply.code(409).send({ message: '用户名已存在' })

  const userId = `user_${nanoid(12)}`
  const passwordHash = await bcrypt.hash(body.password, 10)
  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO users (id, username, display_name, default_address_label, status, created_at, last_active_at)
       VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
      [userId, body.username, body.displayName ?? body.username, DEFAULT_ADDRESS_LABEL]
    )
    await connection.execute(
      `INSERT INTO auth_accounts (id, user_id, provider, provider_user_id, password_hash, bound_at, last_login_at, status)
       VALUES (?, ?, 'username_password', ?, ?, NOW(), NOW(), 'active')`,
      [`auth_${nanoid(12)}`, userId, body.username, passwordHash]
    )
  })

  return {
    token: await signUser(userId, body.username),
    user: publicUser({
      id: userId,
      username: body.username,
      display_name: body.displayName ?? body.username,
      avatar_url: null,
      default_address_label: DEFAULT_ADDRESS_LABEL
    })
  }
})

app.post('/auth/login', async (request, reply) => {
  const body = loginSchema.parse(request.body)
  const auth = await row(
    `SELECT aa.id auth_id, aa.user_id, aa.password_hash, u.id, u.username, u.display_name, u.avatar_url, u.default_address_label, u.created_at, u.last_active_at
     FROM auth_accounts aa JOIN users u ON u.id = aa.user_id
     WHERE aa.provider = 'username_password' AND aa.provider_user_id = ? AND aa.status = 'active'`,
    [body.username]
  )
  if (!auth || !auth.password_hash || !(await bcrypt.compare(body.password, auth.password_hash))) {
    return reply.code(401).send({ message: '用户名或密码错误' })
  }
  await exec('UPDATE auth_accounts SET last_login_at = NOW() WHERE id = ?', [auth.auth_id])
  await exec('UPDATE users SET last_active_at = NOW() WHERE id = ?', [auth.user_id])
  return {
    token: await signUser(auth.user_id, auth.username),
    user: publicUser({ ...auth, last_active_at: new Date() })
  }
})

app.post('/auth/bind', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const body = registerSchema.parse(request.body)
  const user = await row('SELECT id, username, display_name, avatar_url, default_address_label, created_at, last_active_at FROM users WHERE id = ?', [userId])
  if (!user) return reply.code(404).send({ message: '用户不存在' })
  if (user.username) return reply.code(409).send({ message: '当前账号已绑定用户名' })

  const existing = await row('SELECT id FROM auth_accounts WHERE provider = "username_password" AND provider_user_id = ?', [
    body.username
  ])
  if (existing) return reply.code(409).send({ message: '用户名已存在' })

  const passwordHash = await bcrypt.hash(body.password, 10)
  await withTransaction(async (connection) => {
    await connection.execute('UPDATE users SET username = ?, display_name = ?, last_active_at = NOW() WHERE id = ?', [
      body.username,
      body.displayName ?? body.username,
      userId
    ])
    await connection.execute(
      `INSERT INTO auth_accounts (id, user_id, provider, provider_user_id, password_hash, bound_at, last_login_at, status)
       VALUES (?, ?, 'username_password', ?, ?, NOW(), NOW(), 'active')`,
      [`auth_${nanoid(12)}`, userId, body.username, passwordHash]
    )
  })

  return {
    token: await signUser(userId, body.username),
    user: publicUser({
      ...user,
      username: body.username,
      display_name: body.displayName ?? body.username,
      last_active_at: new Date()
    })
  }
})

app.post('/auth/wechat', async (request, reply) => {
  const body = wechatSchema.parse(request.body)
  let openid: string
  if (body.platform === 'h5') {
    openid = body.code ? `h5_${body.code}` : `h5_${nanoid(12)}`
  } else {
    if (!body.code) return reply.code(400).send({ message: '微信登录 code 缺失' })
    try {
      openid = await resolveWechatOpenId(body.code)
    } catch (error) {
      app.log.error({ error: error instanceof Error ? error.message : String(error) }, 'WeChat code2Session failed')
      if (config.wechatAuthRequired) {
        return reply.code(401).send({ message: '微信登录失败，请稍后重试' })
      }
      openid = `mock_${body.code}`
    }
  }
  const existing = await row(
    `SELECT aa.id auth_id, aa.user_id, u.id, u.username, u.display_name, u.avatar_url, u.default_address_label, u.created_at, u.last_active_at
     FROM auth_accounts aa JOIN users u ON u.id = aa.user_id
     WHERE aa.provider = 'wechat_mp' AND aa.provider_user_id = ?`,
    [openid]
  )
  if (existing) {
    await exec('UPDATE auth_accounts SET last_login_at = NOW() WHERE id = ?', [existing.auth_id])
    await exec('UPDATE users SET last_active_at = NOW() WHERE id = ?', [existing.user_id])
    return {
      token: await signUser(existing.user_id, existing.username),
      user: publicUser({ ...existing, last_active_at: new Date() })
    }
  }

  const userId = `user_${nanoid(12)}`
  const displayName = body.nickname ?? '微信体验用户'
  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO users (id, username, display_name, avatar_url, default_address_label, status, created_at, last_active_at)
       VALUES (?, NULL, ?, ?, ?, 'active', NOW(), NOW())`,
      [userId, displayName, body.avatarUrl ?? null, DEFAULT_ADDRESS_LABEL]
    )
    await connection.execute(
      `INSERT INTO auth_accounts (id, user_id, provider, provider_user_id, bound_at, last_login_at, status)
       VALUES (?, ?, 'wechat_mp', ?, NOW(), NOW(), 'active')`,
      [`auth_${nanoid(12)}`, userId, openid]
    )
  })

  return {
    token: await signUser(userId),
    user: publicUser({
      id: userId,
      username: null,
      display_name: displayName,
      avatar_url: body.avatarUrl ?? null,
      default_address_label: DEFAULT_ADDRESS_LABEL
    })
  }
})

app.get('/auth/me', async (request) => {
  const userId = await userIdFromRequest(request)
  const user = await row('SELECT id, username, display_name, avatar_url, default_address_label, created_at, last_active_at FROM users WHERE id = ?', [userId])
  if (!user) {
    return {
      user: publicUser({
        id: userId,
        username: null,
        display_name: '假装购用户',
        avatar_url: null,
        default_address_label: DEFAULT_ADDRESS_LABEL
      })
    }
  }
  return {
    user: publicUser(user)
  }
})

app.patch('/auth/me', async (request) => {
  const userId = await userIdFromRequest(request)
  const body = z
    .object({
      defaultAddressLabel: z.string().trim().min(1, '请输入收货地址').max(1000, '收货地址太长了')
    })
    .parse(request.body)

  await exec('UPDATE users SET default_address_label = ?, last_active_at = NOW() WHERE id = ?', [body.defaultAddressLabel, userId])
  const user = await row('SELECT id, username, display_name, avatar_url, default_address_label, created_at, last_active_at FROM users WHERE id = ?', [userId])
  if (!user) {
    return {
      user: publicUser({
        id: userId,
        username: null,
        display_name: '假装购用户',
        avatar_url: null,
        default_address_label: body.defaultAddressLabel
      })
    }
  }
  return { user: publicUser(user) }
})

app.get('/catalog/categories', async () => {
  const result = await rows('SELECT * FROM categories ORDER BY sort_order ASC')
  return { categories: result.map(publicCategory) }
})

app.get('/catalog/products', async (request) => {
  const query = z
    .object({
      orderType: z.enum(['shopping', 'food_delivery']).optional(),
      categoryId: z.string().optional(),
      merchantId: z.string().optional(),
      q: z.string().optional(),
      sort: z.enum(['recommend', 'price_asc', 'price_desc', 'newest']).optional(),
      limit: z.coerce.number().min(1).max(100).optional()
    })
    .parse(request.query)

  const conditions = ['p.status = "active"']
  const params: unknown[] = []
  if (query.orderType) {
    conditions.push('p.order_type = ?')
    params.push(query.orderType)
  }
  if (query.categoryId) {
    conditions.push('p.category_id = ?')
    params.push(query.categoryId)
  }
  if (query.merchantId) {
    conditions.push('p.merchant_id = ?')
    params.push(query.merchantId)
  }
  if (query.q) {
    conditions.push('(p.title LIKE ? OR p.subtitle LIKE ? OR p.description LIKE ? OR JSON_SEARCH(p.tags, "one", ?, NULL, "$[*]") IS NOT NULL)')
    params.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`, `%${query.q}%`)
  }
  const orderBy =
    query.sort === 'price_asc'
      ? 'p.virtual_price ASC'
      : query.sort === 'price_desc'
        ? 'p.virtual_price DESC'
        : query.sort === 'newest'
        ? 'p.created_at DESC'
          : 'p.recommendation_weight DESC, p.virtual_sales_count DESC'
  const limit = Math.min(Math.max(Number(query.limit ?? 40), 1), 100)

  const result = await rows(
    `SELECT p.* FROM products p WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} LIMIT ${limit}`,
    params
  )
  return { products: result.map(publicProduct) }
})

app.get('/catalog/products/:id', async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const product = await row('SELECT * FROM products WHERE id = ?', [params.id])
  if (!product) return reply.code(404).send({ message: '商品不存在' })
  const merchant = await row('SELECT * FROM merchants WHERE id = ?', [product.merchant_id])
  const category = await row('SELECT * FROM categories WHERE id = ?', [product.category_id])
  return { product: publicProduct(product), merchant: merchant ? publicMerchant(merchant) : null, category: category ? publicCategory(category) : null }
})

app.get('/catalog/merchants/:id', async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const merchant = await row('SELECT * FROM merchants WHERE id = ?', [params.id])
  if (!merchant) return reply.code(404).send({ message: '店铺不存在' })
  const products = await rows(
    `SELECT * FROM products
     WHERE merchant_id = ? AND status = "active"
     ORDER BY recommendation_weight DESC, virtual_sales_count DESC, created_at DESC
     LIMIT 80`,
    [params.id]
  )
  return { merchant: publicMerchant(merchant), products: products.map(publicProduct) }
})

app.get('/reviews/products/:id', async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const query = z.object({ limit: z.coerce.number().min(1).max(50).optional() }).parse(request.query)
  const product = await row('SELECT id FROM products WHERE id = ?', [params.id])
  if (!product) return reply.code(404).send({ message: '商品不存在' })
  const [summary, reviews] = await Promise.all([
    reviewSummary({ productId: params.id }),
    reviewFeed({ productId: params.id }, query.limit ?? 20)
  ])
  return { summary, reviews: reviews.map(publicReviewFeedItem) }
})

app.get('/reviews/merchants/:id', async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const query = z.object({ limit: z.coerce.number().min(1).max(50).optional() }).parse(request.query)
  const merchant = await row('SELECT id FROM merchants WHERE id = ?', [params.id])
  if (!merchant) return reply.code(404).send({ message: '店铺不存在' })
  const [summary, reviews] = await Promise.all([
    reviewSummary({ merchantId: params.id }),
    reviewFeed({ merchantId: params.id }, query.limit ?? 20)
  ])
  return { summary, reviews: reviews.map(publicReviewFeedItem) }
})

app.get('/catalog/merchant-sections', async (request) => {
  const query = z
    .object({
      type: z.enum(['shopping', 'food_delivery']).optional(),
      limit: z.coerce.number().min(1).max(30).optional(),
      productLimit: z.coerce.number().min(1).max(6).optional()
    })
    .parse(request.query)

  const conditions: string[] = []
  const params: unknown[] = []
  if (query.type) {
    conditions.push('m.type = ?')
    params.push(query.type)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.min(Math.max(Number(query.limit ?? 12), 1), 30)
  const productLimit = Math.min(Math.max(Number(query.productLimit ?? 3), 1), 6)

  const merchants = await rows(
    `SELECT m.*, s.total_sales, s.product_count
     FROM merchants m
     JOIN (
       SELECT merchant_id, SUM(virtual_sales_count) AS total_sales, COUNT(*) AS product_count
       FROM products
       WHERE status = "active"
       GROUP BY merchant_id
     ) s ON s.merchant_id = m.id
     ${where}
     ORDER BY m.type ASC, m.rating DESC, s.total_sales DESC, m.delivery_minutes ASC
     LIMIT ${limit}`,
    params
  )

  const sections = await Promise.all(
    merchants.map(async (merchant) => {
      const products = await rows(
        `SELECT *
         FROM products
         WHERE merchant_id = ? AND status = "active"
         ORDER BY recommendation_weight DESC, virtual_sales_count DESC, created_at DESC
         LIMIT ${productLimit}`,
        [merchant.id]
      )
      return publicMerchantSection(merchant, products)
    })
  )

  return { sections }
})

app.get('/food/merchants', async () => {
  const result = await rows(`SELECT * FROM merchants WHERE type = 'food_delivery' ORDER BY rating DESC, delivery_minutes ASC`)
  return { merchants: result.map(publicMerchant) }
})

app.get('/food/merchants/:id', async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const merchant = await row('SELECT * FROM merchants WHERE id = ? AND type = "food_delivery"', [params.id])
  if (!merchant) return reply.code(404).send({ message: '餐厅不存在' })
  const products = await rows('SELECT * FROM products WHERE merchant_id = ? AND status = "active" ORDER BY recommendation_weight DESC', [
    params.id
  ])
  return { merchant: publicMerchant(merchant), products: products.map(publicProduct) }
})

app.get('/cart', async (request) => {
  const userId = await userIdFromRequest(request)
  const cartId = await ensureCart(userId)
  const result = await rows(
    `SELECT ci.id cart_item_id, ci.quantity cart_quantity, p.*
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ?
     ORDER BY ci.created_at DESC`,
    [cartId]
  )
  return {
    items: result.map((item) => ({
      id: item.cart_item_id,
      productId: item.id,
      quantity: Number(item.cart_quantity),
      product: publicProduct(item)
    }))
  }
})

app.post('/cart/items', async (request) => {
  const userId = await userIdFromRequest(request)
  const body = z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99).default(1), sessionId: z.string().optional() }).parse(request.body)
  const cartId = await ensureCart(userId)
  const itemId = `cart_item_${nanoid(12)}`
  await exec(
    `INSERT INTO cart_items (id, cart_id, product_id, quantity)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()`,
    [itemId, cartId, body.productId, body.quantity]
  )
  await createSavingsOpportunity({
    userId,
    sessionId: body.sessionId ?? `session_${todayKey()}`,
    sourceType: 'cart_abandoned',
    productId: body.productId
  })
  return { ok: true }
})

app.patch('/cart/items/:id', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const body = z.object({ quantity: z.number().int().min(1).max(99) }).parse(request.body)
  const cartId = await ensureCart(userId)
  await exec('UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ? AND cart_id = ?', [body.quantity, params.id, cartId])
  return reply.code(204).send()
})

app.delete('/cart/items/:id', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const cartId = await ensureCart(userId)
  await exec('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [params.id, cartId])
  return reply.code(204).send()
})

app.get('/profile/trace-summary', async (request) => {
  const userId = await userIdFromRequest(request)
  const cartId = await ensureCart(userId)
  const [favorite, footprint, followed, browse] = await Promise.all([
    row('SELECT COALESCE(SUM(quantity), 0) count FROM cart_items WHERE cart_id = ?', [cartId]),
    row(
      `SELECT COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(properties, '$.productId'))) count
       FROM behavior_events
       WHERE user_id = ? AND event_name = 'product_view' AND JSON_EXTRACT(properties, '$.productId') IS NOT NULL`,
      [userId]
    ),
    row('SELECT COUNT(*) count FROM merchant_follows WHERE user_id = ?', [userId]),
    row('SELECT COUNT(*) count FROM behavior_events WHERE user_id = ?', [userId])
  ])
  return {
    summary: {
      favoriteCount: Number(favorite?.count ?? 0),
      footprintCount: Number(footprint?.count ?? 0),
      followedMerchantCount: Number(followed?.count ?? 0),
      browseRecordCount: Number(browse?.count ?? 0)
    }
  }
})

app.get('/footprints', async (request) => {
  const userId = await userIdFromRequest(request)
  const query = z.object({ limit: z.coerce.number().min(1).max(100).optional() }).parse(request.query)
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100)
  const result = await rows(
    `SELECT p.*, fp.last_viewed_at, fp.view_count
     FROM (
       SELECT
         JSON_UNQUOTE(JSON_EXTRACT(properties, '$.productId')) product_id,
         MAX(occurred_at) last_viewed_at,
         COUNT(*) view_count
       FROM behavior_events
       WHERE user_id = ? AND event_name = 'product_view' AND JSON_EXTRACT(properties, '$.productId') IS NOT NULL
       GROUP BY product_id
     ) fp
     JOIN products p ON p.id = fp.product_id
     ORDER BY fp.last_viewed_at DESC
     LIMIT ${limit}`,
    [userId]
  )
  return {
    footprints: result.map((item) => ({
      product: publicProduct(item),
      lastViewedAt: iso(item.last_viewed_at),
      viewCount: Number(item.view_count)
    }))
  }
})

app.get('/merchant-follows', async (request) => {
  const userId = await userIdFromRequest(request)
  const result = await rows(
    `SELECT mf.id follow_id, mf.followed_at, m.*
     FROM merchant_follows mf
     JOIN merchants m ON m.id = mf.merchant_id
     WHERE mf.user_id = ?
     ORDER BY mf.followed_at DESC`,
    [userId]
  )
  return { follows: result.map(publicMerchantFollow) }
})

app.get('/merchant-follows/:id/status', async (request) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const follow = await row('SELECT id, followed_at FROM merchant_follows WHERE user_id = ? AND merchant_id = ?', [userId, params.id])
  return { followed: Boolean(follow), followedAt: follow?.followed_at ? iso(follow.followed_at) : null }
})

app.post('/merchant-follows/:id', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const merchant = await row('SELECT id FROM merchants WHERE id = ?', [params.id])
  if (!merchant) return reply.code(404).send({ message: '店铺不存在' })
  await exec(
    `INSERT INTO merchant_follows (id, user_id, merchant_id, followed_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE followed_at = VALUES(followed_at)`,
    [`mf_${nanoid(12)}`, userId, params.id]
  )
  return { ok: true }
})

app.delete('/merchant-follows/:id', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  await exec('DELETE FROM merchant_follows WHERE user_id = ? AND merchant_id = ?', [userId, params.id])
  return reply.code(204).send()
})

app.get('/browse-records', async (request) => {
  const userId = await userIdFromRequest(request)
  const query = z.object({ limit: z.coerce.number().min(1).max(100).optional() }).parse(request.query)
  const limit = Math.min(Math.max(Number(query.limit ?? 80), 1), 100)
  const events = await rows(
    `SELECT id, event_name, page_path, occurred_at, properties
     FROM behavior_events
     WHERE user_id = ?
     ORDER BY occurred_at DESC
     LIMIT ${limit}`,
    [userId]
  )
  const productIds = new Set<string>()
  const merchantIds = new Set<string>()
  for (const event of events) {
    const properties = json<Record<string, unknown>>(event.properties, {})
    if (typeof properties.productId === 'string') productIds.add(properties.productId)
    if (typeof properties.merchantId === 'string') merchantIds.add(properties.merchantId)
  }
  const [products, merchants] = await Promise.all([
    productIds.size
      ? rows(`SELECT id, title, image_url FROM products WHERE id IN (${[...productIds].map(() => '?').join(',')})`, [...productIds])
      : Promise.resolve([]),
    merchantIds.size
      ? rows(`SELECT id, name, logo_url FROM merchants WHERE id IN (${[...merchantIds].map(() => '?').join(',')})`, [...merchantIds])
      : Promise.resolve([])
  ])
  const productMap = new Map(products.map((product) => [product.id, product]))
  const merchantMap = new Map(merchants.map((merchant) => [merchant.id, merchant]))
  return {
    records: events.map((event) => {
      const properties = json<Record<string, unknown>>(event.properties, {})
      const product = typeof properties.productId === 'string' ? productMap.get(properties.productId) : null
      const merchant = typeof properties.merchantId === 'string' ? merchantMap.get(properties.merchantId) : null
      return {
        id: event.id,
        eventName: event.event_name,
        pagePath: event.page_path,
        occurredAt: iso(event.occurred_at),
        properties,
        targetTitle: product?.title ?? merchant?.name ?? null,
        targetImageUrl: product?.image_url ?? merchant?.logo_url ?? null
      }
    })
  }
})

app.post('/events', async (request) => {
  const payload = z
    .object({
      events: z
        .array(
          z.object({
            eventName: z.string(),
            anonymousId: z.string().optional(),
            sessionId: z.string(),
            platform: z.string().default('h5'),
            pagePath: z.string().optional(),
            referrer: z.string().optional(),
            occurredAt: z.string().optional(),
            appVersion: z.string().optional(),
            networkType: z.string().optional(),
            experimentId: z.string().optional(),
            properties: z.record(z.string(), z.unknown()).default({})
          })
        )
        .min(1)
    })
    .parse(request.body)
  const userId = await userIdFromRequest(request)

  for (const event of payload.events) {
    await exec(
      `INSERT INTO behavior_events (
        id, event_name, user_id, anonymous_id, session_id, platform, page_path, referrer, occurred_at,
        app_version, network_type, experiment_id, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `evt_${nanoid(14)}`,
        event.eventName,
        userId,
        event.anonymousId ?? null,
        event.sessionId,
        event.platform,
        event.pagePath ?? null,
        event.referrer ?? null,
        event.occurredAt ? new Date(event.occurredAt) : new Date(),
        event.appVersion ?? null,
        event.networkType ?? null,
        event.experimentId ?? null,
        JSON.stringify(event.properties)
      ]
    )

    if (event.eventName === 'product_view' && typeof event.properties.productId === 'string') {
      await createSavingsOpportunity({
        userId,
        sessionId: event.sessionId,
        sourceType: 'product_view_no_order',
        productId: event.properties.productId
      })
    }
  }
  return { accepted: payload.events.length }
})

app.get('/coupons/center', async (request) => {
  const userId = await userIdFromRequest(request)
  await updateExpiredCoupons(userId)
  const templates = await rows(
    `SELECT ct.*, COALESCE(uc.user_claimed_count, 0) user_claimed_count
     FROM coupon_templates ct
     LEFT JOIN (
       SELECT template_id, COUNT(*) user_claimed_count
       FROM user_coupons
       WHERE user_id = ?
       GROUP BY template_id
     ) uc ON uc.template_id = ct.id
     WHERE ct.status = 'active'
     ORDER BY ct.sort_order ASC, ct.discount_amount DESC`,
    [userId]
  )
  const [available, used, expired] = await Promise.all([
    row(`SELECT COUNT(*) count FROM user_coupons WHERE user_id = ? AND status = 'available' AND expires_at > NOW()`, [userId]),
    row(`SELECT COUNT(*) count FROM user_coupons WHERE user_id = ? AND status = 'used'`, [userId]),
    row(`SELECT COUNT(*) count FROM user_coupons WHERE user_id = ? AND (status = 'expired' OR expires_at <= NOW())`, [userId])
  ])
  return {
    templates: templates.map(publicCouponTemplate),
    stats: {
      available: Number(available?.count ?? 0),
      used: Number(used?.count ?? 0),
      expired: Number(expired?.count ?? 0)
    }
  }
})

app.get('/coupons', async (request) => {
  const userId = await userIdFromRequest(request)
  const query = z
    .object({
      status: z.enum(['available', 'used', 'expired', 'all']).default('all'),
      orderType: z.enum(['shopping', 'food_delivery']).optional(),
      amount: z.coerce.number().int().min(0).optional()
    })
    .parse(request.query)
  await updateExpiredCoupons(userId)
  const conditions = ['uc.user_id = ?']
  const params: unknown[] = [userId]
  if (query.status === 'available') {
    conditions.push(`uc.status = 'available' AND uc.expires_at > NOW()`)
  } else if (query.status === 'used') {
    conditions.push(`uc.status = 'used'`)
  } else if (query.status === 'expired') {
    conditions.push(`(uc.status = 'expired' OR uc.expires_at <= NOW())`)
  }
  const result = await rows(
    `SELECT uc.*, ct.title, ct.description, ct.scope, ct.threshold_amount, ct.discount_amount, ct.status template_status
     FROM user_coupons uc
     JOIN coupon_templates ct ON ct.id = uc.template_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY FIELD(uc.status, 'available', 'used', 'expired'), uc.expires_at ASC, ct.discount_amount DESC`,
    params
  )
  return {
    coupons: result.map((coupon) => publicUserCoupon(coupon, query.orderType, query.amount))
  }
})

app.get('/coupons/available', async (request) => {
  const userId = await userIdFromRequest(request)
  const query = z
    .object({
      orderType: z.enum(['shopping', 'food_delivery']),
      amount: z.coerce.number().int().min(0)
    })
    .parse(request.query)
  const coupons = await findEligibleCoupons(userId, query.orderType, query.amount)
  return { coupons: coupons.map((coupon) => publicUserCoupon(coupon, query.orderType, query.amount)) }
})

app.post('/coupons/:id/claim', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const template = await row('SELECT * FROM coupon_templates WHERE id = ? AND status = "active"', [params.id])
  if (!template) return reply.code(404).send({ message: '优惠券不存在' })
  if (new Date(template.ends_at).getTime() <= Date.now()) return reply.code(409).send({ message: '优惠券已结束' })
  if (template.total_quantity != null && Number(template.claimed_count) >= Number(template.total_quantity)) {
    return reply.code(409).send({ message: '优惠券已领完' })
  }
  const claimed = await row('SELECT COUNT(*) count FROM user_coupons WHERE user_id = ? AND template_id = ?', [userId, params.id])
  if (Number(claimed?.count ?? 0) >= Number(template.per_user_limit ?? 1)) {
    return reply.code(409).send({ message: '已经领取过了' })
  }
  const couponId = `uc_${nanoid(12)}`
  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO user_coupons (id, user_id, template_id, status, claimed_at, expires_at)
       VALUES (?, ?, ?, 'available', NOW(), ?)`,
      [couponId, userId, params.id, template.ends_at]
    )
    await connection.execute('UPDATE coupon_templates SET claimed_count = claimed_count + 1 WHERE id = ?', [params.id])
  })
  trackCouponClaim(userId, params.id).catch((error) => {
    app.log.warn({ err: error, userId, templateId: params.id }, 'coupon claim event tracking failed')
  })
  const coupon = await row(
    `SELECT uc.*, ct.title, ct.description, ct.scope, ct.threshold_amount, ct.discount_amount, ct.status template_status
     FROM user_coupons uc JOIN coupon_templates ct ON ct.id = uc.template_id WHERE uc.id = ?`,
    [couponId]
  )
  if (!coupon) return reply.code(500).send({ message: '领取后读取失败' })
  return { coupon: publicUserCoupon(coupon) }
})

app.post('/orders', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const body = z
    .object({
      orderType: z.enum(['shopping', 'food_delivery']).optional(),
      items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99) })).optional(),
      virtualPaymentMethod: z.string().default('余额支付'),
      virtualAddressLabel: z.string().trim().min(1).max(1000).optional(),
      couponId: z.string().nullable().optional(),
      autoCoupon: z.boolean().default(true),
      clearCart: z.boolean().default(false)
    })
    .parse(request.body)
  const user = await row('SELECT default_address_label FROM users WHERE id = ?', [userId])
  const addressLabel = normalizeAddressLabel(body.virtualAddressLabel ?? user?.default_address_label)

  let requestedItems = body.items ?? []
  const cartId = await ensureCart(userId)
  if (requestedItems.length === 0) {
    const cartItems = await rows(
      `SELECT ci.product_id, ci.quantity FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?`,
      [cartId]
    )
    requestedItems = cartItems.map((item) => ({ productId: item.product_id, quantity: Number(item.quantity) }))
  }

  if (requestedItems.length === 0) return reply.code(400).send({ message: '没有可提交的商品' })

  const productIds = [...new Set(requestedItems.map((item) => item.productId))]
  const placeholders = productIds.map(() => '?').join(',')
  const productRows = await rows(`SELECT * FROM products WHERE id IN (${placeholders}) AND status = 'active'`, productIds)
  const productMap = new Map(productRows.map((product) => [product.id, product]))
  const orderType = (body.orderType ?? productRows[0]?.order_type ?? 'shopping') as OrderType

  const normalized = requestedItems
    .map((item) => {
      const product = productMap.get(item.productId)
      if (!product) return null
      return { product, quantity: item.quantity }
    })
    .filter(Boolean) as Array<{ product: AnyRow; quantity: number }>

  if (normalized.length === 0) return reply.code(400).send({ message: '商品不可用' })

  const subtotal = normalized.reduce((sum, item) => sum + Number(item.product.virtual_price) * item.quantity, 0)
  const itemCount = normalized.reduce((sum, item) => sum + item.quantity, 0)
  let coupon: AnyRow | null = null
  try {
    coupon = await chooseCouponForOrder(userId, body.couponId ?? undefined, body.autoCoupon, orderType, subtotal)
  } catch (error) {
    return reply.code(400).send({ message: error instanceof Error ? error.message : '优惠券不可用' })
  }
  const couponDiscount = coupon ? Math.min(Number(coupon.discount_amount), subtotal) : 0
  const payableTotal = Math.max(0, subtotal - couponDiscount)
  const orderId = `ord_${nanoid(12)}`
  const no = orderNo()

  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO orders (
        id, order_no, user_id, order_type, status, original_amount, total_virtual_amount, saved_amount,
        coupon_id, coupon_template_id, coupon_name, coupon_discount_amount, item_count,
        virtual_payment_method, virtual_address_label, created_at
      ) VALUES (?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        orderId,
        no,
        userId,
        orderType,
        subtotal,
        payableTotal,
        subtotal,
        coupon?.id ?? null,
        coupon?.template_id ?? null,
        coupon?.title ?? null,
        couponDiscount,
        itemCount,
        body.virtualPaymentMethod,
        addressLabel
      ]
    )
    for (const item of normalized) {
      await connection.execute(
        `INSERT INTO order_items (id, order_id, product_id, title, image_url, unit_price, quantity, subtotal_amount, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `oi_${nanoid(12)}`,
          orderId,
          item.product.id,
          item.product.title,
          item.product.image_url,
          Number(item.product.virtual_price),
          item.quantity,
          Number(item.product.virtual_price) * item.quantity,
          item.product.category_id
        ]
      )
    }
    if (coupon) {
      await connection.execute(`UPDATE user_coupons SET status = 'used', used_at = NOW(), order_id = ? WHERE id = ? AND user_id = ?`, [
        orderId,
        coupon.id,
        userId
      ])
    }
    await connection.execute(
      `INSERT INTO order_status_events (id, order_id, from_status, to_status, title, description, trigger_type, occurred_at, metadata)
       VALUES (?, ?, NULL, 'created', ?, ?, 'user_action', NOW(), ?)`,
      [`ose_${nanoid(12)}`, orderId, ORDER_STATUS_LABELS.created, statusDescription('created', orderType), JSON.stringify({ simulated: true })]
    )
    if (body.clearCart) {
      await connection.execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId])
    }
  })

  await markOpportunitiesConverted(userId, productIds)
  const created = await row('SELECT * FROM orders WHERE id = ?', [orderId])
  if (!created) return reply.code(500).send({ message: '订单创建后读取失败' })
  return { order: await publicOrder(created) }
})

app.post('/orders/:id/pay', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const body = z
    .object({
      paymentMethod: z.string().min(1).max(60).default('余额支付')
    })
    .parse(request.body)

  const order = await row('SELECT * FROM orders WHERE id = ? AND user_id = ?', [params.id, userId])
  if (!order) return reply.code(404).send({ message: '订单不存在' })
  if (order.status === 'virtual_paid') return { order: await publicOrder(order) }
  if (order.status !== 'created') return reply.code(409).send({ message: '当前订单状态不可支付' })

  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE orders SET status = 'virtual_paid', virtual_payment_method = ? WHERE id = ?`,
      [body.paymentMethod, params.id]
    )
    await connection.execute(
      `INSERT INTO order_status_events (id, order_id, from_status, to_status, title, description, trigger_type, occurred_at, metadata)
       VALUES (?, ?, 'created', 'virtual_paid', ?, ?, 'user_action', NOW(), ?)`,
      [
        `ose_${nanoid(12)}`,
        params.id,
        ORDER_STATUS_LABELS.virtual_paid,
        statusDescription('virtual_paid', order.order_type as OrderType),
        JSON.stringify({ paymentMethod: body.paymentMethod })
      ]
    )
  })

  scheduleOrder(params.id, nextStatusDelay(order.order_type as OrderType, 'virtual_paid'))
  const paid = await row('SELECT * FROM orders WHERE id = ?', [params.id])
  if (!paid) return reply.code(500).send({ message: '订单支付后读取失败' })
  return { order: await publicOrder(paid) }
})

app.get('/orders', async (request) => {
  const userId = await userIdFromRequest(request)
  const query = z.object({ orderType: z.enum(['shopping', 'food_delivery']).optional(), status: z.string().optional() }).parse(request.query)
  const conditions = ['user_id = ?']
  const params: unknown[] = [userId]
  if (query.orderType) {
    conditions.push('order_type = ?')
    params.push(query.orderType)
  }
  if (query.status) {
    conditions.push('status = ?')
    params.push(query.status)
  }
  const result = await rows(`SELECT * FROM orders WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, params)
  return { orders: await Promise.all(result.map(publicOrder)) }
})

app.get('/orders/:id', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const order = await row('SELECT * FROM orders WHERE id = ? AND user_id = ?', [params.id, userId])
  if (!order) return reply.code(404).send({ message: '订单不存在' })
  return { order: await publicOrder(order) }
})

app.post('/orders/:id/review', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const body = z
    .object({
      rating: z.coerce.number().int().min(1).max(5),
      content: z.string().trim().max(500).default(''),
      tags: z.array(z.string().trim().min(1).max(24)).max(8).default([])
    })
    .parse(request.body)

  const order = await row('SELECT * FROM orders WHERE id = ? AND user_id = ?', [params.id, userId])
  if (!order) return reply.code(404).send({ message: '订单不存在' })
  if (order.status !== 'completed') return reply.code(409).send({ message: '订单完成后才可以评价' })

  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO order_reviews (id, order_id, user_id, rating, content, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), content = VALUES(content), tags = VALUES(tags), updated_at = NOW()`,
      [`rev_${nanoid(12)}`, params.id, userId, body.rating, body.content, JSON.stringify(body.tags)]
    )
    await connection.execute(
      `INSERT INTO order_status_events (id, order_id, from_status, to_status, title, description, trigger_type, occurred_at, metadata)
       VALUES (?, ?, 'completed', 'completed', ?, ?, 'user_action', NOW(), ?)`,
      [
        `ose_${nanoid(12)}`,
        params.id,
        body.content ? '评价已更新' : '已完成评价',
        body.content || `你给本次体验打了 ${body.rating} 星。`,
        JSON.stringify({ rating: body.rating, tags: body.tags })
      ]
    )
  })

  const updated = await row('SELECT * FROM orders WHERE id = ?', [params.id])
  if (!updated) return reply.code(500).send({ message: '评价后读取订单失败' })
  return { order: await publicOrder(updated) }
})

app.post('/orders/:id/cancel', async (request, reply) => {
  const userId = await userIdFromRequest(request)
  const params = z.object({ id: z.string() }).parse(request.params)
  const order = await row('SELECT id, status, coupon_id FROM orders WHERE id = ? AND user_id = ?', [params.id, userId])
  if (!order) return reply.code(404).send({ message: '订单不存在' })
  if (['completed', 'cancelled'].includes(order.status)) return reply.code(409).send({ message: '当前状态不可取消' })
  await withTransaction(async (connection) => {
    await connection.execute(`UPDATE orders SET status = 'cancelled', canceled_at = NOW() WHERE id = ?`, [params.id])
    if (order.coupon_id) {
      await connection.execute(`UPDATE user_coupons SET status = 'available', used_at = NULL, order_id = NULL WHERE id = ?`, [order.coupon_id])
    }
    await connection.execute(
      `INSERT INTO order_status_events (id, order_id, from_status, to_status, title, description, trigger_type, occurred_at, metadata)
       VALUES (?, ?, ?, 'cancelled', '已取消', '用户取消了本次订单。', 'user_action', NOW(), ?)`,
      [`ose_${nanoid(12)}`, params.id, order.status, JSON.stringify({ simulated: true })]
    )
  })
  return { ok: true }
})

app.get('/analytics/savings', async (request) => {
  const userId = await userIdFromRequest(request)
  const [simulated, viewOpportunity, cartOpportunity, today, week, month, orderCount] = await Promise.all([
    row(`SELECT COALESCE(SUM(saved_amount), 0) amount FROM orders WHERE user_id = ? AND status != 'cancelled'`, [userId]),
    row(
      `SELECT COALESCE(SUM(virtual_amount), 0) amount FROM savings_opportunity_records
       WHERE user_id = ? AND source_type = 'product_view_no_order' AND status = 'counted'`,
      [userId]
    ),
    row(
      `SELECT COALESCE(SUM(virtual_amount), 0) amount FROM savings_opportunity_records
       WHERE user_id = ? AND source_type = 'cart_abandoned' AND status = 'counted'`,
      [userId]
    ),
    row(
      `SELECT COALESCE(SUM(saved_amount), 0) amount FROM orders
       WHERE user_id = ? AND status != 'cancelled' AND DATE(created_at) = CURRENT_DATE`,
      [userId]
    ),
    row(
      `SELECT COALESCE(SUM(saved_amount), 0) amount FROM orders
       WHERE user_id = ? AND status != 'cancelled' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    ),
    row(
      `SELECT COALESCE(SUM(saved_amount), 0) amount FROM orders
       WHERE user_id = ? AND status != 'cancelled' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId]
    ),
    row(`SELECT COUNT(*) count FROM orders WHERE user_id = ? AND status != 'cancelled'`, [userId])
  ])

  const categories = await rows(
    `SELECT c.id category_id, c.name category_name, COALESCE(SUM(oi.subtotal_amount), 0) amount
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN categories c ON c.id = oi.category_id
     WHERE o.user_id = ? AND o.status != 'cancelled'
     GROUP BY c.id, c.name
     ORDER BY amount DESC`,
    [userId]
  )
  const trend = await rows(
    `SELECT DATE(created_at) date, COALESCE(SUM(saved_amount), 0) simulated
     FROM orders WHERE user_id = ? AND status != 'cancelled' AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
     GROUP BY DATE(created_at) ORDER BY date ASC`,
    [userId]
  )

  const simulatedAmount = Number(simulated?.amount ?? 0)
  const viewAmount = Number(viewOpportunity?.amount ?? 0)
  const cartAmount = Number(cartOpportunity?.amount ?? 0)
  return {
    overview: {
      simulatedOrderSavings: simulatedAmount,
      productViewOpportunity: viewAmount,
      cartAbandonedOpportunity: cartAmount,
      estimatedTotalSavings: simulatedAmount + viewAmount + cartAmount,
      todaySavings: Number(today?.amount ?? 0),
      weekSavings: Number(week?.amount ?? 0),
      monthSavings: Number(month?.amount ?? 0),
      orderCount: Number(orderCount?.count ?? 0),
      categoryBreakdown: categories.map((item) => ({
        categoryId: item.category_id,
        categoryName: item.category_name,
        amount: Number(item.amount)
      })),
      trend: trend.map((item) => ({
        date: item.date instanceof Date ? item.date.toISOString().slice(0, 10) : String(item.date),
        simulated: Number(item.simulated),
        opportunity: 0
      }))
    }
  }
})

app.post('/admin/login', async (request, reply) => {
  const body = loginSchema.parse(request.body)
  const admin = await row('SELECT * FROM admin_users WHERE username = ?', [body.username])
  if (!admin || !(await bcrypt.compare(body.password, admin.password_hash))) {
    return reply.code(401).send({ message: '后台账号或密码错误' })
  }
  await exec('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [admin.id])
  return {
    token: await signAdmin(admin.id, admin.username),
    admin: { id: admin.id, username: admin.username, displayName: admin.display_name }
  }
})

app.get('/admin/overview', { preHandler: requireAdmin }, async () => {
  const [dau, wau, mau, newUsers, ordersAgg, oppView, oppCart, foodOrders, allOrders] = await Promise.all([
    row(`SELECT COUNT(DISTINCT user_id) count FROM behavior_events WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`),
    row(`SELECT COUNT(DISTINCT user_id) count FROM behavior_events WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`),
    row(`SELECT COUNT(DISTINCT user_id) count FROM behavior_events WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`),
    row(`SELECT COUNT(*) count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`),
    row(`SELECT COUNT(*) count, COALESCE(SUM(total_virtual_amount), 0) gmv, COALESCE(SUM(saved_amount), 0) savings FROM orders WHERE status != 'cancelled'`),
    row(`SELECT COALESCE(SUM(virtual_amount), 0) amount FROM savings_opportunity_records WHERE source_type = 'product_view_no_order' AND status = 'counted'`),
    row(`SELECT COALESCE(SUM(virtual_amount), 0) amount FROM savings_opportunity_records WHERE source_type = 'cart_abandoned' AND status = 'counted'`),
    row(`SELECT COUNT(*) count FROM orders WHERE order_type = 'food_delivery' AND status != 'cancelled'`),
    row(`SELECT COUNT(*) count FROM orders WHERE status != 'cancelled'`)
  ])
  const topProducts = await rows(
    `SELECT p.id, p.title, COUNT(be.id) clicks, COALESCE(SUM(oi.subtotal_amount), 0) amount
     FROM products p
     LEFT JOIN behavior_events be ON JSON_UNQUOTE(JSON_EXTRACT(be.properties, '$.productId')) = p.id AND be.event_name = 'product_view'
     LEFT JOIN order_items oi ON oi.product_id = p.id
     GROUP BY p.id, p.title
     ORDER BY clicks DESC, amount DESC
     LIMIT 8`
  )
  const topSearchTerms = await rows(
    `SELECT JSON_UNQUOTE(JSON_EXTRACT(properties, '$.term')) term, COUNT(*) count
     FROM behavior_events
     WHERE event_name = 'search_submit'
     GROUP BY term
     HAVING term IS NOT NULL
     ORDER BY count DESC
     LIMIT 8`
  )
  const simulatedSavings = Number(ordersAgg?.savings ?? 0)
  const viewAmount = Number(oppView?.amount ?? 0)
  const cartAmount = Number(oppCart?.amount ?? 0)
  return {
    overview: {
      dau: Number(dau?.count ?? 0),
      wau: Number(wau?.count ?? 0),
      mau: Number(mau?.count ?? 0),
      newUsers: Number(newUsers?.count ?? 0),
      activeUsers: Number(mau?.count ?? 0),
      simulatedOrderCount: Number(ordersAgg?.count ?? 0),
      simulatedGmv: Number(ordersAgg?.gmv ?? 0),
      simulatedSavings,
      productViewOpportunity: viewAmount,
      cartAbandonedOpportunity: cartAmount,
      estimatedTotalSavings: simulatedSavings + viewAmount + cartAmount,
      foodOrderRatio: Number(allOrders?.count ?? 0) === 0 ? 0 : Number(foodOrders?.count ?? 0) / Number(allOrders?.count ?? 0),
      topProducts: topProducts.map((item) => ({
        id: item.id,
        title: item.title,
        clicks: Number(item.clicks),
        amount: Number(item.amount)
      })),
      topSearchTerms: topSearchTerms.map((item) => ({ term: item.term, count: Number(item.count) }))
    }
  }
})

app.get('/admin/orders', { preHandler: requireAdmin }, async (request) => {
  const query = z
    .object({
      status: z.string().optional(),
      orderType: z.enum(['shopping', 'food_delivery']).optional(),
      q: z.string().optional(),
      limit: z.coerce.number().min(1).max(500).optional()
    })
    .parse(request.query)
  const conditions: string[] = []
  const params: unknown[] = []
  if (query.status) {
    conditions.push('orders.status = ?')
    params.push(query.status)
  }
  if (query.orderType) {
    conditions.push('orders.order_type = ?')
    params.push(query.orderType)
  }
  if (query.q) {
    conditions.push(
      `(orders.order_no LIKE ? OR orders.user_id LIKE ? OR orders.virtual_address_label LIKE ? OR EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id AND oi.title LIKE ?
      ) OR EXISTS (
        SELECT 1 FROM order_reviews rv WHERE rv.order_id = orders.id AND rv.content LIKE ?
      ))`
    )
    params.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`, `%${query.q}%`, `%${query.q}%`)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.min(Math.max(Number(query.limit ?? 200), 1), 500)
  const result = await rows(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ${limit}`, params)
  return { orders: await Promise.all(result.map(publicOrder)) }
})

app.post('/admin/orders/:id/advance', { preHandler: requireAdmin }, async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  await advanceOrder(params.id, 'admin_manual')
  await logOperation(request, 'order.advance', 'order', params.id)
  const order = await row('SELECT * FROM orders WHERE id = ?', [params.id])
  return { order: order ? await publicOrder(order) : null }
})

app.post('/admin/orders/:id/cancel', { preHandler: requireAdmin }, async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const order = await row('SELECT id, status, coupon_id FROM orders WHERE id = ?', [params.id])
  if (!order) return reply.code(404).send({ message: '订单不存在' })
  if (['completed', 'cancelled'].includes(order.status)) return reply.code(409).send({ message: '当前状态不可取消' })
  await withTransaction(async (connection) => {
    await connection.execute(`UPDATE orders SET status = 'cancelled', canceled_at = NOW() WHERE id = ?`, [params.id])
    if (order.coupon_id) {
      await connection.execute(`UPDATE user_coupons SET status = 'available', used_at = NULL, order_id = NULL WHERE id = ?`, [order.coupon_id])
    }
    await connection.execute(
      `INSERT INTO order_status_events (id, order_id, from_status, to_status, title, description, trigger_type, occurred_at, metadata)
       VALUES (?, ?, ?, 'cancelled', '已取消', '运营后台取消了本次订单。', 'admin_manual', NOW(), ?)`,
      [`ose_${nanoid(12)}`, params.id, order.status, JSON.stringify({ admin: true })]
    )
  })
  await logOperation(request, 'order.cancel', 'order', params.id, { fromStatus: order.status })
  const updated = await row('SELECT * FROM orders WHERE id = ?', [params.id])
  return { order: updated ? await publicOrder(updated) : null }
})

app.get('/admin/products', { preHandler: requireAdmin }, async (request) => {
  const query = z
    .object({
      q: z.string().optional(),
      orderType: z.enum(['shopping', 'food_delivery']).optional(),
      status: z.enum(['active', 'inactive']).optional(),
      categoryId: z.string().optional(),
      merchantId: z.string().optional(),
      limit: z.coerce.number().min(1).max(1000).optional()
    })
    .parse(request.query)
  const conditions: string[] = []
  const params: unknown[] = []
  if (query.q) {
    conditions.push('(title LIKE ? OR subtitle LIKE ? OR description LIKE ?)')
    params.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`)
  }
  if (query.orderType) {
    conditions.push('order_type = ?')
    params.push(query.orderType)
  }
  if (query.status) {
    conditions.push('status = ?')
    params.push(query.status)
  }
  if (query.categoryId) {
    conditions.push('category_id = ?')
    params.push(query.categoryId)
  }
  if (query.merchantId) {
    conditions.push('merchant_id = ?')
    params.push(query.merchantId)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.min(Math.max(Number(query.limit ?? 500), 1), 1000)
  const result = await rows(`SELECT * FROM products ${where} ORDER BY updated_at DESC LIMIT ${limit}`, params)
  return { products: result.map(publicProduct) }
})

app.get('/admin/categories', { preHandler: requireAdmin }, async () => {
  const result = await rows('SELECT * FROM categories ORDER BY sort_order ASC')
  return { categories: result.map(publicCategory) }
})

app.get('/admin/merchants', { preHandler: requireAdmin }, async () => {
  const result = await rows('SELECT * FROM merchants ORDER BY type ASC, rating DESC, delivery_minutes ASC')
  return { merchants: result.map(publicMerchant) }
})

const adminMerchantSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['shopping', 'food_delivery']),
  logoUrl: z.string().min(1),
  rating: z.number().min(0).max(5).default(4.8),
  deliveryMinutes: z.number().int().min(1).max(240).default(40),
  minOrderAmount: z.number().int().min(0).default(0),
  deliveryFee: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([])
})

const adminCategorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  icon: z.string().min(1).max(20).default('◦'),
  description: z.string().max(255).default(''),
  sortOrder: z.number().int().min(0).default(0)
})

app.post('/admin/merchants', { preHandler: requireAdmin }, async (request, reply) => {
  const body = adminMerchantSchema.parse(request.body)
  const id = `m_${nanoid(12)}`
  await exec(
    `INSERT INTO merchants (id, name, type, logo_url, rating, delivery_minutes, min_order_amount, delivery_fee, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, body.name, body.type, body.logoUrl, body.rating, body.deliveryMinutes, body.minOrderAmount, body.deliveryFee, JSON.stringify(body.tags)]
  )
  await logOperation(request, 'merchant.create', 'merchant', id, { name: body.name, type: body.type })
  const merchant = await row('SELECT * FROM merchants WHERE id = ?', [id])
  if (!merchant) return reply.code(500).send({ message: '店铺创建后读取失败' })
  return { merchant: publicMerchant(merchant) }
})

app.patch('/admin/merchants/:id', { preHandler: requireAdmin }, async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const body = adminMerchantSchema.partial().parse(request.body)
  const mapping = {
    name: 'name',
    type: 'type',
    logoUrl: 'logo_url',
    rating: 'rating',
    deliveryMinutes: 'delivery_minutes',
    minOrderAmount: 'min_order_amount',
    deliveryFee: 'delivery_fee',
    tags: 'tags'
  } as const
  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, column] of Object.entries(mapping)) {
    const value = body[key as keyof typeof body]
    if (value !== undefined) {
      fields.push(`${column} = ?`)
      values.push(key === 'tags' ? JSON.stringify(value) : value)
    }
  }
  if (fields.length === 0) return reply.code(400).send({ message: '没有可更新字段' })
  values.push(params.id)
  await exec(`UPDATE merchants SET ${fields.join(', ')} WHERE id = ?`, values)
  await logOperation(request, 'merchant.update', 'merchant', params.id, body)
  const merchant = await row('SELECT * FROM merchants WHERE id = ?', [params.id])
  if (!merchant) return reply.code(404).send({ message: '店铺不存在' })
  return { merchant: publicMerchant(merchant) }
})

app.post('/admin/categories', { preHandler: requireAdmin }, async (request, reply) => {
  const body = adminCategorySchema.parse(request.body)
  const id = `cat_${nanoid(12)}`
  await exec(
    `INSERT INTO categories (id, name, slug, icon, description, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, body.name, body.slug, body.icon, body.description, body.sortOrder]
  )
  await logOperation(request, 'category.create', 'category', id, { name: body.name, slug: body.slug })
  const category = await row('SELECT * FROM categories WHERE id = ?', [id])
  if (!category) return reply.code(500).send({ message: '类目创建后读取失败' })
  return { category: publicCategory(category) }
})

app.patch('/admin/categories/:id', { preHandler: requireAdmin }, async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const body = adminCategorySchema.partial().parse(request.body)
  const mapping = {
    name: 'name',
    slug: 'slug',
    icon: 'icon',
    description: 'description',
    sortOrder: 'sort_order'
  } as const
  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, column] of Object.entries(mapping)) {
    const value = body[key as keyof typeof body]
    if (value !== undefined) {
      fields.push(`${column} = ?`)
      values.push(value)
    }
  }
  if (fields.length === 0) return reply.code(400).send({ message: '没有可更新字段' })
  values.push(params.id)
  await exec(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values)
  await logOperation(request, 'category.update', 'category', params.id, body)
  const category = await row('SELECT * FROM categories WHERE id = ?', [params.id])
  if (!category) return reply.code(404).send({ message: '类目不存在' })
  return { category: publicCategory(category) }
})

app.post('/admin/products', { preHandler: requireAdmin }, async (request, reply) => {
  const body = z
    .object({
      merchantId: z.string(),
      categoryId: z.string(),
      orderType: z.enum(['shopping', 'food_delivery']),
      title: z.string().min(1).max(160),
      subtitle: z.string().default(''),
      description: z.string().default(''),
      imageUrl: z.string().default(''),
      virtualPrice: z.number().int().min(1),
      compareAtPrice: z.number().int().min(1),
      tags: z.array(z.string()).default([]),
      recommendationWeight: z.number().int().default(0),
      status: z.enum(['active', 'inactive']).default('active')
    })
    .parse(request.body)
  const id = `p_${nanoid(12)}`
  await exec(
    `INSERT INTO products (
      id, merchant_id, category_id, order_type, title, subtitle, description, image_url, virtual_price,
      compare_at_price, virtual_stock, virtual_sales_count, tags, status, recommendation_weight
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999, 0, ?, ?, ?)`,
    [
      id,
      body.merchantId,
      body.categoryId,
      body.orderType,
      body.title,
      body.subtitle,
      body.description,
      body.imageUrl,
      body.virtualPrice,
      body.compareAtPrice,
      JSON.stringify(body.tags),
      body.status,
      body.recommendationWeight
    ]
  )
  await logOperation(request, 'product.create', 'product', id, { title: body.title, orderType: body.orderType })
  const product = await row('SELECT * FROM products WHERE id = ?', [id])
  if (!product) return reply.code(500).send({ message: '商品创建后读取失败' })
  return { product: publicProduct(product) }
})

app.patch('/admin/products/:id', { preHandler: requireAdmin }, async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const body = z
    .object({
      title: z.string().min(1).max(160).optional(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      merchantId: z.string().optional(),
      categoryId: z.string().optional(),
      orderType: z.enum(['shopping', 'food_delivery']).optional(),
      status: z.enum(['active', 'inactive']).optional(),
      virtualPrice: z.number().int().min(1).optional(),
      compareAtPrice: z.number().int().min(1).optional(),
      tags: z.array(z.string()).optional(),
      recommendationWeight: z.number().int().optional()
    })
    .parse(request.body)
  const fields: string[] = []
  const values: unknown[] = []
  const mapping = {
    title: 'title',
    subtitle: 'subtitle',
    description: 'description',
    imageUrl: 'image_url',
    merchantId: 'merchant_id',
    categoryId: 'category_id',
    orderType: 'order_type',
    status: 'status',
    virtualPrice: 'virtual_price',
    compareAtPrice: 'compare_at_price',
    tags: 'tags',
    recommendationWeight: 'recommendation_weight'
  } as const
  for (const [key, column] of Object.entries(mapping)) {
    const value = body[key as keyof typeof body]
    if (value !== undefined) {
      fields.push(`${column} = ?`)
      values.push(key === 'tags' ? JSON.stringify(value) : value)
    }
  }
  if (fields.length === 0) return reply.code(400).send({ message: '没有可更新字段' })
  values.push(params.id)
  await exec(`UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values)
  await logOperation(request, 'product.update', 'product', params.id, body)
  const product = await row('SELECT * FROM products WHERE id = ?', [params.id])
  if (!product) return reply.code(404).send({ message: '商品不存在' })
  return { product: publicProduct(product) }
})

const adminCouponSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(255),
  scope: z.enum(['all', 'shopping', 'food_delivery']).default('all'),
  thresholdAmount: z.number().int().min(0).default(0),
  discountAmount: z.number().int().min(1),
  totalQuantity: z.number().int().min(1).nullable().optional(),
  perUserLimit: z.number().int().min(1).max(10).default(1),
  startsAt: z.string().optional(),
  endsAt: z.string(),
  status: z.enum(['active', 'inactive']).default('active'),
  sortOrder: z.number().int().default(50)
})

app.get('/admin/coupons', { preHandler: requireAdmin }, async () => {
  const result = await rows(
    `SELECT ct.*,
      COALESCE(uc.claimed_total, 0) claimed_total,
      COALESCE(uc.used_total, 0) used_total,
      COALESCE(uc.available_total, 0) available_total
     FROM coupon_templates ct
     LEFT JOIN (
       SELECT template_id,
        COUNT(*) claimed_total,
        SUM(status = 'used') used_total,
        SUM(status = 'available' AND expires_at > NOW()) available_total
       FROM user_coupons
       GROUP BY template_id
     ) uc ON uc.template_id = ct.id
     ORDER BY ct.sort_order ASC, ct.created_at DESC`
  )
  return {
    coupons: result.map((coupon) => ({
      ...publicCouponTemplate({ ...coupon, user_claimed_count: 0 }),
      claimedTotal: Number(coupon.claimed_total ?? 0),
      usedTotal: Number(coupon.used_total ?? 0),
      availableTotal: Number(coupon.available_total ?? 0)
    }))
  }
})

app.post('/admin/coupons', { preHandler: requireAdmin }, async (request, reply) => {
  const body = adminCouponSchema.parse(request.body)
  const id = `coupon_${nanoid(12)}`
  await exec(
    `INSERT INTO coupon_templates (
      id, title, description, scope, threshold_amount, discount_amount, total_quantity,
      per_user_limit, starts_at, ends_at, status, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      body.title,
      body.description,
      body.scope,
      body.thresholdAmount,
      body.discountAmount,
      body.totalQuantity ?? null,
      body.perUserLimit,
      body.startsAt ? new Date(body.startsAt) : new Date(),
      new Date(body.endsAt),
      body.status,
      body.sortOrder
    ]
  )
  await logOperation(request, 'coupon.create', 'coupon', id, { title: body.title })
  const coupon = await row('SELECT * FROM coupon_templates WHERE id = ?', [id])
  if (!coupon) return reply.code(500).send({ message: '优惠券创建后读取失败' })
  return { coupon: publicCouponTemplate(coupon) }
})

app.patch('/admin/coupons/:id', { preHandler: requireAdmin }, async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params)
  const body = adminCouponSchema.partial().parse(request.body)
  const mapping = {
    title: 'title',
    description: 'description',
    scope: 'scope',
    thresholdAmount: 'threshold_amount',
    discountAmount: 'discount_amount',
    totalQuantity: 'total_quantity',
    perUserLimit: 'per_user_limit',
    startsAt: 'starts_at',
    endsAt: 'ends_at',
    status: 'status',
    sortOrder: 'sort_order'
  } as const
  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, column] of Object.entries(mapping)) {
    const value = body[key as keyof typeof body]
    if (value !== undefined) {
      fields.push(`${column} = ?`)
      values.push(key === 'startsAt' || key === 'endsAt' ? new Date(String(value)) : value)
    }
  }
  if (fields.length === 0) return reply.code(400).send({ message: '没有可更新字段' })
  values.push(params.id)
  await exec(`UPDATE coupon_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values)
  await logOperation(request, 'coupon.update', 'coupon', params.id, body)
  const coupon = await row('SELECT * FROM coupon_templates WHERE id = ?', [params.id])
  if (!coupon) return reply.code(404).send({ message: '优惠券不存在' })
  return { coupon: publicCouponTemplate(coupon) }
})

app.get('/admin/events', { preHandler: requireAdmin }, async () => {
  const result = await rows(
    `SELECT id, event_name, user_id, session_id, platform, page_path, occurred_at, properties
     FROM behavior_events ORDER BY occurred_at DESC LIMIT 100`
  )
  return {
    events: result.map((event) => ({
      id: event.id,
      eventName: event.event_name,
      userId: event.user_id,
      sessionId: event.session_id,
      platform: event.platform,
      pagePath: event.page_path,
      occurredAt: iso(event.occurred_at),
      properties: json<Record<string, unknown>>(event.properties, {})
    }))
  }
})

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    reply.code(400).send({ message: '请求参数不正确', issues: error.issues })
    return
  }
  app.log.error(error)
  reply.code(500).send({ message: '服务暂时不可用' })
})

async function bootstrap(instance: FastifyInstance): Promise<void> {
  await migrate()
  await seedDatabase()
  await resumePendingOrders()
  await instance.listen({ host: config.host, port: config.port })
}

process.on('SIGINT', async () => {
  for (const timers of scheduledOrders.values()) {
    for (const timer of timers) clearTimeout(timer)
  }
  await app.close()
  await closePool()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  for (const timers of scheduledOrders.values()) {
    for (const timer of timers) clearTimeout(timer)
  }
  await app.close()
  await closePool()
  process.exit(0)
})

bootstrap(app).catch(async (error) => {
  app.log.error(error)
  await closePool()
  process.exit(1)
})
