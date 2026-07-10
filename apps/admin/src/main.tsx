import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  BarChart3,
  Box,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  RefreshCw,
  Search,
  Save,
  Star,
  Store,
  Tags,
  TicketPercent,
  Truck
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ORDER_STATUS_LABELS, type AdminOverview, type Category, type Merchant, type Order, type OrderType, type Product } from '@fakemart/shared'
import { api, formatMoney } from './api'
import './styles.css'

type Tab = 'overview' | 'orders' | 'products' | 'coupons' | 'merchants' | 'categories' | 'events'

interface EventRow {
  id: string
  eventName: string
  userId: string
  sessionId: string
  platform: string
  pagePath: string
  occurredAt: string
  properties: Record<string, unknown>
}

interface ProductForm {
  id?: string
  title: string
  subtitle: string
  description: string
  imageUrl: string
  orderType: OrderType
  merchantId: string
  categoryId: string
  virtualPrice: string
  compareAtPrice: string
  tags: string
  recommendationWeight: string
  status: 'active' | 'inactive'
}

interface MerchantForm {
  id?: string
  name: string
  type: OrderType
  logoUrl: string
  rating: string
  deliveryMinutes: string
  minOrderAmount: string
  deliveryFee: string
  tags: string
}

interface CategoryForm {
  id?: string
  name: string
  slug: string
  icon: string
  description: string
  sortOrder: string
}

interface AdminCoupon {
  id: string
  title: string
  description: string
  scope: 'all' | OrderType
  thresholdAmount: number
  discountAmount: number
  totalQuantity: number | null
  claimedCount: number
  perUserLimit: number
  startsAt: string
  endsAt: string
  status: 'active' | 'inactive'
  sortOrder: number
  claimedTotal: number
  usedTotal: number
  availableTotal: number
}

interface CouponForm {
  id?: string
  title: string
  description: string
  scope: 'all' | OrderType
  thresholdAmount: string
  discountAmount: string
  totalQuantity: string
  perUserLimit: string
  endsAt: string
  status: 'active' | 'inactive'
  sortOrder: string
}

const emptyProductForm: ProductForm = {
  title: '',
  subtitle: '',
  description: '',
  imageUrl: '',
  orderType: 'shopping',
  merchantId: '',
  categoryId: '',
  virtualPrice: '',
  compareAtPrice: '',
  tags: '',
  recommendationWeight: '50',
  status: 'active'
}

const emptyMerchantForm: MerchantForm = {
  name: '',
  type: 'shopping',
  logoUrl: '',
  rating: '4.8',
  deliveryMinutes: '40',
  minOrderAmount: '0',
  deliveryFee: '0',
  tags: ''
}

const emptyCategoryForm: CategoryForm = {
  name: '',
  slug: '',
  icon: '◦',
  description: '',
  sortOrder: '90'
}

const emptyCouponForm: CouponForm = {
  title: '',
  description: '',
  scope: 'all',
  thresholdAmount: '0',
  discountAmount: '',
  totalQuantity: '10000',
  perUserLimit: '1',
  endsAt: defaultDateTimeLocal(30),
  status: 'active',
  sortOrder: '50'
}

function App() {
  const [token, setToken] = React.useState(localStorage.getItem('fakemart_admin_token') ?? '')
  const [tab, setTab] = React.useState<Tab>('overview')

  if (!token) {
    return <Login onLogin={(nextToken) => setToken(nextToken)} />
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">假</div>
          <div>
            <strong>假装购</strong>
            <span>FakeMart Admin</span>
          </div>
        </div>
        <nav>
          <NavButton active={tab === 'overview'} icon={<LayoutDashboard size={18} />} label="数据概览" onClick={() => setTab('overview')} />
          <NavButton active={tab === 'orders'} icon={<ClipboardList size={18} />} label="订单管理" onClick={() => setTab('orders')} />
          <NavButton active={tab === 'products'} icon={<Box size={18} />} label="商品管理" onClick={() => setTab('products')} />
          <NavButton active={tab === 'coupons'} icon={<TicketPercent size={18} />} label="优惠券" onClick={() => setTab('coupons')} />
          <NavButton active={tab === 'merchants'} icon={<Store size={18} />} label="店铺管理" onClick={() => setTab('merchants')} />
          <NavButton active={tab === 'categories'} icon={<Tags size={18} />} label="类目管理" onClick={() => setTab('categories')} />
          <NavButton active={tab === 'events'} icon={<Activity size={18} />} label="行为事件" onClick={() => setTab('events')} />
        </nav>
        <button
          className="ghostButton"
          onClick={() => {
            localStorage.removeItem('fakemart_admin_token')
            setToken('')
          }}
        >
          <LogOut size={17} />
          退出后台
        </button>
      </aside>
      <main className="main">
        {tab === 'overview' && <Overview />}
        {tab === 'orders' && <Orders />}
        {tab === 'products' && <Products />}
        {tab === 'coupons' && <Coupons />}
        {tab === 'merchants' && <Merchants />}
        {tab === 'categories' && <Categories />}
        {tab === 'events' && <Events />}
      </main>
    </div>
  )
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = React.useState('admin')
  const [password, setPassword] = React.useState('admin123456')
  const [error, setError] = React.useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await api<{ token: string }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })
      localStorage.setItem('fakemart_admin_token', result.token)
      onLogin(result.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    }
  }

  return (
    <div className="loginPage">
      <form className="loginPanel" onSubmit={submit}>
        <div className="brand large">
          <div className="brandMark">假</div>
          <div>
            <strong>假装购</strong>
            <span>运营后台</span>
          </div>
        </div>
        <label>
          账号
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primaryButton">进入后台</button>
      </form>
    </div>
  )
}

function Overview() {
  const [overview, setOverview] = React.useState<AdminOverview | null>(null)
  const [loading, setLoading] = React.useState(true)

  async function load() {
    setLoading(true)
    const result = await api<{ overview: AdminOverview }>('/admin/overview')
    setOverview(result.overview)
    setLoading(false)
  }

  React.useEffect(() => {
    load().catch(console.error)
  }, [])

  if (loading || !overview) return <Loading title="数据概览" />

  const chartData = [
    { name: '确定省下', amount: overview.simulatedSavings / 100 },
    { name: '浏览未买', amount: overview.productViewOpportunity / 100 },
    { name: '加购未结算', amount: overview.cartAbandonedOpportunity / 100 }
  ]

  return (
    <section>
      <Header title="数据概览" subtitle="活跃、订单、省钱和用户行为的运营快照" action={<RefreshButton onClick={load} />} />
      <div className="metricGrid">
        <Metric label="DAU" value={overview.dau} icon={<Activity size={18} />} />
        <Metric label="WAU" value={overview.wau} icon={<BarChart3 size={18} />} />
        <Metric label="订单数" value={overview.simulatedOrderCount} icon={<ClipboardList size={18} />} />
        <Metric label="订单金额" value={formatMoney(overview.simulatedGmv)} icon={<Box size={18} />} />
        <Metric label="确定省下" value={formatMoney(overview.simulatedSavings)} icon={<Truck size={18} />} />
        <Metric label="综合估算" value={formatMoney(overview.estimatedTotalSavings)} icon={<PackagePlus size={18} />} />
      </div>
      <div className="twoColumns">
        <div className="panel">
          <h2>省钱口径</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="money" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d7f72" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#1d7f72" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0f2" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#1d7f72" fill="url(#money)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <h2>热门商品</h2>
          <div className="list">
            {overview.topProducts.map((product) => (
              <div className="listRow" key={product.id}>
                <div>
                  <strong>{product.title}</strong>
                  <span>{product.clicks} 次查看</span>
                </div>
                <b>{formatMoney(product.amount)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Orders() {
  const [orders, setOrders] = React.useState<Order[]>([])
  const [selected, setSelected] = React.useState<Order | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<'all' | 'shopping' | 'food_delivery'>('all')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [keyword, setKeyword] = React.useState('')
  const [savingId, setSavingId] = React.useState('')

  async function load() {
    setLoading(true)
    const query = new URLSearchParams({ limit: '300' })
    if (filter !== 'all') query.set('orderType', filter)
    if (statusFilter !== 'all') query.set('status', statusFilter)
    if (keyword.trim()) query.set('q', keyword.trim())
    const result = await api<{ orders: Order[] }>(`/admin/orders?${query.toString()}`)
    setOrders(result.orders)
    setSelected((current) => result.orders.find((order) => order.id === current?.id) ?? result.orders[0] ?? null)
    setLoading(false)
  }

  async function advance(id: string) {
    setSavingId(id)
    await api(`/admin/orders/${id}/advance`, { method: 'POST' })
    await load()
    setSavingId('')
  }

  async function cancel(id: string) {
    if (!window.confirm('确认取消这笔订单吗？')) return
    setSavingId(id)
    await api(`/admin/orders/${id}/cancel`, { method: 'POST' })
    await load()
    setSavingId('')
  }

  React.useEffect(() => {
    load().catch(console.error)
  }, [filter, statusFilter])

  if (loading) return <Loading title="订单管理" />

  return (
    <section>
      <Header title="订单管理" subtitle="状态、金额、商品和进度事件都可以追踪" action={<RefreshButton onClick={load} />} />
      <div className="toolbar orderToolbar">
        <Search size={18} />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') load().catch(console.error)
          }}
          placeholder="搜索订单号、用户、地址、商品"
        />
        <button className="secondaryButton compact" onClick={() => load().catch(console.error)}>搜索</button>
      </div>
      <div className="toolbar segmentedToolbar">
        <button className={filter === 'all' ? 'segmented active' : 'segmented'} onClick={() => setFilter('all')}>全部</button>
        <button className={filter === 'shopping' ? 'segmented active' : 'segmented'} onClick={() => setFilter('shopping')}>购物</button>
        <button className={filter === 'food_delivery' ? 'segmented active' : 'segmented'} onClick={() => setFilter('food_delivery')}>外卖</button>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">全部状态</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>
      <div className="workbench">
        <div className="dataTable">
          <div className="tableHead orderCols">
            <span>订单</span>
            <span>类型</span>
            <span>金额</span>
            <span>状态</span>
            <span>评价</span>
            <span>地址</span>
            <span>操作</span>
          </div>
          {orders.length === 0 ? (
            <div className="emptyState">暂无匹配订单</div>
          ) : (
            orders.map((order) => (
              <div className={selected?.id === order.id ? 'tableRow orderCols selected' : 'tableRow orderCols'} key={order.id}>
                <button className="linkButton" onClick={() => setSelected(order)}>
                  <strong>{order.orderNo}</strong>
                  <small>{new Date(order.createdAt).toLocaleString()}</small>
                </button>
                <span>{order.orderType === 'food_delivery' ? '外卖' : '购物'}</span>
                <b>{formatMoney(order.totalVirtualAmount)}</b>
                <span className={order.status === 'cancelled' ? 'statusPill mutedPill' : 'statusPill'}>{ORDER_STATUS_LABELS[order.status]}</span>
                <span className={order.review ? 'ratingCell' : 'ratingCell muted'}>
                  {order.review ? (
                    <>
                      <Star size={14} fill="currentColor" />
                      {order.review.rating}.0
                    </>
                  ) : order.status === 'completed' ? '待评' : '-'}
                </span>
                <span className="ellipsisText">{order.virtualAddressLabel}</span>
                <div className="rowActions">
                  <button
                    className="iconButton"
                    disabled={savingId === order.id || ['completed', 'cancelled'].includes(order.status)}
                    onClick={() => advance(order.id)}
                    title="推进状态"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    className="secondaryButton compact danger"
                    disabled={savingId === order.id || ['completed', 'cancelled'].includes(order.status)}
                    onClick={() => cancel(order.id)}
                  >
                    取消
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <aside className="detailPanel">
          {selected ? (
            <>
              <div className="detailHeader">
                <div>
                  <h2>{selected.orderNo}</h2>
                  <p>
                    {selected.itemCount} 件 · 实付 {formatMoney(selected.totalVirtualAmount)}
                    {selected.couponDiscountAmount > 0 ? ` · 优惠 ${formatMoney(selected.couponDiscountAmount)}` : ''}
                  </p>
                </div>
                <span className="statusPill">{ORDER_STATUS_LABELS[selected.status]}</span>
              </div>
              {selected.review ? (
                <div className="reviewBox">
                  <div className="reviewBoxHead">
                    <strong>
                      <Star size={15} fill="currentColor" />
                      {selected.review.rating}.0
                    </strong>
                    <span>{new Date(selected.review.updatedAt).toLocaleString()}</span>
                  </div>
                  {selected.review.tags.length > 0 && (
                    <div className="reviewTags">
                      {selected.review.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  )}
                  <p>{selected.review.content || '用户没有填写文字评价。'}</p>
                </div>
              ) : (
                <div className="reviewBox emptyReview">
                  {selected.status === 'completed' ? '这笔订单还没有评价' : '订单完成后可评价'}
                </div>
              )}
              <h3>商品</h3>
              {selected.items.map((item) => (
                <div className="compactItem" key={item.id}>
                  <img src={item.imageUrl} alt="" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>x {item.quantity} · {formatMoney(item.subtotalAmount)}</span>
                  </div>
                </div>
              ))}
              <h3>时间线</h3>
              <div className="timeline">
                {selected.events.map((event) => (
                  <div className="timelineItem" key={event.id}>
                    <strong>{event.title}</strong>
                    <span>{event.description}</span>
                    <small>{new Date(event.occurredAt).toLocaleString()}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="emptyState">暂无订单</div>
          )}
        </aside>
      </div>
    </section>
  )
}

function Products() {
  const [products, setProducts] = React.useState<Product[]>([])
  const [categories, setCategories] = React.useState<Category[]>([])
  const [merchants, setMerchants] = React.useState<Merchant[]>([])
  const [keyword, setKeyword] = React.useState('')
  const [savingId, setSavingId] = React.useState('')
  const [form, setForm] = React.useState<ProductForm>(emptyProductForm)
  const [message, setMessage] = React.useState('')

  async function load() {
    const [result, categoryResult, merchantResult] = await Promise.all([
      api<{ products: Product[] }>('/admin/products'),
      api<{ categories: Category[] }>('/admin/categories'),
      api<{ merchants: Merchant[] }>('/admin/merchants')
    ])
    setProducts(result.products)
    setCategories(categoryResult.categories)
    setMerchants(merchantResult.merchants)
    setForm((current) => ({
      ...current,
      categoryId: current.categoryId || categoryResult.categories[0]?.id || '',
      merchantId: current.merchantId || merchantResult.merchants.find((merchant) => merchant.type === current.orderType)?.id || ''
    }))
  }

  React.useEffect(() => {
    load().catch(console.error)
  }, [])

  const filtered = products.filter((product) => product.title.includes(keyword) || product.subtitle.includes(keyword))
  const filteredMerchants = merchants.filter((merchant) => merchant.type === form.orderType)

  function patchForm(next: Partial<ProductForm>) {
    setMessage('')
    setForm((current) => ({ ...current, ...next }))
  }

  function edit(product: Product) {
    setMessage('')
    setForm({
      id: product.id,
      title: product.title,
      subtitle: product.subtitle,
      description: product.description,
      imageUrl: product.imageUrl,
      orderType: product.orderType,
      merchantId: product.merchantId,
      categoryId: product.categoryId,
      virtualPrice: String(product.virtualPrice / 100),
      compareAtPrice: String(product.compareAtPrice / 100),
      tags: product.tags.join('，'),
      recommendationWeight: String(product.recommendationWeight),
      status: product.status
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setMessage('')
    setForm({
      ...emptyProductForm,
      categoryId: categories[0]?.id || '',
      merchantId: merchants.find((merchant) => merchant.type === 'shopping')?.id || ''
    })
  }

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault()
    setSavingId(form.id ?? 'new')
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      orderType: form.orderType,
      merchantId: form.merchantId,
      categoryId: form.categoryId,
      virtualPrice: Math.max(1, Math.round(Number(form.virtualPrice) * 100)),
      compareAtPrice: Math.max(1, Math.round(Number(form.compareAtPrice || form.virtualPrice) * 100)),
      tags: form.tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean),
      recommendationWeight: Number(form.recommendationWeight || 0),
      status: form.status
    }
    if (form.id) {
      await api(`/admin/products/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setMessage('商品已保存')
    } else {
      await api('/admin/products', { method: 'POST', body: JSON.stringify(payload) })
      setMessage('商品已新增')
    }
    await load()
    setSavingId('')
  }

  async function toggle(product: Product) {
    setSavingId(product.id)
    await api(`/admin/products/${product.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: product.status === 'active' ? 'inactive' : 'active' })
    })
    await load()
    setSavingId('')
  }

  return (
    <section>
      <Header title="商品管理" subtitle="新增、编辑、上下架和推荐权重都可以在这里完成" action={<RefreshButton onClick={load} />} />
      <form className="productEditor" onSubmit={submitProduct}>
        <div className="editorHead">
          <div>
            <h2>{form.id ? '编辑商品' : '新增商品'}</h2>
            <p>{form.id ? form.id : '选择商家和分类后即可上架'}</p>
          </div>
          <div className="editorActions">
            <button className="secondaryButton" type="button" onClick={resetForm}>新增</button>
            <button className="primaryButton inline" disabled={savingId === (form.id ?? 'new')}>
              <Save size={17} />
              保存
            </button>
          </div>
        </div>
        <div className="formGrid">
          <label>
            商品名称
            <input value={form.title} required onChange={(event) => patchForm({ title: event.target.value })} />
          </label>
          <label>
            副标题
            <input value={form.subtitle} onChange={(event) => patchForm({ subtitle: event.target.value })} />
          </label>
          <label>
            场景
            <select
              value={form.orderType}
              onChange={(event) => {
                const orderType = event.target.value as OrderType
                patchForm({ orderType, merchantId: merchants.find((merchant) => merchant.type === orderType)?.id || '' })
              }}
            >
              <option value="shopping">购物</option>
              <option value="food_delivery">外卖</option>
            </select>
          </label>
          <label>
            商家
            <select value={form.merchantId} required onChange={(event) => patchForm({ merchantId: event.target.value })}>
              {filteredMerchants.map((merchant) => <option value={merchant.id} key={merchant.id}>{merchant.name}</option>)}
            </select>
          </label>
          <label>
            分类
            <select value={form.categoryId} required onChange={(event) => patchForm({ categoryId: event.target.value })}>
              {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            售价
            <input type="number" min="0.01" step="0.01" value={form.virtualPrice} required onChange={(event) => patchForm({ virtualPrice: event.target.value })} />
          </label>
          <label>
            参考价
            <input type="number" min="0.01" step="0.01" value={form.compareAtPrice} required onChange={(event) => patchForm({ compareAtPrice: event.target.value })} />
          </label>
          <label>
            推荐权重
            <input type="number" value={form.recommendationWeight} onChange={(event) => patchForm({ recommendationWeight: event.target.value })} />
          </label>
          <label>
            状态
            <select value={form.status} onChange={(event) => patchForm({ status: event.target.value as Product['status'] })}>
              <option value="active">上架</option>
              <option value="inactive">下架</option>
            </select>
          </label>
          <label className="spanTwo">
            图片 URL
            <input value={form.imageUrl} required onChange={(event) => patchForm({ imageUrl: event.target.value })} />
          </label>
          <label className="spanTwo">
            标签
            <input value={form.tags} placeholder="热卖，下午茶，新品" onChange={(event) => patchForm({ tags: event.target.value })} />
          </label>
          <label className="spanTwo">
            描述
            <textarea value={form.description} onChange={(event) => patchForm({ description: event.target.value })} />
          </label>
        </div>
        {message && <p className="successMessage">{message}</p>}
      </form>
      <div className="toolbar">
        <Search size={18} />
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索商品" />
      </div>
      <div className="dataTable">
        <div className="tableHead productCols">
          <span>商品</span>
          <span>场景</span>
          <span>价格</span>
          <span>推荐</span>
            <span>状态</span>
            <span>操作</span>
        </div>
        {filtered.map((product) => (
          <div className="tableRow productCols" key={product.id}>
            <div className="productCell">
              <img src={product.imageUrl} alt="" />
              <div>
                <strong>{product.title}</strong>
                <span>{product.subtitle}</span>
              </div>
            </div>
            <span>{product.orderType === 'food_delivery' ? '外卖' : '购物'}</span>
            <b>{formatMoney(product.virtualPrice)}</b>
            <span>{product.recommendationWeight}</span>
            <span className={product.status === 'active' ? 'statusPill' : 'statusPill mutedPill'}>{product.status === 'active' ? '上架' : '下架'}</span>
            <div className="rowActions">
              <button className="secondaryButton compact" onClick={() => edit(product)}>编辑</button>
              <button className="secondaryButton compact" disabled={savingId === product.id} onClick={() => toggle(product)}>
                {product.status === 'active' ? '下架' : '上架'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Coupons() {
  const [coupons, setCoupons] = React.useState<AdminCoupon[]>([])
  const [savingId, setSavingId] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [form, setForm] = React.useState<CouponForm>(emptyCouponForm)

  async function load() {
    const result = await api<{ coupons: AdminCoupon[] }>('/admin/coupons')
    setCoupons(result.coupons)
  }

  React.useEffect(() => {
    load().catch(console.error)
  }, [])

  function patchForm(next: Partial<CouponForm>) {
    setMessage('')
    setForm((current) => ({ ...current, ...next }))
  }

  function edit(coupon: AdminCoupon) {
    setMessage('')
    setForm({
      id: coupon.id,
      title: coupon.title,
      description: coupon.description,
      scope: coupon.scope,
      thresholdAmount: String(coupon.thresholdAmount / 100),
      discountAmount: String(coupon.discountAmount / 100),
      totalQuantity: coupon.totalQuantity == null ? '' : String(coupon.totalQuantity),
      perUserLimit: String(coupon.perUserLimit),
      endsAt: toDateTimeLocal(coupon.endsAt),
      status: coupon.status,
      sortOrder: String(coupon.sortOrder)
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setMessage('')
    setForm(emptyCouponForm)
  }

  async function submitCoupon(event: React.FormEvent) {
    event.preventDefault()
    setSavingId(form.id ?? 'new')
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      scope: form.scope,
      thresholdAmount: Math.max(0, Math.round(Number(form.thresholdAmount || 0) * 100)),
      discountAmount: Math.max(1, Math.round(Number(form.discountAmount || 0) * 100)),
      totalQuantity: form.totalQuantity.trim() ? Math.max(1, Number(form.totalQuantity)) : null,
      perUserLimit: Math.max(1, Number(form.perUserLimit || 1)),
      endsAt: new Date(form.endsAt).toISOString(),
      status: form.status,
      sortOrder: Number(form.sortOrder || 50)
    }
    if (form.id) {
      await api(`/admin/coupons/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setMessage('优惠券已保存')
    } else {
      await api('/admin/coupons', { method: 'POST', body: JSON.stringify(payload) })
      setMessage('优惠券已新增')
    }
    await load()
    setSavingId('')
  }

  async function toggle(coupon: AdminCoupon) {
    setSavingId(coupon.id)
    await api(`/admin/coupons/${coupon.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: coupon.status === 'active' ? 'inactive' : 'active' })
    })
    await load()
    setSavingId('')
  }

  return (
    <section>
      <Header title="优惠券" subtitle="配置满减券、查看领取与使用情况" action={<RefreshButton onClick={load} />} />
      <form className="productEditor" onSubmit={submitCoupon}>
        <div className="editorHead">
          <div>
            <h2>{form.id ? '编辑优惠券' : '新增优惠券'}</h2>
            <p>{form.id ? form.id : '设置门槛、金额和适用场景后即可发放'}</p>
          </div>
          <div className="editorActions">
            <button className="secondaryButton" type="button" onClick={resetForm}>新增</button>
            <button className="primaryButton inline" disabled={savingId === (form.id ?? 'new')}>
              <Save size={17} />
              保存
            </button>
          </div>
        </div>
        <div className="formGrid">
          <label>
            券名称
            <input value={form.title} required onChange={(event) => patchForm({ title: event.target.value })} />
          </label>
          <label>
            适用场景
            <select value={form.scope} onChange={(event) => patchForm({ scope: event.target.value as CouponForm['scope'] })}>
              <option value="all">全场通用</option>
              <option value="shopping">商城</option>
              <option value="food_delivery">外卖</option>
            </select>
          </label>
          <label>
            满减门槛
            <input type="number" min="0" step="0.01" value={form.thresholdAmount} onChange={(event) => patchForm({ thresholdAmount: event.target.value })} />
          </label>
          <label>
            抵扣金额
            <input type="number" min="0.01" step="0.01" required value={form.discountAmount} onChange={(event) => patchForm({ discountAmount: event.target.value })} />
          </label>
          <label>
            发放总量
            <input type="number" min="1" placeholder="留空不限" value={form.totalQuantity} onChange={(event) => patchForm({ totalQuantity: event.target.value })} />
          </label>
          <label>
            每人限领
            <input type="number" min="1" value={form.perUserLimit} onChange={(event) => patchForm({ perUserLimit: event.target.value })} />
          </label>
          <label>
            到期时间
            <input type="datetime-local" required value={form.endsAt} onChange={(event) => patchForm({ endsAt: event.target.value })} />
          </label>
          <label>
            状态
            <select value={form.status} onChange={(event) => patchForm({ status: event.target.value as CouponForm['status'] })}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>
          <label>
            排序
            <input type="number" value={form.sortOrder} onChange={(event) => patchForm({ sortOrder: event.target.value })} />
          </label>
          <label className="spanTwo">
            描述
            <input value={form.description} required onChange={(event) => patchForm({ description: event.target.value })} />
          </label>
        </div>
        {message && <p className="successMessage">{message}</p>}
      </form>

      <div className="dataTable">
        <div className="tableHead couponCols">
          <span>优惠券</span>
          <span>场景</span>
          <span>门槛/抵扣</span>
          <span>领取</span>
          <span>使用</span>
          <span>到期</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        {coupons.map((coupon) => (
          <div className="tableRow couponCols" key={coupon.id}>
            <div className="couponCell">
              <strong>{coupon.title}</strong>
              <span>{coupon.description}</span>
            </div>
            <span>{scopeLabel(coupon.scope)}</span>
            <b>{coupon.thresholdAmount ? `满${formatMoney(coupon.thresholdAmount)}` : '无门槛'} / 减{formatMoney(coupon.discountAmount)}</b>
            <span>{coupon.claimedTotal}</span>
            <span>{coupon.usedTotal}</span>
            <span>{new Date(coupon.endsAt).toLocaleDateString()}</span>
            <span className={coupon.status === 'active' ? 'statusPill' : 'statusPill mutedPill'}>{coupon.status === 'active' ? '启用' : '停用'}</span>
            <div className="rowActions">
              <button className="secondaryButton compact" onClick={() => edit(coupon)}>编辑</button>
              <button className="secondaryButton compact" disabled={savingId === coupon.id} onClick={() => toggle(coupon)}>
                {coupon.status === 'active' ? '停用' : '启用'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Merchants() {
  const [merchants, setMerchants] = React.useState<Merchant[]>([])
  const [keyword, setKeyword] = React.useState('')
  const [savingId, setSavingId] = React.useState('')
  const [form, setForm] = React.useState<MerchantForm>(emptyMerchantForm)
  const [message, setMessage] = React.useState('')

  async function load() {
    const result = await api<{ merchants: Merchant[] }>('/admin/merchants')
    setMerchants(result.merchants)
  }

  React.useEffect(() => {
    load().catch(console.error)
  }, [])

  const filtered = merchants.filter((merchant) => {
    const term = keyword.trim()
    if (!term) return true
    return merchant.name.includes(term) || merchant.tags.some((tag) => tag.includes(term))
  })

  function patchForm(next: Partial<MerchantForm>) {
    setMessage('')
    setForm((current) => ({ ...current, ...next }))
  }

  function resetForm(type: OrderType = 'shopping') {
    setMessage('')
    setForm({ ...emptyMerchantForm, type })
  }

  function edit(merchant: Merchant) {
    setMessage('')
    setForm({
      id: merchant.id,
      name: merchant.name,
      type: merchant.type,
      logoUrl: merchant.logoUrl,
      rating: String(merchant.rating),
      deliveryMinutes: String(merchant.deliveryMinutes),
      minOrderAmount: String(merchant.minOrderAmount / 100),
      deliveryFee: String(merchant.deliveryFee / 100),
      tags: merchant.tags.join('，')
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitMerchant(event: React.FormEvent) {
    event.preventDefault()
    setSavingId(form.id ?? 'new')
    const payload = {
      name: form.name.trim(),
      type: form.type,
      logoUrl: form.logoUrl.trim() || merchantLogoDataUri(form.name.trim() || '店铺'),
      rating: clamp(Number(form.rating || 4.8), 0, 5),
      deliveryMinutes: Math.max(1, Math.round(Number(form.deliveryMinutes || 40))),
      minOrderAmount: centsFromYuan(form.minOrderAmount),
      deliveryFee: centsFromYuan(form.deliveryFee),
      tags: tagsFromInput(form.tags)
    }
    if (form.id) {
      await api(`/admin/merchants/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setMessage('店铺已保存')
    } else {
      await api('/admin/merchants', { method: 'POST', body: JSON.stringify(payload) })
      setMessage('店铺已新增')
    }
    await load()
    setSavingId('')
  }

  return (
    <section>
      <Header title="店铺管理" subtitle="维护购物店铺和外卖商家，用户端会同步展示" action={<RefreshButton onClick={load} />} />
      <form className="productEditor" onSubmit={submitMerchant}>
        <div className="editorHead">
          <div>
            <h2>{form.id ? '编辑店铺' : '新增店铺'}</h2>
            <p>{form.id ? form.id : '购物店铺和外卖餐厅都在这里维护'}</p>
          </div>
          <div className="editorActions">
            <button className="secondaryButton" type="button" onClick={() => resetForm(form.type)}>新增</button>
            <button className="primaryButton inline" disabled={savingId === (form.id ?? 'new')}>
              <Save size={17} />
              保存
            </button>
          </div>
        </div>
        <div className="formGrid">
          <label>
            店铺名称
            <input value={form.name} required onChange={(event) => patchForm({ name: event.target.value })} />
          </label>
          <label>
            场景
            <select value={form.type} onChange={(event) => patchForm({ type: event.target.value as OrderType })}>
              <option value="shopping">购物</option>
              <option value="food_delivery">外卖</option>
            </select>
          </label>
          <label>
            评分
            <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => patchForm({ rating: event.target.value })} />
          </label>
          <label>
            配送分钟
            <input type="number" min="1" value={form.deliveryMinutes} onChange={(event) => patchForm({ deliveryMinutes: event.target.value })} />
          </label>
          <label>
            起送金额
            <input type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={(event) => patchForm({ minOrderAmount: event.target.value })} />
          </label>
          <label>
            配送费
            <input type="number" min="0" step="0.01" value={form.deliveryFee} onChange={(event) => patchForm({ deliveryFee: event.target.value })} />
          </label>
          <label className="spanTwo">
            Logo URL
            <input value={form.logoUrl} placeholder="不填会自动生成一个店铺图" onChange={(event) => patchForm({ logoUrl: event.target.value })} />
          </label>
          <label className="spanTwo">
            标签
            <input value={form.tags} placeholder="官方精选，包邮，好评" onChange={(event) => patchForm({ tags: event.target.value })} />
          </label>
        </div>
        {message && <p className="successMessage">{message}</p>}
      </form>
      <div className="toolbar">
        <Search size={18} />
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索店铺或标签" />
      </div>
      <div className="dataTable">
        <div className="tableHead merchantCols">
          <span>店铺</span>
          <span>场景</span>
          <span>评分</span>
          <span>配送</span>
          <span>费用</span>
          <span>操作</span>
        </div>
        {filtered.map((merchant) => (
          <div className="tableRow merchantCols" key={merchant.id}>
            <div className="productCell">
              <img src={merchant.logoUrl} alt="" />
              <div>
                <strong>{merchant.name}</strong>
                <span>{merchant.tags.join(' / ') || '暂无标签'}</span>
              </div>
            </div>
            <span>{merchant.type === 'food_delivery' ? '外卖' : '购物'}</span>
            <b>{merchant.rating.toFixed(1)}</b>
            <span>{merchant.deliveryMinutes} 分钟</span>
            <span>{merchant.type === 'food_delivery' ? `起送 ${formatMoney(merchant.minOrderAmount)} · 配送 ${formatMoney(merchant.deliveryFee)}` : '购物店铺'}</span>
            <div className="rowActions">
              <button className="secondaryButton compact" onClick={() => edit(merchant)}>编辑</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Categories() {
  const [categories, setCategories] = React.useState<Category[]>([])
  const [keyword, setKeyword] = React.useState('')
  const [savingId, setSavingId] = React.useState('')
  const [form, setForm] = React.useState<CategoryForm>(emptyCategoryForm)
  const [message, setMessage] = React.useState('')

  async function load() {
    const result = await api<{ categories: Category[] }>('/admin/categories')
    setCategories(result.categories)
  }

  React.useEffect(() => {
    load().catch(console.error)
  }, [])

  const filtered = categories.filter((category) => {
    const term = keyword.trim()
    if (!term) return true
    return category.name.includes(term) || category.slug.includes(term) || category.description.includes(term)
  })

  function patchForm(next: Partial<CategoryForm>) {
    setMessage('')
    setForm((current) => ({ ...current, ...next }))
  }

  function resetForm() {
    setMessage('')
    setForm(emptyCategoryForm)
  }

  function edit(category: Category) {
    setMessage('')
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description,
      sortOrder: String(category.sortOrder)
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitCategory(event: React.FormEvent) {
    event.preventDefault()
    setSavingId(form.id ?? 'new')
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      icon: form.icon.trim() || '◦',
      description: form.description.trim(),
      sortOrder: Math.max(0, Math.round(Number(form.sortOrder || 0)))
    }
    if (form.id) {
      await api(`/admin/categories/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setMessage('类目已保存')
    } else {
      await api('/admin/categories', { method: 'POST', body: JSON.stringify(payload) })
      setMessage('类目已新增')
    }
    await load()
    setSavingId('')
  }

  return (
    <section>
      <Header title="类目管理" subtitle="维护首页、分类页和商品归档使用的类目" action={<RefreshButton onClick={load} />} />
      <form className="productEditor" onSubmit={submitCategory}>
        <div className="editorHead">
          <div>
            <h2>{form.id ? '编辑类目' : '新增类目'}</h2>
            <p>{form.id ? form.id : 'slug 会用于前台分类匹配，请保持简短稳定'}</p>
          </div>
          <div className="editorActions">
            <button className="secondaryButton" type="button" onClick={resetForm}>新增</button>
            <button className="primaryButton inline" disabled={savingId === (form.id ?? 'new')}>
              <Save size={17} />
              保存
            </button>
          </div>
        </div>
        <div className="formGrid">
          <label>
            类目名称
            <input value={form.name} required onChange={(event) => patchForm({ name: event.target.value })} />
          </label>
          <label>
            Slug
            <input value={form.slug} required onChange={(event) => patchForm({ slug: event.target.value })} />
          </label>
          <label>
            图标标记
            <input value={form.icon} maxLength={20} onChange={(event) => patchForm({ icon: event.target.value })} />
          </label>
          <label>
            排序
            <input type="number" min="0" value={form.sortOrder} onChange={(event) => patchForm({ sortOrder: event.target.value })} />
          </label>
          <label className="spanTwo">
            描述
            <input value={form.description} onChange={(event) => patchForm({ description: event.target.value })} />
          </label>
        </div>
        {message && <p className="successMessage">{message}</p>}
      </form>
      <div className="toolbar">
        <Search size={18} />
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索类目、slug、描述" />
      </div>
      <div className="dataTable">
        <div className="tableHead categoryCols">
          <span>类目</span>
          <span>Slug</span>
          <span>排序</span>
          <span>描述</span>
          <span>操作</span>
        </div>
        {filtered.map((category) => (
          <div className="tableRow categoryCols" key={category.id}>
            <div className="categoryCell">
              <span>{category.icon}</span>
              <strong>{category.name}</strong>
            </div>
            <code>{category.slug}</code>
            <b>{category.sortOrder}</b>
            <span className="ellipsisText">{category.description}</span>
            <div className="rowActions">
              <button className="secondaryButton compact" onClick={() => edit(category)}>编辑</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Events() {
  const [events, setEvents] = React.useState<EventRow[]>([])

  async function load() {
    const result = await api<{ events: EventRow[] }>('/admin/events')
    setEvents(result.events)
  }

  React.useEffect(() => {
    load().catch(console.error)
  }, [])

  return (
    <section>
      <Header title="行为事件" subtitle="最近 100 条用户行为事件" action={<RefreshButton onClick={load} />} />
      <div className="dataTable">
        <div className="tableHead eventCols">
          <span>事件</span>
          <span>页面</span>
          <span>平台</span>
          <span>时间</span>
          <span>属性</span>
        </div>
        {events.map((event) => (
          <div className="tableRow eventCols" key={event.id}>
            <strong>{event.eventName}</strong>
            <span>{event.pagePath || '-'}</span>
            <span>{event.platform}</span>
            <span>{new Date(event.occurredAt).toLocaleString()}</span>
            <code>{JSON.stringify(event.properties)}</code>
          </div>
        ))}
      </div>
    </section>
  )
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? 'navButton active' : 'navButton'} onClick={onClick}>
      {icon}
      {label}
    </button>
  )
}

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <header className="pageHeader">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  )
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="secondaryButton" onClick={onClick}>
      <RefreshCw size={17} />
      刷新
    </button>
  )
}

function Loading({ title }: { title: string }) {
  return (
    <section>
      <Header title={title} subtitle="正在读取数据" />
      <div className="panel">加载中...</div>
    </section>
  )
}

function tagsFromInput(value: string): string[] {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function centsFromYuan(value: string): number {
  return Math.max(0, Math.round(Number(value || 0) * 100))
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function defaultDateTimeLocal(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return defaultDateTimeLocal(30)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function scopeLabel(scope: 'all' | OrderType): string {
  if (scope === 'shopping') return '商城'
  if (scope === 'food_delivery') return '外卖'
  return '全场'
}

function merchantLogoDataUri(label: string): string {
  const safeLabel = label.slice(0, 4) || '店铺'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="520" viewBox="0 0 520 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff5b5c"/><stop offset="1" stop-color="#ffbf63"/></linearGradient></defs><rect width="520" height="520" rx="92" fill="url(#g)"/><circle cx="402" cy="98" r="86" fill="rgba(255,255,255,.28)"/><text x="260" y="292" text-anchor="middle" font-family="Arial, PingFang SC, sans-serif" font-size="72" font-weight="900" fill="#fff">${safeLabel}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

createRoot(document.getElementById('root')!).render(<App />)
