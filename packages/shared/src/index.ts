export type Platform = 'wechat_mp' | 'h5' | 'ios' | 'android' | 'admin'

export type OrderType = 'shopping' | 'food_delivery'

export type CouponScope = 'all' | OrderType

export type CouponStatus = 'available' | 'used' | 'expired'

export type OrderStatus =
  | 'created'
  | 'virtual_paid'
  | 'warehouse_processing'
  | 'packed'
  | 'outbound'
  | 'in_transit'
  | 'delivering'
  | 'merchant_accepted'
  | 'preparing'
  | 'rider_assigned'
  | 'picked_up'
  | 'arriving'
  | 'completed'
  | 'cancelled'

export type SavingsOpportunityType = 'product_view_no_order' | 'cart_abandoned'

export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string
  sortOrder: number
}

export interface Merchant {
  id: string
  name: string
  type: OrderType
  logoUrl: string
  rating: number
  deliveryMinutes: number
  minOrderAmount: number
  deliveryFee: number
  tags: string[]
}

export interface MerchantSection {
  merchant: Merchant
  products: Product[]
  monthlySales: number
  distanceMeters: number
  promotionTags: string[]
}

export interface Product {
  id: string
  merchantId: string
  categoryId: string
  orderType: OrderType
  title: string
  subtitle: string
  description: string
  imageUrl: string
  virtualPrice: number
  compareAtPrice: number
  virtualStock: number
  virtualSalesCount: number
  tags: string[]
  status: 'active' | 'inactive'
  recommendationWeight: number
}

export interface CartItem {
  id: string
  productId: string
  quantity: number
  product: Product
}

export interface OrderItem {
  id: string
  productId: string
  title: string
  imageUrl: string
  unitPrice: number
  quantity: number
  subtotalAmount: number
}

export interface OrderStatusEvent {
  id: string
  orderId: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  title: string
  description: string
  triggerType: 'system_job' | 'admin_manual' | 'user_action'
  occurredAt: string
}

export interface OrderReview {
  id: string
  orderId: string
  userId: string
  rating: number
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface ReviewSummary {
  count: number
  averageRating: number
  distribution: Array<{
    rating: number
    count: number
  }>
  topTags: Array<{
    tag: string
    count: number
  }>
}

export interface ReviewFeedItem {
  id: string
  orderId: string
  orderNo: string
  userDisplayName: string
  rating: number
  content: string
  tags: string[]
  itemTitles: string[]
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  orderNo: string
  userId: string
  orderType: OrderType
  status: OrderStatus
  originalAmount: number
  totalVirtualAmount: number
  savedAmount: number
  couponId: string | null
  couponName: string | null
  couponDiscountAmount: number
  itemCount: number
  virtualPaymentMethod: string
  virtualAddressLabel: string
  createdAt: string
  completedAt: string | null
  canceledAt: string | null
  items: OrderItem[]
  events: OrderStatusEvent[]
  review: OrderReview | null
}

export interface CouponTemplate {
  id: string
  title: string
  description: string
  scope: CouponScope
  thresholdAmount: number
  discountAmount: number
  totalQuantity: number | null
  claimedCount: number
  perUserLimit: number
  startsAt: string
  endsAt: string
  status: 'active' | 'inactive'
  sortOrder: number
  userClaimedCount?: number
  canClaim?: boolean
  claimText?: string
}

export interface UserCoupon {
  id: string
  templateId: string
  title: string
  description: string
  scope: CouponScope
  thresholdAmount: number
  discountAmount: number
  status: CouponStatus
  claimedAt: string
  usedAt: string | null
  expiresAt: string
  orderId: string | null
  canUse?: boolean
  unusableReason?: string
}

export interface ProfileTraceSummary {
  favoriteCount: number
  footprintCount: number
  followedMerchantCount: number
  browseRecordCount: number
}

export interface FootprintItem {
  product: Product
  lastViewedAt: string
  viewCount: number
}

export interface MerchantFollow {
  id: string
  merchant: Merchant
  followedAt: string
}

export interface BrowseRecord {
  id: string
  eventName: string
  pagePath: string | null
  occurredAt: string
  properties: Record<string, unknown>
  targetTitle: string | null
  targetImageUrl: string | null
}

export interface SavingsOverview {
  simulatedOrderSavings: number
  productViewOpportunity: number
  cartAbandonedOpportunity: number
  estimatedTotalSavings: number
  todaySavings: number
  weekSavings: number
  monthSavings: number
  orderCount: number
  categoryBreakdown: Array<{
    categoryId: string
    categoryName: string
    amount: number
  }>
  trend: Array<{
    date: string
    simulated: number
    opportunity: number
  }>
}

export interface AdminOverview {
  dau: number
  wau: number
  mau: number
  newUsers: number
  activeUsers: number
  simulatedOrderCount: number
  simulatedGmv: number
  simulatedSavings: number
  productViewOpportunity: number
  cartAbandonedOpportunity: number
  estimatedTotalSavings: number
  foodOrderRatio: number
  topProducts: Array<{ id: string; title: string; clicks: number; amount: number }>
  topSearchTerms: Array<{ term: string; count: number }>
}

export const SHOPPING_STATUS_FLOW: OrderStatus[] = [
  'created',
  'virtual_paid',
  'warehouse_processing',
  'packed',
  'outbound',
  'in_transit',
  'delivering',
  'completed'
]

export const FOOD_STATUS_FLOW: OrderStatus[] = [
  'created',
  'virtual_paid',
  'merchant_accepted',
  'preparing',
  'rider_assigned',
  'picked_up',
  'arriving',
  'completed'
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: '已创建',
  virtual_paid: '已支付',
  warehouse_processing: '仓库处理中',
  packed: '已打包',
  outbound: '已出库',
  in_transit: '运输中',
  delivering: '派送中',
  merchant_accepted: '商家已接单',
  preparing: '制作中',
  rider_assigned: '骑手已接单',
  picked_up: '骑手已取餐',
  arriving: '即将送达',
  completed: '已完成',
  cancelled: '已取消'
}

export function formatMoney(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

export function statusFlowForOrderType(orderType: OrderType): OrderStatus[] {
  return orderType === 'food_delivery' ? FOOD_STATUS_FLOW : SHOPPING_STATUS_FLOW
}
